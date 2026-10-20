begin;
-- Invoker only: no service identity, new reader role or widened table grants.
-- Every count and drill-down is derived from the SAME materialized scoped rows.
create function public.operational_dashboard(p_org uuid,p_filters jsonb default '{}'::jsonb,p_metric text default 'active_bids',p_page integer default 1)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_role text:=private.org_role(p_org); v_now timestamptz:=statement_timestamp(); v_from timestamptz; v_to timestamptz; v_end timestamptz; v_result jsonb;
begin
 if v_role is null then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if jsonb_typeof(p_filters) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_filters) k where k not in ('teamId','ownerId','status','company','from','to','windowDays'))
 or p_page is null or p_page not between 1 and 100000 or p_metric is null or p_metric not in ('active_candidates','active_bids','awaiting_review','awaiting_response','draft_bids','document_work','pending_offers','open_tasks','overdue_followups','upcoming_interviews','pending_feedback','submitted','interview_converted','offer_converted','all_bids')
 then raise exception 'INVALID_REPORT' using errcode='22023';end if;
 if v_role='bidder' and p_metric in ('active_candidates','document_work','upcoming_interviews','pending_feedback','interview_converted') then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if length(coalesce(p_filters->>'company',''))>200 or coalesce(p_filters->>'windowDays','30') !~ '^[0-9]{1,2}$'
 or coalesce((p_filters->>'windowDays')::integer,30) not between 1 and 90
 or (p_filters ? 'status' and p_filters->>'status' not in ('draft','resume_preparation','ready_for_review','needs_changes','approved','submitted','awaiting_response','shortlisted','interview_invited','on_hold','rejected','withdrawn','expired','offer','closed'))
 then raise exception 'INVALID_REPORT' using errcode='22023';end if;
 -- UTC calendar submission cohort, inclusive start/end dates in the UI.
 v_from:=coalesce((p_filters->>'from')::date,(v_now at time zone 'UTC')::date-30)::timestamp at time zone 'UTC';
 v_to:=(coalesce((p_filters->>'to')::date,(v_now at time zone 'UTC')::date)+1)::timestamp at time zone 'UTC';
 if v_to<=v_from or v_to-v_from>interval '3660 days' then raise exception 'INVALID_REPORT' using errcode='22023';end if;
 v_end:=v_now+make_interval(days=>coalesce((p_filters->>'windowDays')::integer,30));
 with bids as materialized (
  select b.* from public.bids b where b.organization_id=p_org
   and (v_role<>'bidder' or b.owner_id=private.actor_id() or b.created_by=private.actor_id())
   and (not p_filters ? 'teamId' or b.team_id=(p_filters->>'teamId')::uuid)
   and (not p_filters ? 'ownerId' or b.owner_id=(p_filters->>'ownerId')::uuid)
   and (not p_filters ? 'status' or b.status=p_filters->>'status')
   and (not p_filters ? 'company' or position(lower(p_filters->>'company') in lower(b.company_name))>0)
 ), candidates as materialized (
  select c.* from public.candidates c where c.organization_id=p_org and c.status<>'archived' and v_role<>'bidder'
   and (not p_filters ? 'teamId' or c.owning_team_id=(p_filters->>'teamId')::uuid)
   and (not p_filters ? 'ownerId' or c.owner_id=(p_filters->>'ownerId')::uuid or exists(select 1 from public.candidate_assignments a where a.organization_id=p_org and a.candidate_id=c.id and a.user_id=(p_filters->>'ownerId')::uuid and a.ended_at is null and a.active_from<=v_now))
   and (not (p_filters ? 'status' or p_filters ? 'company') or exists(select 1 from bids b where b.candidate_id=c.id))
 ), interviews as materialized (
  select i.* from public.interviews i join bids b on b.id=i.bid_id where i.organization_id=p_org and v_role<>'bidder'
 ), tasks as materialized (
  select t.* from public.workflow_tasks t join bids b on b.id=t.bid_id where t.organization_id=p_org and t.state='open'
 ), cohort as materialized (
  select b.* from bids b where exists(select 1 from public.bid_submissions s where s.organization_id=p_org and s.bid_id=b.id and s.submitted_at>=v_from and s.submitted_at<v_to and s.submitted_at<=v_now)
 ), rows as materialized (
  select 'bid'::text kind,b.id,b.id bid_id,b.candidate_id,b.team_id,b.owner_id,b.company_name||' · '||b.job_title label,b.status,b.follow_up_at due_at,null::text timezone,b.updated_at,
   array_remove(array['all_bids',case when b.status not in ('rejected','withdrawn','expired','closed') then 'active_bids' end,
    case when b.status='ready_for_review' then 'awaiting_review' end,case when b.status in ('submitted','awaiting_response') then 'awaiting_response' end,
    case when b.status='draft' then 'draft_bids' end,case when b.status in ('resume_preparation','needs_changes') and v_role<>'bidder' then 'document_work' end,
    case when b.status='offer' then 'pending_offers' end,
    case when exists(select 1 from cohort c where c.id=b.id) then 'submitted' end,
    case when v_role<>'bidder' and exists(select 1 from cohort c where c.id=b.id) and
      (exists(select 1 from public.bid_status_history h where h.organization_id=p_org and h.bid_id=b.id and h.to_status='interview_invited' and h.created_at<=v_now)
       or exists(select 1 from interviews i where i.bid_id=b.id and i.scheduled_at is not null)) then 'interview_converted' end,
    case when exists(select 1 from cohort c where c.id=b.id) and exists(select 1 from public.bid_status_history h where h.organization_id=p_org and h.bid_id=b.id and h.to_status='offer' and h.created_at<=v_now) then 'offer_converted' end],null) metrics
   from bids b
  union all
  select 'candidate',c.id,null,c.id,c.owning_team_id,c.owner_id,coalesce(c.full_name,'Untitled draft'),c.status,null,null,c.updated_at,array['active_candidates'] from candidates c
  union all
  select 'task',t.id,t.bid_id,b.candidate_id,b.team_id,t.assignee_id,t.title,t.state,t.due_at,null,t.created_at,
   array_remove(array['open_tasks',case when t.due_at<v_now then 'overdue_followups' end],null) from tasks t join bids b on b.id=t.bid_id
  union all
  select 'interview',i.id,i.bid_id,b.candidate_id,b.team_id,i.owner_id,b.company_name||' · round '||i.round_number,i.lifecycle_status,i.scheduled_at,i.timezone,i.updated_at,
   array_remove(array[case when i.lifecycle_status='scheduled' and i.scheduled_at>=v_now and i.scheduled_at<v_end then 'upcoming_interviews' end,
    case when i.lifecycle_status='feedback_pending' or (i.lifecycle_status='completed' and not exists(select 1 from public.interview_feedback f where f.organization_id=p_org and f.interview_id=i.id)) then 'pending_feedback' end],null)
   from interviews i join bids b on b.id=i.bid_id
 ), metrics as (select m,count(*) n from rows r cross join lateral unnest(r.metrics) m group by m),
 detail as (select * from rows where p_metric=any(metrics)),
 workload as (
  select team_id,owner_id,sum(active_bids) active_bids,sum(open_tasks) open_tasks from (
   select team_id,owner_id,count(*) active_bids,0::bigint open_tasks from bids where status not in ('rejected','withdrawn','expired','closed') group by team_id,owner_id
   union all select b.team_id,t.assignee_id,0,count(*) from tasks t join bids b on b.id=t.bid_id group by b.team_id,t.assignee_id
  ) w group by team_id,owner_id
 )
 select jsonb_build_object('version','operations/1','asOf',v_now,'role',v_role,'filters',p_filters,'cohort',jsonb_build_object('from',v_from,'toExclusive',v_to),'upcomingTo',v_end,
  'counts',(select jsonb_object_agg(k,coalesce((select n from metrics where m=k),0)) from unnest(array['active_bids','awaiting_review','awaiting_response','draft_bids','pending_offers','open_tasks','overdue_followups','submitted','offer_converted','all_bids']||case when v_role='bidder' then array[]::text[] else array['active_candidates','document_work','upcoming_interviews','pending_feedback','interview_converted'] end) k),
  'detail',jsonb_build_object('metric',p_metric,'total',(select count(*) from detail),'page',p_page,'pageSize',25,'items',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'kind',r.kind,'bidId',r.bid_id,'candidateId',r.candidate_id,'teamId',r.team_id,'ownerId',r.owner_id,'label',r.label,'status',r.status,'dueAt',r.due_at,'timezone',r.timezone,'updatedAt',r.updated_at) order by r.due_at nulls last,r.updated_at desc,r.id) from (select * from detail order by due_at nulls last,updated_at desc,id limit 25 offset (p_page-1)*25) r),'[]'::jsonb)),
  'teams',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name) order by t.name,t.id) from public.teams t where t.organization_id=p_org),'[]'::jsonb),
  'workload',coalesce((select jsonb_agg(jsonb_build_object('teamId',team_id,'ownerId',owner_id,'activeBids',active_bids,'openTasks',open_tasks) order by team_id,owner_id) from workload),'[]'::jsonb),
  'assignments',coalesce((select jsonb_agg(x) from (select c.owning_team_id "teamId",count(*) candidates,count(*) filter(where not exists(select 1 from public.candidate_assignments a where a.organization_id=p_org and a.candidate_id=c.id and a.ended_at is null and a.active_from<=v_now)) unassigned from candidates c group by c.owning_team_id) x),'[]'::jsonb),
  'stages',coalesce((select jsonb_agg(x) from (select status,count(*) bids from bids group by status order by status) x),'[]'::jsonb),
  'interviewProgression',coalesce((select jsonb_agg(x) from (select lifecycle_status lifecycle,outcome,count(*) rounds from interviews group by lifecycle_status,outcome order by lifecycle_status,outcome) x),'[]'::jsonb)) into v_result;
 return v_result;
end $$;
revoke all on function public.operational_dashboard(uuid,jsonb,text,integer) from public,anon;
grant execute on function public.operational_dashboard(uuid,jsonb,text,integer) to authenticated;
create index reporting_submission_cohort on public.bid_submissions(organization_id,submitted_at,bid_id);
create index reporting_status_evidence on public.bid_status_history(organization_id,bid_id,to_status);
commit;
