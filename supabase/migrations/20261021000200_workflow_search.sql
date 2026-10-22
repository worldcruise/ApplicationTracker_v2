begin;
create extension if not exists pg_trgm with schema extensions;

-- Same normalization in indexes, filters and ranking. No profile bodies or contact
-- information enter the searchable projection. These helpers read no tables.
create function private.workflow_search_text(p_text text) returns text language sql immutable parallel safe set search_path='' as $$
 select btrim(regexp_replace(lower(coalesce(p_text,'')), '[[:space:]]+', ' ', 'g'))
$$;
create function private.workflow_search_vector(p_text text) returns tsvector language sql immutable parallel safe set search_path='' as $$
 select to_tsvector('simple'::regconfig,coalesce(p_text,''))
$$;
revoke all on function private.workflow_search_text(text),private.workflow_search_vector(text) from public;
grant execute on function private.workflow_search_text(text),private.workflow_search_vector(text) to authenticated,app_command;

-- Expression indexes keep original columns/contracts unchanged, and are updated
-- by PostgreSQL in the same transaction as edits. Related records are joined live.
create index bids_search_fts on public.bids using gin(private.workflow_search_vector(company_name||' '||job_title||' '||coalesce(external_id,'')||' '||job_description||' '||notes));
create index bids_identity_fts on public.bids using gin(private.workflow_search_vector(company_name||' '||job_title));
create index bids_id_trgm on public.bids using gin((id::text) extensions.gin_trgm_ops);
create index bids_owner_id_trgm on public.bids using gin((owner_id::text) extensions.gin_trgm_ops);
create index bids_external_trgm on public.bids using gin(private.workflow_search_text(external_id) extensions.gin_trgm_ops);
create index bids_body_trgm on public.bids using gin(private.workflow_search_text(job_description||' '||notes) extensions.gin_trgm_ops);
create index bids_company_trgm on public.bids using gin(private.workflow_search_text(company_name) extensions.gin_trgm_ops);
create index bids_title_trgm on public.bids using gin(private.workflow_search_text(job_title) extensions.gin_trgm_ops);
create index candidates_search_fts on public.candidates using gin(private.workflow_search_vector(full_name));
create index candidates_name_trgm on public.candidates using gin(private.workflow_search_text(full_name) extensions.gin_trgm_ops);
create index users_name_trgm on public.users using gin(private.workflow_search_text(display_name) extensions.gin_trgm_ops);
create index interviews_search_fts on public.interviews using gin(private.workflow_search_vector(type||' '||interviewer||' '||next_action));
create index interviews_interviewer_trgm on public.interviews using gin(private.workflow_search_text(interviewer) extensions.gin_trgm_ops);
create index interviews_type_trgm on public.interviews using gin(private.workflow_search_text(type) extensions.gin_trgm_ops);
create index interviews_notes_trgm on public.interviews using gin(private.workflow_search_text(next_action) extensions.gin_trgm_ops);
create index interviews_id_trgm on public.interviews using gin((id::text) extensions.gin_trgm_ops);
create index interviews_bid_id_trgm on public.interviews using gin((bid_id::text) extensions.gin_trgm_ops);
create index interviews_owner_id_trgm on public.interviews using gin((owner_id::text) extensions.gin_trgm_ops);
create index feedback_search_fts on public.interview_feedback using gin(private.workflow_search_vector(feedback));
create index feedback_body_trgm on public.interview_feedback using gin(private.workflow_search_text(feedback) extensions.gin_trgm_ops);
create index bids_search_dates on public.bids(organization_id,created_at,id);
create index bids_search_submitted on public.bids(organization_id,submitted_at,id) where submitted_at is not null;
create index bids_search_followup on public.bids(organization_id,follow_up_at,id) where follow_up_at is not null;
create index interviews_search_followup on public.interviews(organization_id,follow_up_at,id) where follow_up_at is not null;
create index workflow_tasks_search_due on public.workflow_tasks(organization_id,bid_id,interview_id,due_at) where state='open';

-- Narrow reuse of the existing safe bidder projection. Submit-only grants must
-- not silently gain candidate-name visibility. No raw candidate SELECT is added.
grant create on schema private to app_bidder_reader;
create function private.workflow_bidder_name(p_org uuid,p_candidate uuid,p_bid uuid) returns text
language sql stable security definer set search_path='' as $$
 select c.full_name from public.candidates c where c.organization_id=p_org and c.id=p_candidate
 and exists(select 1 from private.bidder_grants(p_org,p_candidate,p_bid,'bid.prepare'))
$$;
alter function private.workflow_bidder_name(uuid,uuid,uuid) owner to app_bidder_reader;
revoke create on schema private from app_bidder_reader;
revoke all on function private.workflow_bidder_name(uuid,uuid,uuid) from public;
grant execute on function private.workflow_bidder_name(uuid,uuid,uuid) to authenticated;

-- All ordinary records, feedback, names, options and counts retain invoker RLS.
-- One statement snapshot supplies both the filtered total and the page. There is
-- deliberately no privileged search role, search cache or caller-supplied SQL.
create function public.search_workflow(p_org uuid,p_kind text,p_filters jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security invoker set search_path='' set pg_trgm.word_similarity_threshold='0.4' as $$
declare
 v_role text:=private.org_role(p_org); v_q text:=private.workflow_search_text(p_filters->>'q');
 v_page integer:=coalesce((p_filters->>'page')::integer,1); v_size integer:=coalesce((p_filters->>'pageSize')::integer,25);
 v_sort text:=coalesce(p_filters->>'sort','relevance'); v_now timestamptz:=statement_timestamp(); v_result jsonb; k text; d text; v_plain tsquery;
begin
 if v_role is null or (p_kind='interviews' and v_role='bidder') then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_kind is null or p_kind not in ('bids','interviews') or jsonb_typeof(p_filters) is distinct from 'object'
 or v_page is null or v_page not between 1 and 100000 or v_size is null or v_size not between 1 and 100
 or length(v_q)>200 or v_sort not in ('relevance','updated_desc','created_desc','company_asc','candidate_asc','followup_asc','submitted_desc','scheduled_asc','scheduled_desc')
 or (p_kind='bids' and v_sort like 'scheduled%') or (p_kind='interviews' and v_sort='submitted_desc')
 then raise exception 'INVALID_SEARCH' using errcode='22023';end if;
 for k in select jsonb_object_keys(p_filters) loop
  if k not in ('q','candidateId','company','status','ownerId','teamId','priority','createdFrom','createdTo','submittedFrom','submittedTo','followup','bidId','type','round','scheduledFrom','scheduledTo','upcoming','feedbackPending','sort','page','pageSize')
  or jsonb_typeof(p_filters->k) not in ('string','number','boolean') or length(p_filters->>k)>200 or (p_filters->>k) ~ '[[:cntrl:]]'
  or (p_kind='bids' and k in ('bidId','type','round','scheduledFrom','scheduledTo','upcoming','feedbackPending'))
  or (p_kind='interviews' and k in ('priority','createdFrom','createdTo','submittedFrom','submittedTo')) then raise exception 'INVALID_SEARCH' using errcode='22023';end if;
 end loop;
 foreach k in array array['candidateId','ownerId','teamId','bidId'] loop if p_filters ? k then perform (p_filters->>k)::uuid;end if;end loop;
 foreach k in array array['createdFrom','createdTo','submittedFrom','submittedTo','scheduledFrom','scheduledTo'] loop
  if p_filters ? k then d:=p_filters->>k;
   if d !~ '^\d{4}-\d{2}-\d{2}$' or d<'1900-01-01' or d>'9998-12-31' or to_char(d::date,'YYYY-MM-DD')<>d then raise exception 'INVALID_SEARCH' using errcode='22023';end if;
  end if;
 end loop;
 foreach k in array array['created','submitted','scheduled'] loop
  if p_filters ? (k||'From') and p_filters ? (k||'To') and p_filters->>(k||'From')>p_filters->>(k||'To') then raise exception 'INVALID_SEARCH' using errcode='22023';end if;
 end loop;
 if (p_filters ? 'status' and ((p_kind='bids' and p_filters->>'status' not in ('draft','resume_preparation','ready_for_review','needs_changes','approved','submitted','awaiting_response','shortlisted','interview_invited','on_hold','rejected','withdrawn','expired','offer','closed')) or (p_kind='interviews' and p_filters->>'status' not in ('not_scheduled','scheduling','scheduled','completed','feedback_pending','cancelled'))))
 or (p_filters ? 'priority' and p_filters->>'priority' not in ('low','normal','high','urgent'))
 or (p_filters ? 'followup' and p_filters->>'followup' not in ('due','overdue'))
 or (p_filters ? 'round' and ((p_filters->>'round')!~'^[0-9]{1,5}$' or (p_filters->>'round')::int not between 1 and 10000))
 or (p_filters ? 'upcoming' and p_filters->>'upcoming' not in ('true','false'))
 or (p_filters ? 'feedbackPending' and p_filters->>'feedbackPending' not in ('true','false')) then raise exception 'INVALID_SEARCH' using errcode='22023';end if;

 if v_q ~ '[[:alnum:]]' then v_plain:=plainto_tsquery('simple',v_q);end if;
 with sources as not materialized (
  select b.id,b.candidate_id,b.owner_id,b.team_id,b.company_name,b.job_title,b.status,b.priority,b.created_at,b.updated_at,b.submitted_at,b.follow_up_at,
   null::timestamptz scheduled_at,null::text interview_type,null::integer round_number,null::uuid bid_id,
   coalesce(c.full_name,case when v_role='bidder' then private.workflow_bidder_name(p_org,b.candidate_id,b.id) end) candidate_name,u.display_name owner_name,t.name team_name,
   private.workflow_search_vector(b.company_name||' '||b.job_title||' '||coalesce(b.external_id,'')||' '||b.job_description||' '||b.notes) bid_vector,
   ''::tsvector interview_vector,''::tsvector feedback_vector,
   b.external_id, b.job_description||' '||b.notes body, ''::text interviewer,false has_feedback,
   to_jsonb(b) record
  from public.bids b left join public.candidates c on c.organization_id=b.organization_id and c.id=b.candidate_id
   left join public.users u on u.id=b.owner_id left join public.teams t on t.organization_id=b.organization_id and t.id=b.team_id
  where p_kind='bids' and b.organization_id=p_org
  union all
  select i.id,b.candidate_id,i.owner_id,b.team_id,b.company_name,b.job_title,i.lifecycle_status,b.priority,i.created_at,i.updated_at,b.submitted_at,i.follow_up_at,
   i.scheduled_at,i.type,i.round_number,i.bid_id,c.full_name,u.display_name,t.name,
   private.workflow_search_vector(b.company_name||' '||b.job_title),
   private.workflow_search_vector(i.type||' '||i.interviewer||' '||i.next_action),private.workflow_search_vector(f.feedback),
   null::text,i.next_action||' '||coalesce(f.feedback,''),i.interviewer,f.feedback is not null,to_jsonb(i)
  from public.interviews i join public.bids b on b.organization_id=i.organization_id and b.id=i.bid_id
   left join public.candidates c on c.organization_id=b.organization_id and c.id=b.candidate_id
   left join public.users u on u.id=i.owner_id left join public.teams t on t.organization_id=b.organization_id and t.id=b.team_id
   left join lateral(select f.feedback from public.interview_feedback f where f.organization_id=i.organization_id and f.interview_id=i.id order by f.revision_number desc limit 1) f on true
  where p_kind='interviews' and i.organization_id=p_org
 ), tokens as (
  select distinct x token,to_tsquery('simple',quote_literal(x)||':*') prefix,
   '%'||replace(replace(replace(x,'\','\\'),'%','\%'),'_','\_')||'%' pattern
  from regexp_split_to_table(v_q,'[^[:alnum:]_]+') x where x ~ '[[:alnum:]]'
 ),
 scoped as materialized (
  select s.*,array[private.workflow_search_text(candidate_name),private.workflow_search_text(company_name),private.workflow_search_text(job_title)] important,
   array[private.workflow_search_text(owner_name),private.workflow_search_text(external_id),private.workflow_search_text(interview_type),private.workflow_search_text(interviewer)] secondary,
   private.workflow_search_text(concat_ws(' ',candidate_name,company_name,job_title,owner_name,owner_id::text,external_id,id::text,bid_id::text,interview_type,interviewer,body)) all_text
  from sources s
 ), term_matches as (
  -- Search the indexed source expressions, not an unscoped denormalized index.
  -- Every branch below is an ordinary RLS query. The union is intersected by
  -- query term so words can match different related fields, in any order.
  select b.id,t.token from tokens t join public.bids b on b.organization_id=p_org where p_kind='bids' and
   (private.workflow_search_vector(b.company_name||' '||b.job_title||' '||coalesce(b.external_id,'')||' '||b.job_description||' '||b.notes)@@t.prefix
    or private.workflow_search_text(b.company_name) like t.pattern or private.workflow_search_text(b.job_title) like t.pattern
    or private.workflow_search_text(b.external_id) like t.pattern or b.id::text like t.pattern or b.owner_id::text like t.pattern
    or private.workflow_search_text(b.job_description||' '||b.notes) like t.pattern
    or (length(t.token)>=3 and (private.workflow_search_text(b.company_name) operator(extensions.%>) t.token or private.workflow_search_text(b.job_title) operator(extensions.%>) t.token)))
  union
  select i.id,t.token from tokens t join public.interviews i on i.organization_id=p_org join public.bids b on b.organization_id=p_org and b.id=i.bid_id where p_kind='interviews' and
   (private.workflow_search_vector(b.company_name||' '||b.job_title)@@t.prefix
    or private.workflow_search_text(b.company_name) like t.pattern or private.workflow_search_text(b.job_title) like t.pattern
    or private.workflow_search_vector(i.type||' '||i.interviewer||' '||i.next_action)@@t.prefix
    or private.workflow_search_text(i.interviewer) like t.pattern or private.workflow_search_text(i.type) like t.pattern
    or private.workflow_search_text(i.next_action) like t.pattern
    or i.id::text like t.pattern or i.bid_id::text like t.pattern or i.owner_id::text like t.pattern
    or (length(t.token)>=3 and (private.workflow_search_text(b.company_name) operator(extensions.%>) t.token or private.workflow_search_text(b.job_title) operator(extensions.%>) t.token or private.workflow_search_text(i.interviewer) operator(extensions.%>) t.token or private.workflow_search_text(i.type) operator(extensions.%>) t.token)))
  union
  select s.id,t.token from tokens t join public.candidates c on c.organization_id=p_org join scoped s on s.candidate_id=c.id where
   private.workflow_search_vector(c.full_name)@@t.prefix or private.workflow_search_text(c.full_name) like t.pattern
    or (length(t.token)>=3 and private.workflow_search_text(c.full_name) operator(extensions.%>) t.token)
  union
  select s.id,t.token from tokens t join public.users u on true join scoped s on s.owner_id=u.id where
   private.workflow_search_text(u.display_name) like t.pattern or (length(t.token)>=3 and private.workflow_search_text(u.display_name) operator(extensions.%>) t.token)
  union
  select s.id,t.token from tokens t join scoped s on v_role='bidder' where
   private.workflow_search_text(s.candidate_name) like t.pattern or (length(t.token)>=3 and private.workflow_search_text(s.candidate_name) operator(extensions.%>) t.token)
  union
  select f.interview_id,t.token from tokens t join public.interview_feedback f on f.organization_id=p_org where p_kind='interviews'
   and (private.workflow_search_vector(f.feedback)@@t.prefix or private.workflow_search_text(f.feedback) like t.pattern) and not exists(select 1 from public.interview_feedback newer where newer.organization_id=p_org and newer.interview_id=f.interview_id and newer.revision_number>f.revision_number)
 ), matched as (select id from term_matches group by id having count(distinct token)=(select count(*) from tokens)),
 filtered as (
  select s.*,
   -- Exact identity field, then field prefix, then identity partial, then fuzzy/
   -- weighted lexemes. Long descriptions cannot outrank an identity match.
   case when v_q='' then 0 else
   (case when v_q=any(important) or v_q=id::text or v_q=owner_id::text or v_q=private.workflow_search_text(external_id) or v_q=coalesce(bid_id::text,'') then 10000
    when v_q=any(secondary) then 9000
    when exists(select 1 from unnest(important) a where starts_with(a,v_q)) then 8000
    when exists(select 1 from unnest(secondary) a where starts_with(a,v_q)) then 7000
    when exists(select 1 from unnest(important) a where position(v_q in a)>0) then 6000 else 0 end
    + 100*greatest(extensions.word_similarity(v_q,coalesce(candidate_name,'')),extensions.word_similarity(v_q,company_name),extensions.word_similarity(v_q,job_title))
    + 50*greatest(extensions.word_similarity(v_q,coalesce(owner_name,'')),extensions.word_similarity(v_q,coalesce(interviewer,'')),extensions.word_similarity(v_q,coalesce(interview_type,'')))
    + coalesce(ts_rank_cd(setweight(private.workflow_search_vector(concat_ws(' ',candidate_name,company_name,job_title)),'A')||setweight(interview_vector,'B')||setweight(bid_vector,'D')||setweight(feedback_vector,'D'),v_plain,32),0)) end score
  from scoped s where
   (not p_filters ? 'candidateId' or candidate_id=(p_filters->>'candidateId')::uuid)
   and (not p_filters ? 'company' or private.workflow_search_text(company_name)=private.workflow_search_text(p_filters->>'company'))
   and (not p_filters ? 'ownerId' or owner_id=(p_filters->>'ownerId')::uuid)
   and (not p_filters ? 'teamId' or team_id=(p_filters->>'teamId')::uuid)
   and (not p_filters ? 'status' or status=p_filters->>'status')
   and (not p_filters ? 'priority' or priority=p_filters->>'priority')
   and (not p_filters ? 'bidId' or bid_id=(p_filters->>'bidId')::uuid)
   and (not p_filters ? 'type' or private.workflow_search_text(interview_type)=private.workflow_search_text(p_filters->>'type'))
   and (not p_filters ? 'round' or round_number=(p_filters->>'round')::integer)
   and (not p_filters ? 'createdFrom' or created_at >= ((p_filters->>'createdFrom')::date::timestamp at time zone 'UTC'))
   and (not p_filters ? 'createdTo' or created_at < (((p_filters->>'createdTo')::date+1)::timestamp at time zone 'UTC'))
   and (not p_filters ? 'submittedFrom' or submitted_at >= ((p_filters->>'submittedFrom')::date::timestamp at time zone 'UTC'))
   and (not p_filters ? 'submittedTo' or submitted_at < (((p_filters->>'submittedTo')::date+1)::timestamp at time zone 'UTC'))
   and (not p_filters ? 'scheduledFrom' or scheduled_at >= ((p_filters->>'scheduledFrom')::date::timestamp at time zone 'UTC'))
   and (not p_filters ? 'scheduledTo' or scheduled_at < (((p_filters->>'scheduledTo')::date+1)::timestamp at time zone 'UTC'))
   and (not p_filters ? 'followup' or exists(select 1 from public.workflow_tasks task where task.organization_id=p_org and task.state='open'
    and ((p_kind='bids' and task.bid_id=s.id and task.interview_id is null) or (p_kind='interviews' and task.interview_id=s.id and task.bid_id=s.bid_id))
    and (case when p_filters->>'followup'='overdue' then task.due_at<v_now else task.due_at<((v_now at time zone 'UTC')::date+1)::timestamp at time zone 'UTC' end)))
   and (coalesce((p_filters->>'upcoming')::boolean,false)=false or (status='scheduled' and scheduled_at>=v_now))
   and (coalesce((p_filters->>'feedbackPending')::boolean,false)=false or status='feedback_pending' or (status='completed' and not has_feedback))
   and (v_q='' or id in (select id from matched) or (not exists(select 1 from tokens) and position(v_q in all_text)>0))
   -- Preserve meaningful technical symbols/wildcards as literal terms, so C++
   -- does not silently become a one-letter C search. No SQL/LIKE interpolation.
   and not exists(select 1 from regexp_split_to_table(v_q,'[[:space:]]+') literal where literal ~ '[+#%_\\]' and position(literal in all_text)=0)
 ), page as (
  select * from filtered order by
   case when v_sort='relevance' then score end desc,
   case when v_sort='updated_desc' then updated_at end desc,
   case when v_sort='created_desc' then created_at end desc,
   case when v_sort='company_asc' then private.workflow_search_text(company_name) end asc,
   case when v_sort='candidate_asc' then private.workflow_search_text(candidate_name) end asc,
   case when v_sort='followup_asc' then (select min(task.due_at) from public.workflow_tasks task where task.organization_id=p_org and task.state='open'
    and ((p_kind='bids' and task.bid_id=filtered.id and task.interview_id is null) or (p_kind='interviews' and task.interview_id=filtered.id and task.bid_id=filtered.bid_id))) end asc nulls last,
   case when v_sort='submitted_desc' then submitted_at end desc nulls last,
   case when v_sort='scheduled_asc' then scheduled_at end asc nulls last,
   case when v_sort='scheduled_desc' then scheduled_at end desc nulls last,id
  limit v_size offset (v_page-1)*v_size
 )
 select jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('record',record,'candidateName',candidate_name,'companyName',company_name,'jobTitle',job_title,'ownerName',owner_name,'teamName',team_name)) from page),'[]'::jsonb),
  'total',(select count(*) from filtered),'page',v_page,'pageSize',v_size,'asOf',v_now,
  'options',jsonb_build_object(
   'candidates',(select coalesce(jsonb_agg(jsonb_build_object('value',candidate_id,'label',coalesce(candidate_name,'Candidate '||candidate_id::text)) order by candidate_name,candidate_id),'[]'::jsonb) from (select distinct candidate_id,candidate_name from scoped) o),
   'companies',(select coalesce(jsonb_agg(jsonb_build_object('value',company,'label',company_label) order by company),'[]'::jsonb) from (select private.workflow_search_text(company_name) company,min(company_name) company_label from scoped group by private.workflow_search_text(company_name)) o),
   'owners',(select coalesce(jsonb_agg(jsonb_build_object('value',owner_id,'label',coalesce(owner_name,'Owner '||owner_id::text)) order by owner_name,owner_id),'[]'::jsonb) from (select distinct owner_id,owner_name from scoped where owner_id is not null) o),
   'teams',(select coalesce(jsonb_agg(jsonb_build_object('value',team_id,'label',coalesce(team_name,'Team '||team_id::text)) order by team_name,team_id),'[]'::jsonb) from (select distinct team_id,team_name from scoped) o),
   'types',(select coalesce(jsonb_agg(jsonb_build_object('value',interview_type,'label',interview_type) order by interview_type),'[]'::jsonb) from (select distinct interview_type from scoped where coalesce(interview_type,'')<>'') o),
   'rounds',(select coalesce(jsonb_agg(jsonb_build_object('value',round_number::text,'label',round_number::text) order by round_number),'[]'::jsonb) from (select distinct round_number from scoped where round_number is not null) o))) into v_result;
 return v_result;
end $$;
revoke all on function public.search_workflow(uuid,text,jsonb) from public,anon;
grant execute on function public.search_workflow(uuid,text,jsonb) to authenticated;
commit;
