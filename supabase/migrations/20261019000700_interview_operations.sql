begin;
alter table public.interviews drop constraint interviews_lifecycle_status_check;
update public.interviews set lifecycle_status='not_scheduled' where lifecycle_status='planned';
alter table public.interviews alter column lifecycle_status set default 'not_scheduled';
alter table public.interviews add constraint interview_lifecycle check(lifecycle_status in ('not_scheduled','scheduling','scheduled','completed','feedback_pending','cancelled'));
alter table public.interviews
 add column owner_id uuid references public.users(id),add column type text not null default '' check(length(type)<=100),
 add column interviewer text not null default '' check(length(interviewer)<=300),add column local_datetime text,add column chosen_offset text,
 add column duration_minutes integer not null default 60 check(duration_minutes between 1 and 1440),
 add column location text not null default '' check(length(location)<=1000),
 add column meeting_url text check(meeting_url is null or (length(meeting_url)<=2048 and meeting_url ~ '^https?://[^[:space:]]+$')),
 add column outcome text not null default 'pending' check(outcome in ('pending','passed','next_round','offer','rejected')),
 add column next_action text not null default '' check(length(next_action)<=4000),add column follow_up_at timestamptz,add column completed_at timestamptz,
 add column previous_round_id uuid,add unique(organization_id,bid_id,id),
 add foreign key(organization_id,bid_id,previous_round_id) references public.interviews(organization_id,bid_id,id);
update public.interviews set owner_id=created_by;
alter table public.interview_feedback add column revision_number bigint;
with numbered as(select id,row_number() over(partition by interview_id order by created_at,id) n from public.interview_feedback)
update public.interview_feedback f set revision_number=n.n from numbered n where f.id=n.id;
alter table public.interview_feedback alter column revision_number set not null;
alter table public.interview_feedback add unique(interview_id,revision_number);
create trigger immutable before update or delete on public.interview_feedback for each row execute function private.immutable_revision();
create table public.interview_revisions(id uuid primary key default gen_random_uuid(),organization_id uuid not null,bid_id uuid not null,interview_id uuid not null,
 revision bigint not null,snapshot jsonb not null,actor_id uuid not null references public.users(id),created_at timestamptz not null default now(),
 unique(interview_id,revision),foreign key(organization_id,bid_id,interview_id) references public.interviews(organization_id,bid_id,id));
create table public.workflow_tasks(id uuid primary key default gen_random_uuid(),organization_id uuid not null,bid_id uuid not null,interview_id uuid,
 assignee_id uuid not null references public.users(id),title text not null check(length(trim(title)) between 1 and 4000),due_at timestamptz not null,
 state text not null default 'open' check(state in ('open','completed','cancelled')),completed_at timestamptz,row_version bigint not null default 1,
 source_key text not null,created_at timestamptz not null default now(),unique(organization_id,source_key),
 check((state='completed')=(completed_at is not null)),
 foreign key(organization_id,bid_id) references public.bids(organization_id,id),
 foreign key(organization_id,bid_id,interview_id) references public.interviews(organization_id,bid_id,id));
create table public.workflow_notifications(id uuid primary key default gen_random_uuid(),organization_id uuid not null,bid_id uuid not null,interview_id uuid,
 recipient_id uuid not null references public.users(id),event_key text not null,title text not null,read_at timestamptz,created_at timestamptz not null default now(),
 unique(organization_id,recipient_id,event_key),foreign key(organization_id,bid_id) references public.bids(organization_id,id),
 foreign key(organization_id,bid_id,interview_id) references public.interviews(organization_id,bid_id,id));
create index interview_agenda on public.interviews(organization_id,scheduled_at);
create index task_queue on public.workflow_tasks(organization_id,assignee_id,state,due_at);
do $$ declare t text;begin foreach t in array array['interview_revisions','workflow_tasks','workflow_notifications'] loop
 execute format('alter table public.%I enable row level security',t);execute format('alter table public.%I force row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant select on public.%I to authenticated,app_command',t);
 execute format('grant insert on public.%I to app_command',t);
 execute format('create policy visible on public.%I for select to authenticated using(private.reads_bid(organization_id,bid_id) and (interview_id is null or private.reads_interview(organization_id,interview_id)))',t);
 execute format('create policy command_read on public.%I for select to app_command using(private.reads_bid(organization_id,bid_id) and (interview_id is null or private.reads_interview(organization_id,interview_id)))',t);
 execute format('create policy command_insert on public.%I for insert to app_command with check(private.reads_bid(organization_id,bid_id) and (interview_id is null or private.reads_interview(organization_id,interview_id)))',t);
 end loop;end $$;
alter policy visible on public.workflow_notifications using(recipient_id=private.actor_id() and private.reads_bid(organization_id,bid_id) and (interview_id is null or private.reads_interview(organization_id,interview_id)));
create trigger immutable before update or delete on public.interview_revisions for each row execute function private.immutable_revision();
grant select,insert,update on public.interviews to app_command;
grant select,insert on public.interview_feedback to app_command;
create policy command_read on public.interviews for select to app_command using(private.reads_interview(organization_id,id));
create policy command_insert on public.interviews for insert to app_command with check(private.org_role(organization_id)<>'bidder' and private.reads_bid(organization_id,bid_id));
create policy command_update on public.interviews for update to app_command using(private.reads_interview(organization_id,id)) with check(private.reads_interview(organization_id,id));
create policy command_read on public.interview_feedback for select to app_command using(private.reads_interview(organization_id,interview_id));
create policy command_insert on public.interview_feedback for insert to app_command with check(private.reads_interview(organization_id,interview_id));
grant update on public.workflow_tasks,public.workflow_notifications to app_command;
create policy command_update on public.workflow_tasks for update to app_command using(private.reads_bid(organization_id,bid_id) and (interview_id is null or private.reads_interview(organization_id,interview_id))) with check(private.reads_bid(organization_id,bid_id));
create policy command_update on public.workflow_notifications for update to app_command using(recipient_id=private.actor_id() and private.reads_bid(organization_id,bid_id) and (interview_id is null or private.reads_interview(organization_id,interview_id))) with check(recipient_id=private.actor_id());

-- Recipients are resolved at write time; visibility is checked again at read time.
grant create on schema private to app_permission_reader;
create function private.interview_owner(p_org uuid,p_candidate uuid,p_team uuid,p_owner uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.workflow_owner(p_org,p_candidate,p_team,p_owner) and exists(select 1 from public.organization_memberships where organization_id=p_org and user_id=p_owner and state='active' and role<>'bidder')
$$;
alter function private.interview_owner(uuid,uuid,uuid,uuid) owner to app_permission_reader;
revoke all on function private.interview_owner(uuid,uuid,uuid,uuid) from public;grant execute on function private.interview_owner(uuid,uuid,uuid,uuid) to app_command;
grant execute on function private.workflow_owner(uuid,uuid,uuid,uuid) to app_permission_reader;
create function private.workflow_reviewers(p_org uuid,p_team uuid) returns setof uuid language sql stable security definer set search_path='' as $$
 select m.user_id from public.organization_memberships m join public.users u on u.id=m.user_id and u.status='active'
 where m.organization_id=p_org and m.state='active' and (m.role='admin' or (m.role='team_leader' and exists(select 1 from public.team_memberships tm where tm.organization_id=p_org and tm.team_id=p_team and tm.user_id=m.user_id and tm.active and tm.role='team_leader')))
$$;
alter function private.workflow_reviewers(uuid,uuid) owner to app_permission_reader;
revoke create on schema private from app_permission_reader;
revoke all on function private.workflow_reviewers(uuid,uuid) from public;grant execute on function private.workflow_reviewers(uuid,uuid) to app_command;
create function private.workflow_event(p_org uuid,p_bid uuid,p_interview uuid,p_owner uuid,p_key text,p_title text) returns void language plpgsql set search_path='' as $$ begin
 insert into public.workflow_notifications(organization_id,bid_id,interview_id,recipient_id,event_key,title)
 select p_org,p_bid,p_interview,r,p_key,p_title from (select p_owner r union select private.workflow_reviewers(p_org,b.team_id) from public.bids b where b.organization_id=p_org and b.id=p_bid) recipients
 where r is not null on conflict(organization_id,recipient_id,event_key) do nothing;
end $$;
create function private.workflow_followup(p_org uuid,p_bid uuid,p_interview uuid,p_owner uuid,p_due timestamptz,p_title text,p_key text) returns void language plpgsql set search_path='' as $$ begin
 -- A reschedule preserves the prior completed task and cancels an obsolete open one.
 update public.workflow_tasks set state='cancelled',row_version=row_version+1 where organization_id=p_org and bid_id=p_bid and interview_id is not distinct from p_interview and state='open';
 if p_due is not null then insert into public.workflow_tasks(organization_id,bid_id,interview_id,assignee_id,title,due_at,source_key) values(p_org,p_bid,p_interview,p_owner,coalesce(nullif(trim(p_title),''),'Follow up'),p_due,p_key) on conflict(organization_id,source_key) do nothing;end if;
end $$;
create function private.bid_workflow_events() returns trigger language plpgsql set search_path='' as $$ begin
 if tg_op='INSERT' or new.owner_id is distinct from old.owner_id or new.status is distinct from old.status or new.current_approval_id is distinct from old.current_approval_id then
 perform private.workflow_event(new.organization_id,new.id,null,new.owner_id,'bid:'||new.id||':'||new.row_version,'Bid '||replace(new.status,'_',' '));
 end if;
 if tg_op='INSERT' or new.follow_up_at is distinct from old.follow_up_at or new.owner_id is distinct from old.owner_id then perform private.workflow_followup(new.organization_id,new.id,null,new.owner_id,new.follow_up_at,'Bid follow-up','bid:'||new.id||':'||new.row_version);end if;
 return new;end $$;
create trigger workflow_events after insert or update on public.bids for each row execute function private.bid_workflow_events();
revoke all on function private.workflow_event(uuid,uuid,uuid,uuid,text,text),private.workflow_followup(uuid,uuid,uuid,uuid,timestamptz,text,text),private.bid_workflow_events() from public;
grant execute on function private.workflow_event(uuid,uuid,uuid,uuid,text,text),private.workflow_followup(uuid,uuid,uuid,uuid,timestamptz,text,text) to app_command;

create function public.save_interview(p_org uuid,p_interview uuid,p_expected bigint,p_input jsonb,p_previous uuid,p_operation uuid,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.bids;i public.interviews;prior public.interviews;r jsonb;payload jsonb:=jsonb_build_object('command','interview.save','id',p_interview,'expected',p_expected,'input',p_input,'previous',p_previous);
 stamp timestamptz;local_time timestamp;offset_seconds integer;owner uuid;begin
 if private.org_role(p_org) is null or private.org_role(p_org)='bidder' or not private.reads_bid(p_org,(p_input->>'bidId')::uuid) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 r:=private.workflow_replay(p_org,p_operation,payload);if r is not null then return r;end if;
 select * into b from public.bids where organization_id=p_org and id=(p_input->>'bidId')::uuid for update;
 if not found or not private.workflow_active(p_org,b.candidate_id) then raise exception 'CANDIDATE_ARCHIVED' using errcode='22023';end if;
 if jsonb_typeof(p_input)<>'object' or (select count(*) from jsonb_object_keys(p_input))<>15 or not(p_input ?& array['bidId','ownerId','type','interviewer','localDateTime','timezone','offset','scheduledAt','durationMinutes','location','meetingUrl','lifecycle','outcome','nextAction','followUpAt']) then raise exception 'INVALID_INTERVIEW' using errcode='22023';end if;
 owner:=(p_input->>'ownerId')::uuid;
 if not private.interview_owner(p_org,b.candidate_id,b.team_id,owner) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 stamp:=(p_input->>'scheduledAt')::timestamptz;
 if stamp is not null then
 if not exists(select 1 from pg_timezone_names where name=p_input->>'timezone') or p_input->>'localDateTime' !~ '^\d{4}-\d\d-\d\dT\d\d:\d\d$' or p_input->>'offset' !~ '^[+-]\d\d:\d\d$' then raise exception 'INVALID_SCHEDULE' using errcode='22023';end if;
 local_time:=(p_input->>'localDateTime')::timestamp;
 offset_seconds:=extract(epoch from ((stamp at time zone (p_input->>'timezone'))-(stamp at time zone 'UTC')))::integer;
 if (stamp at time zone (p_input->>'timezone'))<>local_time or extract(epoch from (p_input->>'offset')::interval)::integer<>offset_seconds then raise exception 'INVALID_SCHEDULE' using errcode='22023';end if;
 elsif p_input->>'localDateTime' is not null or p_input->>'timezone' is not null or p_input->>'offset' is not null then raise exception 'INVALID_SCHEDULE' using errcode='22023';end if;
 if p_input->>'lifecycle' in ('scheduled','completed','feedback_pending') and stamp is null then raise exception 'INVALID_SCHEDULE' using errcode='22023';end if;
 if p_input->>'outcome'<>'pending' and p_input->>'lifecycle' not in ('completed','feedback_pending') then raise exception 'COMPLETION_REQUIRED' using errcode='22023';end if;
 if p_interview is null then
 if p_expected<>0 or b.status<>'interview_invited' then raise exception 'INTERVIEW_INVITATION_REQUIRED' using errcode='22023';end if;
 if p_previous is not null then select * into prior from public.interviews where organization_id=p_org and bid_id=b.id and id=p_previous;
 if not found or prior.lifecycle_status not in ('completed','feedback_pending') or prior.outcome<>'next_round' or exists(select 1 from public.interviews where organization_id=p_org and previous_round_id=p_previous) then raise exception 'NEXT_ROUND_REQUIRED' using errcode='22023';end if;end if;
 insert into public.interviews(organization_id,bid_id,round_number,created_by,owner_id,previous_round_id) select p_org,b.id,coalesce(max(round_number),0)+1,private.actor_id(),owner,p_previous from public.interviews where organization_id=p_org and bid_id=b.id returning * into i;
 else select * into i from public.interviews where organization_id=p_org and bid_id=b.id and id=p_interview for update;
 if not found then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if i.row_version<>p_expected then raise exception 'VERSION_CONFLICT' using errcode='40001';end if;
 if i.previous_round_id is distinct from p_previous then raise exception 'ROUND_PARENT_IMMUTABLE' using errcode='22023';end if;
 if i.lifecycle_status='cancelled' or (i.lifecycle_status in ('completed','feedback_pending') and p_input->>'lifecycle' not in ('completed','feedback_pending')) then raise exception 'INVALID_INTERVIEW_TRANSITION' using errcode='22023';end if;
 i.row_version:=i.row_version+1;
 end if;
 update public.interviews set owner_id=owner,type=p_input->>'type',interviewer=p_input->>'interviewer',scheduled_at=stamp,timezone=p_input->>'timezone',local_datetime=p_input->>'localDateTime',chosen_offset=p_input->>'offset',
 duration_minutes=(p_input->>'durationMinutes')::integer,location=p_input->>'location',meeting_url=p_input->>'meetingUrl',lifecycle_status=p_input->>'lifecycle',outcome=p_input->>'outcome',
 next_action=p_input->>'nextAction',follow_up_at=(p_input->>'followUpAt')::timestamptz,completed_at=case when p_input->>'lifecycle' in ('completed','feedback_pending') then coalesce(i.completed_at,now()) else null end,
 row_version=i.row_version,updated_at=now() where organization_id=p_org and id=i.id returning * into i;
 insert into public.interview_revisions(organization_id,bid_id,interview_id,revision,snapshot,actor_id) values(p_org,b.id,i.id,i.row_version,to_jsonb(i),private.actor_id());
 perform private.workflow_followup(p_org,b.id,i.id,owner,i.follow_up_at,i.next_action,'interview:'||i.id||':'||i.row_version);
 perform private.workflow_event(p_org,b.id,i.id,owner,'interview:'||i.id||':'||i.row_version,'Interview '||replace(i.lifecycle_status,'_',' '));
 perform private.audit(p_org,'interview.saved',i.id,p_request,b.team_id);
 return private.workflow_finish(p_org,b.id,p_operation,payload,jsonb_build_object('id',i.id,'rowVersion',i.row_version));
end $$;

create function public.record_interview_feedback(p_org uuid,p_interview uuid,p_expected bigint,p_feedback text,p_operation uuid,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.interviews;b public.bids;r jsonb;payload jsonb:=jsonb_build_object('command','interview.feedback','id',p_interview,'expected',p_expected,'feedback',p_feedback);begin
 if not private.reads_interview(p_org,p_interview) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 r:=private.workflow_replay(p_org,p_operation,payload);if r is not null then return r;end if;
 select * into i from public.interviews where organization_id=p_org and id=p_interview for update;
 if i.row_version<>p_expected then raise exception 'VERSION_CONFLICT' using errcode='40001';end if;
 select * into b from public.bids where organization_id=p_org and id=i.bid_id;
 if not private.workflow_active(p_org,b.candidate_id) then raise exception 'CANDIDATE_ARCHIVED' using errcode='22023';end if;
 if i.lifecycle_status not in ('completed','feedback_pending') or length(trim(p_feedback)) not between 1 and 20000 then raise exception 'COMPLETION_REQUIRED' using errcode='22023';end if;
 insert into public.interview_feedback(organization_id,interview_id,revision_number,feedback,created_by) select p_org,i.id,coalesce(max(revision_number),0)+1,p_feedback,private.actor_id() from public.interview_feedback where organization_id=p_org and interview_id=i.id;
 update public.interviews set lifecycle_status='completed',row_version=row_version+1,updated_at=now() where organization_id=p_org and id=i.id returning * into i;
 insert into public.interview_revisions(organization_id,bid_id,interview_id,revision,snapshot,actor_id) values(p_org,i.bid_id,i.id,i.row_version,to_jsonb(i),private.actor_id());
 perform private.workflow_event(p_org,b.id,i.id,i.owner_id,'feedback:'||i.id||':'||i.row_version,'Interview feedback recorded');
 perform private.audit(p_org,'interview.feedback',i.id,p_request,b.team_id);
 return private.workflow_finish(p_org,i.bid_id,p_operation,payload,jsonb_build_object('id',i.id,'rowVersion',i.row_version));
end $$;
create function public.complete_workflow_task(p_org uuid,p_task uuid,p_expected bigint,p_operation uuid,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.workflow_tasks;b public.bids;r jsonb;payload jsonb:=jsonb_build_object('command','task.complete','id',p_task,'expected',p_expected);begin
 select * into t from public.workflow_tasks where organization_id=p_org and id=p_task;
 if not found then raise exception 'FORBIDDEN' using errcode='42501';end if;
 r:=private.workflow_replay(p_org,p_operation,payload);if r is not null then return r;end if;
 select * into t from public.workflow_tasks where organization_id=p_org and id=p_task for update;
 select * into b from public.bids where organization_id=p_org and id=t.bid_id;
 if t.assignee_id<>private.actor_id() and not private.manages_team(p_org,b.team_id) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not private.workflow_active(p_org,b.candidate_id) then raise exception 'CANDIDATE_ARCHIVED' using errcode='22023';end if;
 if t.row_version<>p_expected then raise exception 'VERSION_CONFLICT' using errcode='40001';end if;
 if t.state<>'open' then raise exception 'TASK_CLOSED' using errcode='22023';end if;
 update public.workflow_tasks set state='completed',completed_at=now(),row_version=row_version+1 where organization_id=p_org and id=t.id returning * into t;
 perform private.audit(p_org,'task.completed',t.id,p_request,b.team_id);
 return private.workflow_finish(p_org,b.id,p_operation,payload,jsonb_build_object('id',t.id,'rowVersion',t.row_version));
end $$;
create function public.read_workflow_notification(p_org uuid,p_notification uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 update public.workflow_notifications set read_at=coalesce(read_at,now()) where organization_id=p_org and id=p_notification and recipient_id=private.actor_id();
 if not found then raise exception 'FORBIDDEN' using errcode='42501';end if;
end $$;
alter function public.save_interview(uuid,uuid,bigint,jsonb,uuid,uuid,uuid) owner to app_command;
alter function public.record_interview_feedback(uuid,uuid,bigint,text,uuid,uuid) owner to app_command;
alter function public.complete_workflow_task(uuid,uuid,bigint,uuid,uuid) owner to app_command;
alter function public.read_workflow_notification(uuid,uuid) owner to app_command;
revoke all on function public.save_interview(uuid,uuid,bigint,jsonb,uuid,uuid,uuid),public.record_interview_feedback(uuid,uuid,bigint,text,uuid,uuid),public.complete_workflow_task(uuid,uuid,bigint,uuid,uuid),public.read_workflow_notification(uuid,uuid) from public,anon;
grant execute on function public.save_interview(uuid,uuid,bigint,jsonb,uuid,uuid,uuid),public.record_interview_feedback(uuid,uuid,bigint,text,uuid,uuid),public.complete_workflow_task(uuid,uuid,bigint,uuid,uuid),public.read_workflow_notification(uuid,uuid) to authenticated;
commit;
