begin;
-- A dated, device/client-reported outcome is never proof of a file or submission.
grant create on schema private to app_permission_reader;
create function private.operational_team(p_org uuid,p_candidate uuid,p_bid uuid) returns uuid
language sql stable security definer set search_path='' as $$
 select case when private.org_role(p_org) is null then null
 when p_bid is not null then (select b.team_id from public.bids b where b.organization_id=p_org and b.id=p_bid and b.candidate_id=p_candidate
  and (private.reads_bid(p_org,b.id) or exists(select 1 from private.bidder_grants(p_org,p_candidate,b.id,'document.export'))))
 else (select c.owning_team_id from public.candidates c where c.organization_id=p_org and c.id=p_candidate and
  (private.reads_candidate(p_org,c.id) or exists(select 1 from private.bidder_grants(p_org,c.id,null,'bid.prepare')) or exists(select 1 from private.bidder_grants(p_org,c.id,null,'document.export')))) end
$$;
alter function private.operational_team(uuid,uuid,uuid) owner to app_permission_reader;
revoke create on schema private from app_permission_reader;
revoke all on function private.operational_team(uuid,uuid,uuid) from public,anon;
grant execute on function private.operational_team(uuid,uuid,uuid) to authenticated,app_command;

create table public.processing_observations(
 organization_id uuid not null references public.organizations(id),id uuid not null,operation_id uuid not null,actor_id uuid not null references public.users(id),
 candidate_id uuid not null, bid_id uuid,team_id uuid not null,stage text not null check(stage in ('validation','pdfGeneration','localExport','databaseSync','local','database','reconciliation','clipboard')),
 state text not null check(state in ('pending','failed','unknown','conflict','succeeded')),
 code text not null check(code in ('PROCESSING_FAILED','SYNC_UNKNOWN','PERMISSION_DENIED','CONFLICT','RECOVERED','PENDING')),
 request_payload jsonb not null,created_at timestamptz not null default clock_timestamp(),primary key(organization_id,id),
 foreign key(organization_id,candidate_id) references public.candidates(organization_id,id),
 foreign key(organization_id,bid_id,candidate_id) references public.bids(organization_id,id,candidate_id),
 foreign key(organization_id,team_id) references public.teams(organization_id,id));
create index processing_latest on public.processing_observations(organization_id,actor_id,operation_id,stage,created_at desc,id);
alter table public.processing_observations enable row level security;
alter table public.processing_observations force row level security;
revoke all on public.processing_observations from public,anon,authenticated;
grant select on public.processing_observations to authenticated,app_command;
grant insert on public.processing_observations to app_command;
create policy visible on public.processing_observations for select to authenticated using
 (private.operational_team(organization_id,candidate_id,bid_id) is not null and (actor_id=private.actor_id() or private.manages_team(organization_id,team_id)));
create policy command_read on public.processing_observations for select to app_command using
 (private.operational_team(organization_id,candidate_id,bid_id) is not null and (actor_id=private.actor_id() or private.manages_team(organization_id,team_id)));
create policy command_insert on public.processing_observations for insert to app_command with check
 (actor_id=private.actor_id() and private.operational_team(organization_id,candidate_id,bid_id)=team_id);
create trigger immutable before update or delete on public.processing_observations for each row execute function private.immutable_revision();

create table public.operational_notifications(
 organization_id uuid not null references public.organizations(id),id uuid primary key default gen_random_uuid(),recipient_id uuid not null references public.users(id),
 candidate_id uuid not null,bid_id uuid,team_id uuid not null,event_key text not null,title text not null check(title in ('Candidate assignment changed','Processing needs attention','Processing recovered')),
 read_at timestamptz,created_at timestamptz not null default clock_timestamp(),unique(organization_id,recipient_id,event_key),
 foreign key(organization_id,candidate_id) references public.candidates(organization_id,id),
 foreign key(organization_id,bid_id,candidate_id) references public.bids(organization_id,id,candidate_id),foreign key(organization_id,team_id) references public.teams(organization_id,id));
create index operational_inbox on public.operational_notifications(organization_id,recipient_id,created_at desc,id);
alter table public.operational_notifications enable row level security;
alter table public.operational_notifications force row level security;
revoke all on public.operational_notifications from public,anon,authenticated;
grant select on public.operational_notifications to authenticated,app_command;
grant insert,update on public.operational_notifications to app_command;
create policy visible on public.operational_notifications for select to authenticated using
 (recipient_id=private.actor_id() and private.operational_team(organization_id,candidate_id,bid_id) is not null);
create policy command_read on public.operational_notifications for select to app_command using
 (private.operational_team(organization_id,candidate_id,bid_id) is not null and (recipient_id=private.actor_id() or private.manages_team(organization_id,team_id)));
create policy command_insert on public.operational_notifications for insert to app_command with check
 (private.operational_team(organization_id,candidate_id,bid_id)=team_id and (recipient_id=private.actor_id() or private.manages_team(organization_id,team_id)));
create policy command_update on public.operational_notifications for update to app_command using
 (recipient_id=private.actor_id() and private.operational_team(organization_id,candidate_id,bid_id) is not null) with check(recipient_id=private.actor_id());

create function public.report_processing(p_org uuid,p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_operation uuid;v_candidate uuid;v_bid uuid;v_team uuid;old public.processing_observations;v_state text;v_code text;
begin
 if private.org_role(p_org) is null then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if jsonb_typeof(p_input) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_input) k where k not in ('eventId','operationId','candidateId','bidId','stage','state','code'))
 or not p_input ?& array['eventId','operationId','candidateId','bidId','stage','state','code'] then raise exception 'INVALID_OBSERVATION' using errcode='22023';end if;
 v_id:=(p_input->>'eventId')::uuid;v_operation:=(p_input->>'operationId')::uuid;v_candidate:=(p_input->>'candidateId')::uuid;v_bid:=(p_input->>'bidId')::uuid;
 v_team:=private.operational_team(p_org,v_candidate,v_bid);if v_team is null then raise exception 'FORBIDDEN' using errcode='42501';end if;
 v_state:=p_input->>'state';v_code:=p_input->>'code';
 if (v_state='succeeded' and v_code<>'RECOVERED') or (v_state='pending' and v_code<>'PENDING') or (v_state='unknown' and v_code<>'SYNC_UNKNOWN')
 or (v_state='conflict' and v_code<>'CONFLICT') or (v_state='failed' and v_code not in ('PROCESSING_FAILED','PERMISSION_DENIED')) then raise exception 'INVALID_OBSERVATION' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('processing:'||p_org||':'||v_id,0));
 select * into old from public.processing_observations where organization_id=p_org and id=v_id;
 if found then
  if old.actor_id<>private.actor_id() or old.request_payload<>p_input then raise exception 'KEY_PAYLOAD_MISMATCH' using errcode='22023';end if;
  return jsonb_build_object('eventId',old.id,'reportedAt',old.created_at);
 end if;
 insert into public.processing_observations(organization_id,id,operation_id,actor_id,candidate_id,bid_id,team_id,stage,state,code,request_payload)
 values(p_org,v_id,v_operation,private.actor_id(),v_candidate,v_bid,v_team,p_input->>'stage',v_state,v_code,p_input) returning * into old;
 if v_state in ('failed','unknown','conflict','succeeded') then
  insert into public.operational_notifications(organization_id,recipient_id,candidate_id,bid_id,team_id,event_key,title)
  values(p_org,private.actor_id(),v_candidate,v_bid,v_team,'processing:'||v_id,case when v_state='succeeded' then 'Processing recovered' else 'Processing needs attention' end) on conflict do nothing;
 end if;
 perform private.audit(p_org,'processing.'||v_state,v_candidate,gen_random_uuid(),v_team,jsonb_build_object('operationId',v_operation,'stage',p_input->>'stage','code',v_code));
 return jsonb_build_object('eventId',v_id,'reportedAt',old.created_at);
exception when unique_violation then raise exception 'KEY_PAYLOAD_MISMATCH' using errcode='22023';
end $$;
alter function public.report_processing(uuid,jsonb) owner to app_command;
revoke all on function public.report_processing(uuid,jsonb) from public,anon;
grant execute on function public.report_processing(uuid,jsonb) to authenticated;

create function private.assignment_notification() returns trigger language plpgsql set search_path='' as $$ begin
 insert into public.operational_notifications(organization_id,recipient_id,candidate_id,team_id,event_key,title)
 values(new.organization_id,new.user_id,new.candidate_id,new.team_id,'assignment:'||new.id||':'||coalesce(new.ended_at::text,'active'),'Candidate assignment changed') on conflict do nothing;
 return new;
end $$;
revoke all on function private.assignment_notification() from public;
create trigger operational_assignment after insert or update of ended_at on public.candidate_assignments for each row execute function private.assignment_notification();

create function public.read_operational_notification(p_org uuid,p_id uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 update public.operational_notifications set read_at=coalesce(read_at,now()) where organization_id=p_org and id=p_id and recipient_id=private.actor_id();
 if not found then raise exception 'FORBIDDEN' using errcode='42501';end if;
end $$;
alter function public.read_operational_notification(uuid,uuid) owner to app_command;
revoke all on function public.read_operational_notification(uuid,uuid) from public,anon;
grant execute on function public.read_operational_notification(uuid,uuid) to authenticated;

create function public.operational_processing(p_org uuid,p_page integer default 1,p_resolved boolean default false) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if private.org_role(p_org) is null then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 100000 then raise exception 'INVALID_PAGE' using errcode='22023';end if;
 with latest as materialized(select distinct on(actor_id,operation_id,stage) * from public.processing_observations where organization_id=p_org order by actor_id,operation_id,stage,created_at desc,id desc),
 filtered as materialized(select * from latest where p_resolved or state<>'succeeded')
 select jsonb_build_object('asOf',statement_timestamp(),'total',(select count(*) from filtered),'page',p_page,'pageSize',25,
  'counts',jsonb_build_object('failed',(select count(*) from latest where state='failed'),'unknown',(select count(*) from latest where state='unknown'),'conflict',(select count(*) from latest where state='conflict'),'pending',(select count(*) from latest where state='pending')),
  'items',coalesce((select jsonb_agg(jsonb_build_object('eventId',x.id,'operationId',x.operation_id,'actorId',x.actor_id,'candidateId',x.candidate_id,'bidId',x.bid_id,'teamId',x.team_id,'stage',x.stage,'state',x.state,'code',x.code,'reportedAt',x.created_at) order by x.created_at desc,x.id) from (select * from filtered order by created_at desc,id limit 25 offset (p_page-1)*25) x),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.operational_processing(uuid,integer,boolean) from public,anon;
grant execute on function public.operational_processing(uuid,integer,boolean) to authenticated;
commit;
