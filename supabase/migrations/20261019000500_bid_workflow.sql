begin;
alter table public.bids drop constraint bids_status_check;
alter table public.bids add constraint bids_status_check check(status in ('draft','resume_preparation','ready_for_review','needs_changes','approved','submitted','awaiting_response','shortlisted','interview_invited','on_hold','rejected','withdrawn','expired','offer','closed'));
alter table public.bids
 add column job_description text not null default '' check(octet_length(job_description)<=204800),
 add column job_url text check(job_url is null or (length(job_url)<=2048 and job_url ~ '^https?://[^[:space:]]+$')),
 add column external_id text check(length(external_id)<=300), add column job_location text check(length(job_location)<=300),
 add column priority text not null default 'normal' check(priority in ('low','normal','high','urgent')),
 add column follow_up_at timestamptz,add column last_contact_at timestamptz,add column notes text not null default '' check(length(notes)<=20000),
 add column outcome text not null default '' check(length(outcome)<=4000),add column submitted_at timestamptz,
 add column resume_document_id uuid,add column cover_letter_document_id uuid,add column resume_version_id uuid,add column cover_letter_version_id uuid,
 add column held_from_status text,add column current_approval_id uuid,add column content_revision bigint not null default 1,
 add column content_hash text not null default '',add column prepared_by uuid references public.users(id),
 add foreign key(organization_id,candidate_id,resume_document_id) references public.documents(organization_id,candidate_id,id),
 add foreign key(organization_id,candidate_id,cover_letter_document_id) references public.documents(organization_id,candidate_id,id),
 add foreign key(organization_id,candidate_id,resume_version_id) references public.resume_versions(organization_id,candidate_id,id),
 add foreign key(organization_id,candidate_id,cover_letter_version_id) references public.cover_letter_versions(organization_id,candidate_id,id);
alter table public.bid_access_grants drop constraint bid_access_grants_capability_check;
alter table public.bid_access_grants add constraint bid_access_grants_capability_check check(capability in ('bid.prepare','bid.submit','document.read','document.export'));
-- Explicitly accepted D04 defaults; policy changes are versioned and admin-only.
update public.teams set approval_policy='{"required":true,"coverLetterRequired":false,"version":1}' where approval_policy is null;
alter table public.teams alter column approval_policy set default '{"required":true,"coverLetterRequired":false,"version":1}';
alter table public.teams add constraint workflow_policy_shape check(approval_policy is null or (jsonb_typeof(approval_policy)='object' and jsonb_typeof(approval_policy->'required')='boolean' and jsonb_typeof(approval_policy->'coverLetterRequired')='boolean' and coalesce((approval_policy->>'version')::integer,0)>0));

create table public.workflow_operations(organization_id uuid not null references public.organizations(id),operation_id uuid not null,actor_id uuid not null references public.users(id),bid_id uuid not null,
 request_hash text not null,result jsonb not null,created_at timestamptz not null default now(),primary key(organization_id,operation_id),foreign key(organization_id,bid_id) references public.bids(organization_id,id));
create table public.bid_revisions(id uuid primary key default gen_random_uuid(),organization_id uuid not null,bid_id uuid not null,revision bigint not null,snapshot jsonb not null,created_by uuid references public.users(id),created_at timestamptz not null default now(),unique(bid_id,revision),foreign key(organization_id,bid_id) references public.bids(organization_id,id));
create table public.bid_status_history(id uuid primary key default gen_random_uuid(),organization_id uuid not null,bid_id uuid not null,from_status text,to_status text not null,reason text not null,actor_id uuid references public.users(id),request_id uuid not null,created_at timestamptz not null default now(),foreign key(organization_id,bid_id) references public.bids(organization_id,id));
create table public.bid_approvals(id uuid primary key default gen_random_uuid(),organization_id uuid not null,bid_id uuid not null,candidate_id uuid not null,decision text not null check(decision in ('approved','needs_changes')),
 content_hash text not null,job_snapshot jsonb not null,resume_document_id uuid,cover_letter_document_id uuid,resume_version_id uuid,cover_letter_version_id uuid,policy_snapshot jsonb not null,
 reviewer_id uuid not null references public.users(id),override_reason text,reason text not null,created_at timestamptz not null default now(),unique(organization_id,bid_id,id),
 foreign key(organization_id,bid_id,candidate_id) references public.bids(organization_id,id,candidate_id),
 foreign key(organization_id,candidate_id,resume_document_id) references public.documents(organization_id,candidate_id,id),foreign key(organization_id,candidate_id,cover_letter_document_id) references public.documents(organization_id,candidate_id,id),
 foreign key(organization_id,candidate_id,resume_version_id) references public.resume_versions(organization_id,candidate_id,id),foreign key(organization_id,candidate_id,cover_letter_version_id) references public.cover_letter_versions(organization_id,candidate_id,id));
create table public.bid_approval_invalidations(id uuid primary key default gen_random_uuid(),organization_id uuid not null,bid_id uuid not null,approval_id uuid not null,reason text not null,actor_id uuid not null references public.users(id),created_at timestamptz not null default now(),foreign key(organization_id,bid_id,approval_id) references public.bid_approvals(organization_id,bid_id,id));
alter table public.bids add foreign key(organization_id,id,current_approval_id) references public.bid_approvals(organization_id,bid_id,id);
create table public.bid_submissions(id uuid primary key default gen_random_uuid(),organization_id uuid not null,bid_id uuid not null,candidate_id uuid not null,operation_id uuid not null,
 content_hash text not null,job_snapshot jsonb not null,policy_snapshot jsonb not null,approval_id uuid,resume_document_id uuid not null,cover_letter_document_id uuid,resume_version_id uuid not null,cover_letter_version_id uuid,
 submitted_at timestamptz not null,confirmation text not null,attested boolean not null,actor_id uuid not null references public.users(id),created_at timestamptz not null default now(),unique(organization_id,operation_id),
 foreign key(organization_id,bid_id,candidate_id) references public.bids(organization_id,id,candidate_id),foreign key(organization_id,bid_id,approval_id) references public.bid_approvals(organization_id,bid_id,id),
 foreign key(organization_id,candidate_id,resume_document_id) references public.documents(organization_id,candidate_id,id),foreign key(organization_id,candidate_id,cover_letter_document_id) references public.documents(organization_id,candidate_id,id),
 foreign key(organization_id,candidate_id,resume_version_id) references public.resume_versions(organization_id,candidate_id,id),foreign key(organization_id,candidate_id,cover_letter_version_id) references public.cover_letter_versions(organization_id,candidate_id,id));
create index bids_scope_status on public.bids(organization_id,team_id,status,updated_at desc);
create index bids_candidate on public.bids(organization_id,candidate_id,created_at desc);
create index submissions_bid on public.bid_submissions(organization_id,bid_id,created_at desc);

do $$ declare t text; begin foreach t in array array['workflow_operations','bid_revisions','bid_status_history','bid_approvals','bid_approval_invalidations','bid_submissions'] loop
 execute format('alter table public.%I enable row level security',t);execute format('alter table public.%I force row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant select on public.%I to authenticated,app_command',t);execute format('grant insert on public.%I to app_command',t);
 execute format('create policy visible on public.%I for select to authenticated using(private.reads_bid(organization_id,bid_id))',t);
 execute format('create policy command_read on public.%I for select to app_command using(private.org_role(organization_id) is not null)',t);
 execute format('create policy command_insert on public.%I for insert to app_command with check(private.reads_bid(organization_id,bid_id))',t);
 execute format('create trigger immutable before update or delete on public.%I for each row execute function private.immutable_revision()',t);
 end loop;end $$;
alter policy visible on public.workflow_operations using(actor_id=private.actor_id() and private.reads_bid(organization_id,bid_id));
grant update on public.bids to app_command;
create policy command_update on public.bids for update to app_command using(private.reads_bid(organization_id,id)) with check(private.reads_bid(organization_id,id));
-- Include submit-only bid grants in read scope; they do not expose profiles.
create or replace function private.reads_bid(p_org uuid,p_bid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.bids b where b.organization_id=p_org and b.id=p_bid and (private.manages_team(p_org,b.team_id) or
 (private.org_role(p_org)='team_member' and private.in_team(p_org,b.team_id) and private.reads_candidate(p_org,b.candidate_id)) or exists(select 1 from private.bidder_grants(p_org,b.candidate_id,b.id,'bid.prepare')) or exists(select 1 from private.bidder_grants(p_org,b.candidate_id,b.id,'bid.submit'))))
$$;
grant create on schema private to app_permission_reader;
create function private.workflow_owner(p_org uuid,p_candidate uuid,p_team uuid,p_owner uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.organization_memberships m where m.organization_id=p_org and m.user_id=p_owner and m.state='active' and exists(select 1 from public.users u where u.id=m.user_id and u.status='active') and
 (m.role='admin' or exists(select 1 from public.team_memberships tm where tm.organization_id=p_org and tm.team_id=p_team and tm.user_id=p_owner and tm.role=m.role and tm.active and
 (m.role='team_leader' or m.role='bidder' or (m.role='team_member' and exists(select 1 from public.candidate_assignments a where a.organization_id=p_org and a.candidate_id=p_candidate and a.team_id=p_team and a.user_id=p_owner and a.ended_at is null and a.active_from<=now()))))))
$$;
alter function private.workflow_owner(uuid,uuid,uuid,uuid) owner to app_permission_reader;
create function private.workflow_active(p_org uuid,p_candidate uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.candidates c where c.organization_id=p_org and c.id=p_candidate and c.status<>'archived' and exists(select 1 from public.teams t where t.organization_id=p_org and t.id=c.owning_team_id and t.status='active')) $$;
alter function private.workflow_active(uuid,uuid) owner to app_permission_reader;
grant select(prepared_by,created_by,resume_version_id,cover_letter_version_id) on public.bids to app_permission_reader;
grant select(id,organization_id,candidate_id,created_by) on public.resume_versions,public.cover_letter_versions to app_permission_reader;
create policy author_reader on public.resume_versions for select to app_permission_reader using(true);
create policy author_reader on public.cover_letter_versions for select to app_permission_reader using(true);
create function private.package_authors(p_org uuid,p_bid uuid) returns uuid[] language sql stable security definer set search_path='' as $$
 select array[b.owner_id,b.prepared_by,b.created_by,(select r.created_by from public.resume_versions r where r.organization_id=p_org and r.id=b.resume_version_id),(select l.created_by from public.cover_letter_versions l where l.organization_id=p_org and l.id=b.cover_letter_version_id)] from public.bids b where b.organization_id=p_org and b.id=p_bid
$$;
alter function private.package_authors(uuid,uuid) owner to app_permission_reader;
revoke create on schema private from app_permission_reader;
revoke all on function private.workflow_owner(uuid,uuid,uuid,uuid),private.workflow_active(uuid,uuid),private.package_authors(uuid,uuid) from public;
grant execute on function private.workflow_owner(uuid,uuid,uuid,uuid),private.workflow_active(uuid,uuid),private.package_authors(uuid,uuid) to app_command;

create function private.bid_content(b public.bids) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('candidateId',b.candidate_id,'teamId',b.team_id,'ownerId',b.owner_id,'companyName',b.company_name,'jobTitle',b.job_title,'jobDescription',b.job_description,'jobUrl',b.job_url,'externalId',b.external_id,'jobLocation',b.job_location,'resumeDocumentId',b.resume_document_id,'coverLetterDocumentId',b.cover_letter_document_id,'resumeVersionId',b.resume_version_id,'coverLetterVersionId',b.cover_letter_version_id)
$$;
revoke all on function private.bid_content(public.bids) from public;grant execute on function private.bid_content(public.bids) to app_command;
update public.bids b set prepared_by=created_by,content_hash=encode(sha256(convert_to(private.bid_content(b)::text,'UTF8')),'hex');
alter table public.bids alter column prepared_by set not null;
create function private.workflow_replay(p_org uuid,p_operation uuid,p_payload jsonb) returns jsonb language plpgsql set search_path='' as $$
declare o public.workflow_operations;begin
 if p_operation is null then raise exception 'INVALID_OPERATION' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||p_operation::text,0));
 select * into o from public.workflow_operations where organization_id=p_org and operation_id=p_operation;
 if found then if o.actor_id<>private.actor_id() or o.request_hash<>encode(sha256(convert_to(p_payload::text,'UTF8')),'hex') then raise exception 'KEY_PAYLOAD_MISMATCH' using errcode='22023';end if;return o.result;end if;return null;
end $$;
create function private.workflow_finish(p_org uuid,p_bid uuid,p_operation uuid,p_payload jsonb,p_result jsonb) returns jsonb language plpgsql set search_path='' as $$ begin
 insert into public.workflow_operations(organization_id,operation_id,actor_id,bid_id,request_hash,result) values(p_org,p_operation,private.actor_id(),p_bid,encode(sha256(convert_to(p_payload::text,'UTF8')),'hex'),p_result);return p_result;end $$;
revoke all on function private.workflow_replay(uuid,uuid,jsonb),private.workflow_finish(uuid,uuid,uuid,jsonb,jsonb) from public;
grant execute on function private.workflow_replay(uuid,uuid,jsonb),private.workflow_finish(uuid,uuid,uuid,jsonb,jsonb) to app_command;
create function private.record_bid_change(p_org uuid,p_bid uuid,p_from text,p_to text,p_reason text,p_request uuid) returns void language plpgsql set search_path='' as $$ begin
 if p_from is distinct from p_to then insert into public.bid_status_history(organization_id,bid_id,from_status,to_status,reason,actor_id,request_id) values(p_org,p_bid,p_from,p_to,p_reason,private.actor_id(),p_request);end if;
 insert into public.bid_revisions(organization_id,bid_id,revision,snapshot,created_by) select p_org,p_bid,row_version,to_jsonb(b),private.actor_id() from public.bids b where organization_id=p_org and id=p_bid;
end $$;
revoke all on function private.record_bid_change(uuid,uuid,text,text,text,uuid) from public;grant execute on function private.record_bid_change(uuid,uuid,text,text,text,uuid) to app_command;
-- Baseline existing drafts honestly, without inventing earlier transitions.
insert into public.bid_revisions(organization_id,bid_id,revision,snapshot,created_by) select organization_id,id,row_version,to_jsonb(b),created_by from public.bids b;
insert into public.bid_status_history(organization_id,bid_id,to_status,reason,actor_id,request_id) select organization_id,id,status,'Migration baseline of existing state',created_by,gen_random_uuid() from public.bids;

create function private.require_bid_documents(b public.bids,p_policy jsonb) returns void language plpgsql set search_path='' as $$ declare d public.documents;begin
 if b.resume_document_id is null then raise exception 'VERIFIED_DOCUMENTS_REQUIRED' using errcode='22023';end if;
 select * into d from public.documents where organization_id=b.organization_id and candidate_id=b.candidate_id and id=b.resume_document_id and kind='resume' and reviewed;
 if not found or d.resume_version_id is distinct from b.resume_version_id then raise exception 'VERIFIED_DOCUMENTS_REQUIRED' using errcode='22023';end if;
 if private.org_role(b.organization_id)='bidder' and not private.document_access(b.organization_id,d.id,true) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if (p_policy->>'coverLetterRequired')::boolean and b.cover_letter_document_id is null then raise exception 'VERIFIED_DOCUMENTS_REQUIRED' using errcode='22023';end if;
 if b.cover_letter_document_id is not null then
 select * into d from public.documents where organization_id=b.organization_id and candidate_id=b.candidate_id and id=b.cover_letter_document_id and kind='cover_letter' and reviewed;
 if not found or d.cover_letter_version_id is distinct from b.cover_letter_version_id then raise exception 'VERIFIED_DOCUMENTS_REQUIRED' using errcode='22023';end if;
 if private.org_role(b.organization_id)='bidder' and not private.document_access(b.organization_id,d.id,true) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 end if;
end $$;
revoke all on function private.require_bid_documents(public.bids,jsonb) from public;grant execute on function private.require_bid_documents(public.bids,jsonb) to app_command;

create function public.save_bid(p_org uuid,p_bid uuid,p_expected bigint,p_input jsonb,p_operation uuid,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.bids; old public.bids; v_candidate uuid:=(p_input->>'candidateId')::uuid; v_team uuid; v_owner uuid:=(p_input->>'ownerId')::uuid; d public.documents; old_status text; result jsonb;
 payload jsonb:=jsonb_build_object('command','save_bid','bidId',p_bid,'expected',p_expected,'input',p_input);
begin
 if p_bid is null then v_team:=private.candidate_team(p_org,v_candidate);if v_team is null then raise exception 'FORBIDDEN' using errcode='42501';end if;
 else if not private.reads_bid(p_org,p_bid) then raise exception 'FORBIDDEN' using errcode='42501';end if;end if;
 result:=private.workflow_replay(p_org,p_operation,payload);if result is not null then return result;end if;
 if jsonb_typeof(p_input) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_input))<>16 or not p_input ?& array['candidateId','teamId','ownerId','companyName','jobTitle','jobDescription','jobUrl','externalId','jobLocation','priority','followUpAt','lastContactAt','notes','outcome','resumeDocumentId','coverLetterDocumentId'] then raise exception 'INVALID_BID' using errcode='22023';end if;
 if exists(select 1 from jsonb_each(p_input) x where (x.key in ('candidateId','teamId','ownerId','companyName','jobTitle','jobDescription','priority','notes','outcome') and jsonb_typeof(x.value)<>'string') or (x.key in ('jobUrl','externalId','jobLocation','followUpAt','lastContactAt','resumeDocumentId','coverLetterDocumentId') and jsonb_typeof(x.value) not in ('string','null'))) then raise exception 'INVALID_BID' using errcode='22023';end if;
 if p_bid is not null then
 select * into old from public.bids where organization_id=p_org and id=p_bid for update;v_team:=old.team_id;
 if old.row_version is distinct from p_expected then raise exception 'VERSION_CONFLICT' using errcode='40001';end if;
 if old.candidate_id is distinct from v_candidate then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if private.org_role(p_org)='bidder' and not exists(select 1 from private.bidder_grants(p_org,v_candidate,p_bid,'bid.prepare')) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 end if;
 if not private.workflow_active(p_org,v_candidate) then raise exception 'CANDIDATE_ARCHIVED' using errcode='22023';end if;
 if v_team is distinct from (p_input->>'teamId')::uuid or not private.workflow_owner(p_org,v_candidate,v_team,v_owner) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not private.manages_team(p_org,v_team) and v_owner is distinct from coalesce(old.owner_id,private.actor_id()) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if length(btrim(p_input->>'companyName')) not between 1 and 200 or length(btrim(p_input->>'jobTitle')) not between 1 and 200 or octet_length(p_input::text)>524288 then raise exception 'INVALID_BID' using errcode='22023';end if;
 b:=old;b.id:=coalesce(p_bid,gen_random_uuid());b.organization_id:=p_org;b.candidate_id:=v_candidate;b.team_id:=v_team;b.owner_id:=v_owner;
 b.company_name:=p_input->>'companyName';b.job_title:=p_input->>'jobTitle';b.job_description:=p_input->>'jobDescription';b.job_url:=p_input->>'jobUrl';b.external_id:=p_input->>'externalId';b.job_location:=p_input->>'jobLocation';
 b.priority:=p_input->>'priority';b.follow_up_at:=(p_input->>'followUpAt')::timestamptz;b.last_contact_at:=(p_input->>'lastContactAt')::timestamptz;b.notes:=p_input->>'notes';b.outcome:=p_input->>'outcome';
 b.resume_document_id:=(p_input->>'resumeDocumentId')::uuid;b.cover_letter_document_id:=(p_input->>'coverLetterDocumentId')::uuid;b.resume_version_id:=null;b.cover_letter_version_id:=null;
 if b.resume_document_id is not null then select * into d from public.documents where organization_id=p_org and candidate_id=v_candidate and id=b.resume_document_id and kind='resume';if not found then raise exception 'FORBIDDEN' using errcode='42501';end if;b.resume_version_id:=d.resume_version_id;end if;
 if b.cover_letter_document_id is not null then select * into d from public.documents where organization_id=p_org and candidate_id=v_candidate and id=b.cover_letter_document_id and kind='cover_letter';if not found then raise exception 'FORBIDDEN' using errcode='42501';end if;b.cover_letter_version_id:=d.cover_letter_version_id;end if;
 b.content_hash:=encode(sha256(convert_to(private.bid_content(b)::text,'UTF8')),'hex');b.status:=coalesce(old.status,'draft');b.content_revision:=coalesce(old.content_revision,1);b.prepared_by:=coalesce(old.prepared_by,private.actor_id());
 if old.id is not null and old.content_hash<>b.content_hash then
 if old.status not in ('draft','resume_preparation','ready_for_review','needs_changes','approved','on_hold') and (private.bid_content(old)-'ownerId') is distinct from (private.bid_content(b)-'ownerId') then raise exception 'BID_CONTENT_FROZEN' using errcode='22023';end if;
 b.content_revision:=old.content_revision+1;b.prepared_by:=private.actor_id();b.current_approval_id:=null;
 if old.current_approval_id is not null then insert into public.bid_approval_invalidations(organization_id,bid_id,approval_id,reason,actor_id) values(p_org,b.id,old.current_approval_id,'Job, ownership or selected documents changed',private.actor_id());end if;
 if b.status in ('approved','ready_for_review') then b.status:='resume_preparation';end if;
 end if;
 if old.id is null then
 if p_expected is distinct from 0 then raise exception 'VERSION_CONFLICT' using errcode='40001';end if;
 insert into public.bids(id,organization_id,candidate_id,team_id,owner_id,company_name,job_title,job_description,job_url,external_id,job_location,priority,follow_up_at,last_contact_at,notes,outcome,resume_document_id,cover_letter_document_id,resume_version_id,cover_letter_version_id,content_hash,prepared_by,created_by)
 values(b.id,p_org,v_candidate,v_team,v_owner,b.company_name,b.job_title,b.job_description,b.job_url,b.external_id,b.job_location,b.priority,b.follow_up_at,b.last_contact_at,b.notes,b.outcome,b.resume_document_id,b.cover_letter_document_id,b.resume_version_id,b.cover_letter_version_id,b.content_hash,b.prepared_by,private.actor_id());
 else update public.bids set owner_id=b.owner_id,company_name=b.company_name,job_title=b.job_title,job_description=b.job_description,job_url=b.job_url,external_id=b.external_id,job_location=b.job_location,priority=b.priority,follow_up_at=b.follow_up_at,last_contact_at=b.last_contact_at,notes=b.notes,outcome=b.outcome,resume_document_id=b.resume_document_id,cover_letter_document_id=b.cover_letter_document_id,resume_version_id=b.resume_version_id,cover_letter_version_id=b.cover_letter_version_id,content_hash=b.content_hash,content_revision=b.content_revision,prepared_by=b.prepared_by,current_approval_id=b.current_approval_id,status=b.status,row_version=row_version+1,updated_at=now() where organization_id=p_org and id=b.id;end if;
 perform private.record_bid_change(p_org,b.id,old.status,b.status,case when old.id is null then 'Bid created' else 'Bid edited; any changed approval invalidated' end,p_request);
 perform private.audit(p_org,case when old.id is null then 'bid.created' else 'bid.updated' end,b.id,p_request,v_team);
 return private.workflow_finish(p_org,b.id,p_operation,payload,jsonb_build_object('id',b.id,'rowVersion',coalesce(old.row_version,0)+1));
end $$;

create function public.transition_bid(p_org uuid,p_bid uuid,p_expected bigint,p_input jsonb,p_operation uuid,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.bids; a public.bid_approvals; pol jsonb; target text:=p_input->>'status'; old_status text; result jsonb; v_team uuid; v_approval uuid; v_submit uuid;
 payload jsonb:=jsonb_build_object('command','transition_bid','bidId',p_bid,'expected',p_expected,'input',p_input); reason text:=btrim(p_input->>'reason'); override_reason text:=btrim(p_input->>'adminOverrideReason'); v_held text;
begin
 if not private.reads_bid(p_org,p_bid) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select team_id into v_team from public.bids where organization_id=p_org and id=p_bid;
 perform pg_advisory_xact_lock(hashtextextended('workflow-policy:'||p_org::text||v_team::text,0));
 result:=private.workflow_replay(p_org,p_operation,payload);if result is not null then return result;end if;
 if jsonb_typeof(p_input) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_input))<>7 or not p_input ?& array['status','reason','submittedAt','confirmation','attested','adminOverrideReason','reopen'] or octet_length(p_input::text)>32768 or exists(select 1 from jsonb_each(p_input) x where (x.key in ('status','reason','confirmation','adminOverrideReason') and jsonb_typeof(x.value)<>'string') or (x.key in ('attested','reopen') and jsonb_typeof(x.value)<>'boolean') or (x.key='submittedAt' and jsonb_typeof(x.value) not in ('string','null'))) then raise exception 'INVALID_TRANSITION_REQUEST' using errcode='22023';end if;
 select * into b from public.bids where organization_id=p_org and id=p_bid for update;
 if b.row_version is distinct from p_expected then raise exception 'VERSION_CONFLICT' using errcode='40001';end if;
 if not private.workflow_active(p_org,b.candidate_id) then raise exception 'CANDIDATE_ARCHIVED' using errcode='22023';end if;
 if not private.manages_team(p_org,b.team_id) and b.owner_id<>private.actor_id() and not (private.org_role(p_org)='bidder' and (exists(select 1 from private.bidder_grants(p_org,b.candidate_id,p_bid,'bid.prepare')) or (target='submitted' and exists(select 1 from private.bidder_grants(p_org,b.candidate_id,p_bid,'bid.submit'))))) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 old_status:=b.status;v_held:=b.held_from_status;v_approval:=b.current_approval_id;
 select approval_policy into pol from public.teams where organization_id=p_org and id=b.team_id;
 if pol is null then raise exception 'WORKFLOW_POLICY_REQUIRED' using errcode='22023';end if;
 if (p_input->>'reopen')::boolean then
 if private.org_role(p_org)<>'admin' or old_status not in ('closed','rejected','withdrawn','expired') or target<>'resume_preparation' or coalesce(length(reason),0)=0 then raise exception 'FORBIDDEN' using errcode='42501';end if;
 v_approval:=null;v_held:=null;
 elsif old_status='on_hold' and target=v_held then
 if target='approved' then select * into a from public.bid_approvals where organization_id=p_org and bid_id=p_bid and id=v_approval;
 if not found or a.content_hash<>b.content_hash or a.policy_snapshot<>pol then target:='resume_preparation';v_approval:=null;end if;end if;
 else
 if not (case old_status
 when 'draft' then target in ('resume_preparation','withdrawn','expired')
 when 'resume_preparation' then target in ('ready_for_review','submitted','on_hold','withdrawn')
 when 'ready_for_review' then target in ('approved','needs_changes','on_hold','withdrawn')
 when 'needs_changes' then target in ('resume_preparation','ready_for_review','withdrawn')
 when 'approved' then target in ('submitted','resume_preparation','on_hold','withdrawn')
 when 'submitted' then target in ('awaiting_response','shortlisted','interview_invited','rejected','offer','withdrawn','closed')
 when 'awaiting_response' then target in ('shortlisted','interview_invited','on_hold','rejected','expired','offer','withdrawn','closed')
 when 'shortlisted' then target in ('interview_invited','offer','on_hold','rejected','withdrawn','closed')
 when 'interview_invited' then target in ('offer','on_hold','rejected','withdrawn','closed')
 when 'offer' then target in ('closed','rejected','withdrawn') when 'on_hold' then target in ('withdrawn','expired','closed')
 when 'rejected' then target='closed' when 'withdrawn' then target='closed' when 'expired' then target='closed' else false end) then raise exception 'INVALID_BID_TRANSITION' using errcode='22023';end if;
 end if;
 if coalesce(length(reason),0)=0 or length(reason)>4000 then raise exception 'TRANSITION_REASON_REQUIRED' using errcode='22023';end if;
 if target in ('ready_for_review','approved','submitted') then perform private.require_bid_documents(b,pol);end if;
 if target in ('approved','needs_changes') then
 if not private.manages_team(p_org,b.team_id) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if target='approved' and private.actor_id()=any(private.package_authors(p_org,p_bid)) and not (private.org_role(p_org)='admin' and coalesce(length(override_reason),0)>0) then raise exception 'SELF_APPROVAL_FORBIDDEN' using errcode='42501';end if;
 if length(coalesce(override_reason,''))>4000 then raise exception 'INVALID_OVERRIDE_REASON' using errcode='22023';end if;
 insert into public.bid_approvals(organization_id,bid_id,candidate_id,decision,content_hash,job_snapshot,resume_document_id,cover_letter_document_id,resume_version_id,cover_letter_version_id,policy_snapshot,reviewer_id,override_reason,reason)
 values(p_org,p_bid,b.candidate_id,target,b.content_hash,private.bid_content(b),b.resume_document_id,b.cover_letter_document_id,b.resume_version_id,b.cover_letter_version_id,pol,private.actor_id(),nullif(override_reason,''),reason) returning id into v_approval;
 end if;
 if target='submitted' then
 if private.org_role(p_org)='bidder' and not exists(select 1 from private.bidder_grants(p_org,b.candidate_id,p_bid,'bid.submit')) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if (pol->>'required')::boolean then
 select * into a from public.bid_approvals where organization_id=p_org and bid_id=p_bid and id=v_approval and decision='approved';
 if not found or a.content_hash<>b.content_hash or a.policy_snapshot<>pol or a.resume_document_id is distinct from b.resume_document_id or a.cover_letter_document_id is distinct from b.cover_letter_document_id then raise exception 'APPROVAL_REQUIRED' using errcode='22023';end if;
 end if;
 if p_input->>'submittedAt' is null or (p_input->>'submittedAt')::timestamptz>now()+interval '5 minutes' or (coalesce(length(btrim(p_input->>'confirmation')),0)=0 and coalesce((p_input->>'attested')::boolean,false)=false) then raise exception 'SUBMISSION_ATTESTATION_REQUIRED' using errcode='22023';end if;
 insert into public.bid_submissions(organization_id,bid_id,candidate_id,operation_id,content_hash,job_snapshot,policy_snapshot,approval_id,resume_document_id,cover_letter_document_id,resume_version_id,cover_letter_version_id,submitted_at,confirmation,attested,actor_id)
 values(p_org,p_bid,b.candidate_id,p_operation,b.content_hash,private.bid_content(b),pol,case when (pol->>'required')::boolean then v_approval else null end,b.resume_document_id,b.cover_letter_document_id,b.resume_version_id,b.cover_letter_version_id,(p_input->>'submittedAt')::timestamptz,p_input->>'confirmation',(p_input->>'attested')::boolean,private.actor_id()) returning id into v_submit;
 elsif old_status in ('submitted','awaiting_response','shortlisted','interview_invited','offer') and not exists(select 1 from public.bid_submissions where organization_id=p_org and bid_id=p_bid) then raise exception 'SUBMISSION_REQUIRED' using errcode='22023';end if;
 if target in ('awaiting_response','shortlisted','interview_invited','offer') and not exists(select 1 from public.bid_submissions where organization_id=p_org and bid_id=p_bid) then raise exception 'SUBMISSION_REQUIRED' using errcode='22023';end if;
 if target='on_hold' then v_held:=old_status;elsif old_status='on_hold' then v_held:=null;end if;
 if target='resume_preparation' then v_approval:=null;end if;
 update public.bids set status=target,held_from_status=v_held,current_approval_id=v_approval,submitted_at=case when target='submitted' then (p_input->>'submittedAt')::timestamptz else submitted_at end,row_version=row_version+1,updated_at=now() where organization_id=p_org and id=p_bid;
 perform private.record_bid_change(p_org,p_bid,old_status,target,reason,p_request);
 perform private.audit(p_org,case when (p_input->>'reopen')::boolean then 'bid.reopened' when target='submitted' then 'bid.submitted' when target in ('approved','needs_changes') then 'bid.reviewed' else 'bid.transitioned' end,p_bid,p_request,b.team_id,jsonb_build_object('from',old_status,'to',target,'adminOverride',coalesce(length(override_reason),0)>0));
 return private.workflow_finish(p_org,p_bid,p_operation,payload,jsonb_build_object('id',p_bid,'rowVersion',b.row_version+1,'submissionId',v_submit,'approvalId',v_approval));
end $$;

create function public.set_team_workflow_policy(p_org uuid,p_team uuid,p_expected bigint,p_required boolean,p_letter boolean,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.teams; b public.bids; v_from text;begin
 if private.org_role(p_org)<>'admin' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('workflow-policy:'||p_org::text||p_team::text,0));
 select * into t from public.teams where organization_id=p_org and id=p_team for update;
 if not found then raise exception 'FORBIDDEN' using errcode='42501';end if;if t.row_version is distinct from p_expected then raise exception 'VERSION_CONFLICT' using errcode='40001';end if;
 if p_required is null or p_letter is null then raise exception 'INVALID_POLICY' using errcode='22023';end if;
 update public.teams set approval_policy=jsonb_build_object('required',p_required,'coverLetterRequired',p_letter,'version',coalesce((t.approval_policy->>'version')::integer,0)+1),row_version=row_version+1 where organization_id=p_org and id=p_team;
 for b in select * from public.bids where organization_id=p_org and team_id=p_team and current_approval_id is not null for update loop
 insert into public.bid_approval_invalidations(organization_id,bid_id,approval_id,reason,actor_id) values(p_org,b.id,b.current_approval_id,'Team workflow policy changed',private.actor_id());v_from:=b.status;
 update public.bids set current_approval_id=null,status=case when status='approved' then 'resume_preparation' else status end,row_version=row_version+1,updated_at=now() where organization_id=p_org and id=b.id;
 perform private.record_bid_change(p_org,b.id,v_from,case when v_from='approved' then 'resume_preparation' else v_from end,'Team workflow policy changed',p_request);end loop;
 perform private.audit(p_org,'team.workflow_policy_changed',p_team,p_request,p_team);return jsonb_build_object('rowVersion',t.row_version+1);
end $$;
-- Historical signature remains a compatibility adapter; all writes use commands.
create or replace function public.create_draft_bid(p_org uuid,p_candidate uuid,p_company text,p_title text,p_request uuid) returns uuid language plpgsql security definer set search_path='' as $$
begin return (public.save_bid(p_org,null,0,jsonb_build_object('candidateId',p_candidate,'teamId',private.candidate_team(p_org,p_candidate),'ownerId',private.actor_id(),'companyName',p_company,'jobTitle',p_title,'jobDescription','','jobUrl',null,'externalId',null,'jobLocation',null,'priority','normal','followUpAt',null,'lastContactAt',null,'notes','','outcome','','resumeDocumentId',null,'coverLetterDocumentId',null),gen_random_uuid(),p_request)->>'id')::uuid;end $$;
grant create on schema public to app_command;
alter function public.save_bid(uuid,uuid,bigint,jsonb,uuid,uuid) owner to app_command;
alter function public.transition_bid(uuid,uuid,bigint,jsonb,uuid,uuid) owner to app_command;
alter function public.set_team_workflow_policy(uuid,uuid,bigint,boolean,boolean,uuid) owner to app_command;
revoke create on schema public from app_command;
revoke all on function public.save_bid(uuid,uuid,bigint,jsonb,uuid,uuid),public.transition_bid(uuid,uuid,bigint,jsonb,uuid,uuid),public.set_team_workflow_policy(uuid,uuid,bigint,boolean,boolean,uuid) from public,anon;
grant execute on function public.save_bid(uuid,uuid,bigint,jsonb,uuid,uuid),public.transition_bid(uuid,uuid,bigint,jsonb,uuid,uuid),public.set_team_workflow_policy(uuid,uuid,bigint,boolean,boolean,uuid) to authenticated;
-- Command-only access to policy and safe document metadata for bidder submission.
create policy workflow_policy_read on public.teams for select to app_command using(private.in_team(organization_id,id));
grant execute on function private.document_access(uuid,uuid,boolean) to app_command;
commit;
