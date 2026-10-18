begin;
create function private.has_admin_org() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.organization_memberships m where m.user_id=auth.uid()
   and private.org_role(m.organization_id)='admin')
$$;
create function private.identity_confirmed(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u where u.id=p_user and u.email_confirmed_at is not null)
$$;
create function private.candidate_team(p_org uuid,p_candidate uuid) returns uuid language sql stable security definer set search_path='' as $$
 select c.owning_team_id from public.candidates c where c.organization_id=p_org and c.id=p_candidate and
 (private.reads_candidate(p_org,p_candidate) or exists(select 1 from private.bidder_grants(p_org,p_candidate,null,'bid.prepare')))
$$;
create function private.eligible_assignee(p_org uuid,p_team uuid,p_user uuid,p_member_only boolean) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.team_memberships tm
 join public.organization_memberships m on m.organization_id=tm.organization_id and m.user_id=tm.user_id
 join public.users u on u.id=m.user_id and u.status='active'
 where tm.organization_id=p_org and tm.team_id=p_team and tm.user_id=p_user and tm.active
  and m.state='active' and m.role=tm.role and
  (tm.role='team_member' or (not p_member_only and tm.role='team_leader')))
$$;
alter function private.eligible_assignee(uuid,uuid,uuid,boolean) owner to app_permission_reader;
revoke all on function private.eligible_assignee(uuid,uuid,uuid,boolean) from public;
grant execute on function private.eligible_assignee(uuid,uuid,uuid,boolean) to app_command;
alter function private.has_admin_org() owner to app_permission_reader;
revoke all on function private.has_admin_org() from public;
grant execute on function private.has_admin_org() to app_command;
alter function private.identity_confirmed(uuid) owner to app_permission_reader;
revoke all on function private.identity_confirmed(uuid) from public;
grant execute on function private.identity_confirmed(uuid) to app_command;
alter function private.candidate_team(uuid,uuid) owner to app_permission_reader;
revoke all on function private.candidate_team(uuid,uuid) from public;
grant execute on function private.candidate_team(uuid,uuid) to app_command;
grant insert on public.organizations to app_command;
create policy command_insert on public.organizations for insert to app_command with check (auth.role()='service_role' or private.org_role(id)='admin');
grant update on public.organizations to app_command;
create policy command_update on public.organizations for update to app_command using (auth.role()='service_role' or private.org_role(id)='admin') with check (auth.role()='service_role' or private.org_role(id)='admin');
grant select on public.organizations to app_command;
create policy command_select on public.organizations for select to app_command using (auth.role()='service_role' or private.org_role(id)='admin');
grant insert on public.users to app_command;
create policy command_insert on public.users for insert to app_command with check (auth.role()='service_role' or private.has_admin_org());
grant select on public.users to app_command;
create policy command_select on public.users for select to app_command using (auth.role()='service_role' or private.has_admin_org());
grant insert on public.organization_memberships to app_command;
create policy command_insert on public.organization_memberships for insert to app_command with check (auth.role()='service_role' or private.org_role(organization_id)='admin');
grant update on public.organization_memberships to app_command;
create policy command_update on public.organization_memberships for update to app_command using (auth.role()='service_role' or private.org_role(organization_id)='admin') with check (auth.role()='service_role' or private.org_role(organization_id)='admin');
grant select on public.organization_memberships to app_command;
create policy command_select on public.organization_memberships for select to app_command using (auth.role()='service_role' or private.org_role(organization_id)='admin');
grant insert on public.teams to app_command;
create policy command_insert on public.teams for insert to app_command with check (private.org_role(organization_id)='admin');
grant update on public.teams to app_command;
create policy command_update on public.teams for update to app_command using (private.org_role(organization_id)='admin') with check (private.org_role(organization_id)='admin');
grant select on public.teams to app_command;
create policy command_select on public.teams for select to app_command using (private.org_role(organization_id)='admin');
grant insert on public.team_memberships to app_command;
create policy command_insert on public.team_memberships for insert to app_command with check (private.org_role(organization_id)='admin');
grant update on public.team_memberships to app_command;
create policy command_update on public.team_memberships for update to app_command using (private.org_role(organization_id)='admin') with check (private.org_role(organization_id)='admin');
grant select on public.team_memberships to app_command;
create policy command_select on public.team_memberships for select to app_command using (private.org_role(organization_id)='admin');
grant insert on public.candidates to app_command;
create policy command_insert on public.candidates for insert to app_command with check (private.manages_team(organization_id,owning_team_id));
grant update on public.candidates to app_command;
create policy command_update on public.candidates for update to app_command using (private.manages_team(organization_id,owning_team_id)) with check (private.manages_team(organization_id,owning_team_id));
grant select on public.candidates to app_command;
create policy command_select on public.candidates for select to app_command using (private.manages_team(organization_id,owning_team_id));
grant insert on public.candidate_assignments to app_command;
create policy command_insert on public.candidate_assignments for insert to app_command with check (private.manages_team(organization_id,team_id));
grant update on public.candidate_assignments to app_command;
create policy command_update on public.candidate_assignments for update to app_command using (private.manages_team(organization_id,team_id)) with check (private.manages_team(organization_id,team_id));
grant select on public.candidate_assignments to app_command;
create policy command_select on public.candidate_assignments for select to app_command using (private.manages_team(organization_id,team_id));
grant insert on public.candidate_bid_profiles to app_command;
create policy command_insert on public.candidate_bid_profiles for insert to app_command with check (private.reads_candidate(organization_id,candidate_id));
grant update on public.candidate_bid_profiles to app_command;
create policy command_update on public.candidate_bid_profiles for update to app_command using (private.reads_candidate(organization_id,candidate_id)) with check (private.reads_candidate(organization_id,candidate_id));
grant select on public.candidate_bid_profiles to app_command;
create policy command_select on public.candidate_bid_profiles for select to app_command using (private.reads_candidate(organization_id,candidate_id));
grant insert on public.bids to app_command;
create policy command_insert on public.bids for insert to app_command with check (private.reads_bid(organization_id,id) or private.reads_candidate(organization_id,candidate_id) or exists(select 1 from private.bidder_grants(organization_id,candidate_id,null,'bid.prepare')));
grant select on public.bids to app_command;
create policy command_select on public.bids for select to app_command using (private.reads_bid(organization_id,id) or private.reads_candidate(organization_id,candidate_id) or exists(select 1 from private.bidder_grants(organization_id,candidate_id,null,'bid.prepare')));
grant insert on public.bid_access_grants to app_command;
create policy command_insert on public.bid_access_grants for insert to app_command with check (private.org_role(organization_id)='admin');
grant update on public.bid_access_grants to app_command;
create policy command_update on public.bid_access_grants for update to app_command using (private.org_role(organization_id)='admin') with check (private.org_role(organization_id)='admin');
grant select on public.bid_access_grants to app_command;
create policy command_select on public.bid_access_grants for select to app_command using (private.org_role(organization_id)='admin');
grant insert on public.administrative_operations to app_command;
create policy command_insert on public.administrative_operations for insert to app_command with check (private.org_role(organization_id)='admin');
grant update on public.administrative_operations to app_command;
create policy command_update on public.administrative_operations for update to app_command using (private.org_role(organization_id)='admin') with check (private.org_role(organization_id)='admin');
grant select on public.administrative_operations to app_command;
create policy command_select on public.administrative_operations for select to app_command using (private.org_role(organization_id)='admin');
grant insert on public.audit_logs to app_command;
create policy command_insert on public.audit_logs for insert to app_command with check (auth.role()='service_role' or private.org_role(organization_id) is not null);

create function private.audit(p_org uuid,p_action text,p_subject uuid,p_request uuid,p_team uuid default null,p_summary jsonb default '{}')
returns void language sql set search_path='' as $$
 insert into public.audit_logs(organization_id,actor_id,action,subject_id,request_id,team_id,redacted_change_summary)
 values(p_org,auth.uid(),p_action,p_subject,p_request,p_team,p_summary)
$$;
revoke all on function private.audit(uuid,text,uuid,uuid,uuid,jsonb) from public;
grant execute on function private.audit(uuid,text,uuid,uuid,uuid,jsonb) to app_command;

create function public.bootstrap_organization(p_org uuid,p_admin uuid,p_name text,p_request uuid)
returns uuid language plpgsql security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' or not private.identity_confirmed(p_admin) then
   raise exception 'FORBIDDEN' using errcode='42501';
 end if;
 -- Existing organizations are never attached or escalated by bootstrap, including retries.
 if exists(select 1 from public.organizations where id=p_org) then
   raise exception 'BOOTSTRAP_ALREADY_EXISTS' using errcode='23505';
 end if;
 insert into public.users(id,display_name) values(p_admin,'Initial administrator') on conflict(id) do nothing;
 insert into public.organizations(id,name) values(p_org,p_name);
 insert into public.organization_memberships(organization_id,user_id,role,state,created_by)
 values(p_org,p_admin,'admin','active',p_admin);
 insert into public.audit_logs(organization_id,actor_id,action,subject_id,request_id)
 values(p_org,p_admin,'organization.bootstrapped',p_org,p_request);
 return p_org;
end $$;

create function public.create_team(p_org uuid,p_name text,p_request uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if private.org_role(p_org) is distinct from 'admin' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 insert into public.teams(organization_id,name,created_by) values(p_org,p_name,auth.uid()) returning id into v_id;
 perform private.audit(p_org,'team.created',v_id,p_request,v_id);
 return v_id;
end $$;

create function public.set_team_membership(p_org uuid,p_team uuid,p_user uuid,p_role text,p_active boolean,p_expected bigint,p_request uuid)
returns bigint language plpgsql security definer set search_path='' as $$
declare v_version bigint; v_role text;
begin
 if private.org_role(p_org) is distinct from 'admin' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 perform 1 from public.organizations where id=p_org for update;
 select role into v_role from public.organization_memberships where organization_id=p_org and user_id=p_user and state='active';
 if p_role is distinct from v_role or p_role not in ('team_leader','team_member','bidder') or p_active is null then
   raise exception 'INVALID_MEMBERSHIP' using errcode='22023';
 end if;
 select row_version into v_version from public.team_memberships where organization_id=p_org and team_id=p_team and user_id=p_user for update;
 if coalesce(v_version,0) is distinct from p_expected then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
 insert into public.team_memberships(organization_id,team_id,user_id,role,active,created_by)
 values(p_org,p_team,p_user,p_role,p_active,auth.uid())
 on conflict(organization_id,team_id,user_id) do update set role=excluded.role,active=excluded.active,
   row_version=public.team_memberships.row_version+1,updated_at=now() returning row_version into v_version;
 if not p_active then
   update public.candidate_assignments set ended_at=now()
    where organization_id=p_org and team_id=p_team and user_id=p_user and ended_at is null;
 end if;
 perform private.audit(p_org,'team.membership_changed',p_user,p_request,p_team,jsonb_build_object('active',p_active,'role',p_role));
 return v_version;
end $$;

create function public.set_organization_membership(p_org uuid,p_user uuid,p_role text,p_state text,p_expected bigint,p_request uuid)
returns bigint language plpgsql security definer set search_path='' as $$
declare v_old public.organization_memberships; v_version bigint;
begin
 if private.org_role(p_org) is distinct from 'admin' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 perform 1 from public.organizations where id=p_org for update; -- serializes last-admin and role changes
 select * into v_old from public.organization_memberships where organization_id=p_org and user_id=p_user for update;
 if not found then raise exception 'MEMBERSHIP_NOT_FOUND' using errcode='P0002'; end if;
 if v_old.row_version is distinct from p_expected then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
 if p_role is null or p_role not in ('admin','team_leader','team_member','bidder') or
    p_state is null or p_state not in ('active','deactivated') then raise exception 'INVALID_MEMBERSHIP' using errcode='22023'; end if;
 if p_state='active' and not private.identity_confirmed(p_user) then raise exception 'IDENTITY_NOT_CONFIRMED' using errcode='22023'; end if;
 if v_old.role='admin' and v_old.state='active' and (p_role<>'admin' or p_state<>'active') and
   (select count(*) from public.organization_memberships where organization_id=p_org and role='admin' and state='active')<=1 then
   raise exception 'LAST_ACTIVE_ADMIN' using errcode='22023';
 end if;
 if p_state<>'active' or p_role<>v_old.role then
   update public.team_memberships set active=false,row_version=row_version+1,updated_at=now()
    where organization_id=p_org and user_id=p_user and active;
   update public.candidate_assignments set ended_at=now()
    where organization_id=p_org and user_id=p_user and ended_at is null;
   update public.bid_access_grants set revoked_at=now()
    where organization_id=p_org and user_id=p_user and revoked_at is null;
 end if;
 update public.organization_memberships set role=p_role,state=p_state,row_version=row_version+1,updated_at=now()
  where organization_id=p_org and user_id=p_user returning row_version into v_version;
 update public.administrative_operations set state='completed',updated_at=now()
  where organization_id=p_org and target_user_id=p_user and state='awaiting_activation' and p_state='active';
 perform private.audit(p_org,'organization.membership_changed',p_user,p_request,null,jsonb_build_object('state',p_state,'role',p_role));
 return v_version;
end $$;

create function public.create_candidate(p_org uuid,p_team uuid,p_owner uuid,p_full_name text,p_request uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not private.manages_team(p_org,p_team) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_owner is not null and not private.eligible_assignee(p_org,p_team,p_owner,false) then
   raise exception 'INVALID_OWNER' using errcode='22023';
 end if;
 insert into public.candidates(organization_id,owning_team_id,owner_id,full_name,created_by)
 values(p_org,p_team,p_owner,p_full_name,auth.uid()) returning id into v_id;
 perform private.audit(p_org,'candidate.created',v_id,p_request,p_team);
 return v_id;
end $$;

create function public.change_candidate_assignment(p_org uuid,p_candidate uuid,p_user uuid,p_assign boolean,p_request uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_team uuid; v_id uuid;
begin
 select owning_team_id into v_team from public.candidates where organization_id=p_org and id=p_candidate for update;
 if v_team is null or not private.manages_team(p_org,v_team) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_assign is null then raise exception 'INVALID_ASSIGNMENT' using errcode='22023'; end if;
 if p_assign and not private.eligible_assignee(p_org,v_team,p_user,true) then
   raise exception 'INVALID_ASSIGNEE' using errcode='22023';
 end if;
 -- Repeating an identical assignment is a no-op; ending never deletes history.
 select id into v_id from public.candidate_assignments where organization_id=p_org and candidate_id=p_candidate and user_id=p_user and ended_at is null;
 if p_assign and v_id is null then
   insert into public.candidate_assignments(organization_id,candidate_id,team_id,user_id,created_by)
   values(p_org,p_candidate,v_team,p_user,auth.uid()) returning id into v_id;
 elsif not p_assign and v_id is not null then
   update public.candidate_assignments set ended_at=now() where id=v_id;
 end if;
 perform private.audit(p_org,'candidate.assignment_changed',p_candidate,p_request,v_team,jsonb_build_object('assigned',p_assign));
 return v_id;
end $$;

create function public.approve_bidder_summary(p_org uuid,p_candidate uuid,p_summary text,p_expected bigint,p_request uuid)
returns bigint language plpgsql security definer set search_path='' as $$
declare v_team uuid; v_version bigint;
begin
 select owning_team_id into v_team from public.candidates where organization_id=p_org and id=p_candidate for update;
 if v_team is null or not private.manages_team(p_org,v_team) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select row_version into v_version from public.candidate_bid_profiles where organization_id=p_org and candidate_id=p_candidate;
 if coalesce(v_version,0) is distinct from p_expected then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
 insert into public.candidate_bid_profiles(organization_id,candidate_id,approved_summary,approved_by)
 values(p_org,p_candidate,p_summary,auth.uid()) on conflict(organization_id,candidate_id)
 do update set approved_summary=excluded.approved_summary,approved_by=excluded.approved_by,approved_at=now(),
 row_version=public.candidate_bid_profiles.row_version+1 returning row_version into v_version;
 perform private.audit(p_org,'candidate.bidder_summary_approved',p_candidate,p_request,v_team);
 return v_version;
end $$;

create function public.create_draft_bid(p_org uuid,p_candidate uuid,p_company text,p_title text,p_request uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_team uuid; v_id uuid;
begin
 v_team:=private.candidate_team(p_org,p_candidate);
 if v_team is null then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if length(btrim(p_company)) not between 1 and 200 or length(btrim(p_title)) not between 1 and 200 then
  raise exception 'INVALID_BID' using errcode='22023';
 end if;
 insert into public.bids(organization_id,candidate_id,team_id,owner_id,company_name,job_title,created_by)
 values(p_org,p_candidate,v_team,auth.uid(),p_company,p_title,auth.uid()) returning id into v_id;
 perform private.audit(p_org,'bid.draft_created',v_id,p_request,v_team);
 return v_id;
end $$;

create function public.grant_bidder_access(p_org uuid,p_user uuid,p_candidate uuid,p_bid uuid,p_capability text,
 p_allow_email boolean,p_allow_phone boolean,p_expires timestamptz,p_request uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_team uuid; v_id uuid;
begin
 if private.org_role(p_org) is distinct from 'admin' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 perform 1 from public.organizations where id=p_org for update;
 if num_nonnulls(p_candidate,p_bid)<>1 then raise exception 'ONE_GRANT_TARGET_REQUIRED' using errcode='22023'; end if;
 if p_candidate is not null then
   select owning_team_id into v_team from public.candidates where organization_id=p_org and id=p_candidate;
 else
   select team_id into v_team from public.bids where organization_id=p_org and id=p_bid;
 end if;
 if v_team is null or not exists(select 1 from public.organization_memberships m join public.team_memberships tm
   on tm.organization_id=m.organization_id and tm.user_id=m.user_id
   where m.organization_id=p_org and m.user_id=p_user and m.state='active' and m.role='bidder'
    and tm.team_id=v_team and tm.active and tm.role='bidder') then
   raise exception 'INVALID_GRANT_SCOPE' using errcode='22023';
 end if;
 insert into public.bid_access_grants(organization_id,user_id,candidate_id,bid_id,capability,allow_email,allow_phone,expires_at,created_by)
 values(p_org,p_user,p_candidate,p_bid,p_capability,p_allow_email,p_allow_phone,p_expires,auth.uid()) returning id into v_id;
 perform private.audit(p_org,'bidder.grant_created',v_id,p_request,v_team,jsonb_build_object('capability',p_capability));
 return v_id;
end $$;

create function public.revoke_bidder_access(p_org uuid,p_grant uuid,p_request uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if private.org_role(p_org) is distinct from 'admin' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 update public.bid_access_grants set revoked_at=now() where organization_id=p_org and id=p_grant and revoked_at is null;
 perform private.audit(p_org,'bidder.grant_revoked',p_grant,p_request);
end $$;

-- Provisioning is a durable two-system operation. Auth creation never activates membership.
create function public.begin_user_provisioning(p_org uuid,p_operation uuid,p_email text,p_display_name text,p_role text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_op public.administrative_operations; v_hash text; v_email text:=lower(btrim(p_email));
begin
 if private.org_role(p_org) is distinct from 'admin' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_role is null or p_role not in ('admin','team_leader','team_member','bidder') or
  v_email is null or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(v_email)>320 or
  p_display_name is null or length(btrim(p_display_name)) not between 1 and 200 then
   raise exception 'INVALID_PROVISIONING_REQUEST' using errcode='22023';
 end if;
 perform 1 from public.organizations where id=p_org for update;
 v_hash:=encode(sha256(convert_to(jsonb_build_object('email',v_email,'displayName',btrim(p_display_name),'role',p_role)::text,'UTF8')),'hex');
 select * into v_op from public.administrative_operations where organization_id=p_org and operation_id=p_operation for update;
 if found then
   if v_op.actor_id<>auth.uid() or v_op.operation_type<>'provision_user' or v_op.request_hash<>v_hash then
    raise exception 'KEY_PAYLOAD_MISMATCH' using errcode='22023';
   end if;
 else
   insert into public.administrative_operations(organization_id,operation_id,actor_id,operation_type,request_hash,email,display_name,desired_role)
   values(p_org,p_operation,auth.uid(),'provision_user',v_hash,v_email,btrim(p_display_name),p_role) returning * into v_op;
   perform private.audit(p_org,'user.provisioning_started',p_operation,p_operation);
 end if;
 return jsonb_build_object('operationId',v_op.operation_id,'state',v_op.state,'email',v_op.email,'targetUserId',v_op.target_user_id);
end $$;

create function public.complete_user_provisioning(p_org uuid,p_operation uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_op public.administrative_operations; v_user uuid;
begin
 if private.org_role(p_org) is distinct from 'admin' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 perform 1 from public.organizations where id=p_org for update;
 select * into v_op from public.administrative_operations where organization_id=p_org and operation_id=p_operation for update;
 if not found or v_op.actor_id<>auth.uid() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if v_op.state<>'pending_auth' then
   return jsonb_build_object('operationId',p_operation,'state',v_op.state,'targetUserId',v_op.target_user_id);
 end if;
 select id into v_user from private.auth_identity(v_op.email);
 if v_user is null then raise exception 'AUTH_IDENTITY_REQUIRED' using errcode='P0002'; end if;
 insert into public.users(id,display_name) values(v_user,v_op.display_name) on conflict(id) do nothing;
 -- Never reactivate/overwrite an existing membership as a side effect of invitation.
 insert into public.organization_memberships(organization_id,user_id,role,state,created_by)
 values(p_org,v_user,v_op.desired_role,'invited',auth.uid()) on conflict(organization_id,user_id) do nothing;
 if exists(select 1 from public.organization_memberships where organization_id=p_org and user_id=v_user and role<>v_op.desired_role) then
  raise exception 'EXISTING_MEMBERSHIP_ROLE_CONFLICT' using errcode='22023';
 end if;
 update public.administrative_operations set target_user_id=v_user,
 state=case when exists(select 1 from public.organization_memberships where organization_id=p_org and user_id=v_user and state='active')
   then 'completed' else 'awaiting_activation' end,last_error_code=null,updated_at=now()
 where organization_id=p_org and operation_id=p_operation returning * into v_op;
 perform private.audit(p_org,'user.membership_attached',v_user,p_operation);
 return jsonb_build_object('operationId',p_operation,'state',v_op.state,'targetUserId',v_user);
end $$;

create function public.record_provisioning_failure(p_org uuid,p_operation uuid,p_code text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if private.org_role(p_org) is distinct from 'admin' or p_code not in ('AUTH_UNAVAILABLE','CONFIGURATION_REQUIRED') then
  raise exception 'FORBIDDEN' using errcode='42501';
 end if;
 update public.administrative_operations set last_error_code=p_code,updated_at=now()
 where organization_id=p_org and operation_id=p_operation and actor_id=auth.uid() and state='pending_auth';
end $$;

-- All exported commands use the same restricted non-owner role and explicit allowlist.
alter function public.bootstrap_organization(uuid,uuid,text,uuid) owner to app_command;
revoke all on function public.bootstrap_organization(uuid,uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.bootstrap_organization(uuid,uuid,text,uuid) to service_role;
alter function public.create_team(uuid,text,uuid) owner to app_command;
revoke all on function public.create_team(uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.create_team(uuid,text,uuid) to authenticated;
alter function public.set_team_membership(uuid,uuid,uuid,text,boolean,bigint,uuid) owner to app_command;
revoke all on function public.set_team_membership(uuid,uuid,uuid,text,boolean,bigint,uuid) from public, anon, authenticated;
grant execute on function public.set_team_membership(uuid,uuid,uuid,text,boolean,bigint,uuid) to authenticated;
alter function public.set_organization_membership(uuid,uuid,text,text,bigint,uuid) owner to app_command;
revoke all on function public.set_organization_membership(uuid,uuid,text,text,bigint,uuid) from public, anon, authenticated;
grant execute on function public.set_organization_membership(uuid,uuid,text,text,bigint,uuid) to authenticated;
alter function public.create_candidate(uuid,uuid,uuid,text,uuid) owner to app_command;
revoke all on function public.create_candidate(uuid,uuid,uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.create_candidate(uuid,uuid,uuid,text,uuid) to authenticated;
alter function public.change_candidate_assignment(uuid,uuid,uuid,boolean,uuid) owner to app_command;
revoke all on function public.change_candidate_assignment(uuid,uuid,uuid,boolean,uuid) from public, anon, authenticated;
grant execute on function public.change_candidate_assignment(uuid,uuid,uuid,boolean,uuid) to authenticated;
alter function public.approve_bidder_summary(uuid,uuid,text,bigint,uuid) owner to app_command;
revoke all on function public.approve_bidder_summary(uuid,uuid,text,bigint,uuid) from public, anon, authenticated;
grant execute on function public.approve_bidder_summary(uuid,uuid,text,bigint,uuid) to authenticated;
alter function public.create_draft_bid(uuid,uuid,text,text,uuid) owner to app_command;
revoke all on function public.create_draft_bid(uuid,uuid,text,text,uuid) from public, anon, authenticated;
grant execute on function public.create_draft_bid(uuid,uuid,text,text,uuid) to authenticated;
alter function public.grant_bidder_access(uuid,uuid,uuid,uuid,text,boolean,boolean,timestamptz,uuid) owner to app_command;
revoke all on function public.grant_bidder_access(uuid,uuid,uuid,uuid,text,boolean,boolean,timestamptz,uuid) from public, anon, authenticated;
grant execute on function public.grant_bidder_access(uuid,uuid,uuid,uuid,text,boolean,boolean,timestamptz,uuid) to authenticated;
alter function public.revoke_bidder_access(uuid,uuid,uuid) owner to app_command;
revoke all on function public.revoke_bidder_access(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.revoke_bidder_access(uuid,uuid,uuid) to authenticated;
alter function public.begin_user_provisioning(uuid,uuid,text,text,text) owner to app_command;
revoke all on function public.begin_user_provisioning(uuid,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.begin_user_provisioning(uuid,uuid,text,text,text) to authenticated;
alter function public.complete_user_provisioning(uuid,uuid) owner to app_command;
revoke all on function public.complete_user_provisioning(uuid,uuid) from public, anon, authenticated;
grant execute on function public.complete_user_provisioning(uuid,uuid) to authenticated;
alter function public.record_provisioning_failure(uuid,uuid,text) owner to app_command;
revoke all on function public.record_provisioning_failure(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.record_provisioning_failure(uuid,uuid,text) to authenticated;

-- Ordinary context reads use invoker RLS and never accept a role from the client.
create function public.get_my_context() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('userId',auth.uid(),'organizations',coalesce((
  select jsonb_agg(jsonb_build_object('organizationId',m.organization_id,'name',o.name,'role',m.role,
   'teams',coalesce((select jsonb_agg(jsonb_build_object('teamId',t.id,'name',t.name,'role',tm.role))
     from public.team_memberships tm join public.teams t on t.organization_id=tm.organization_id and t.id=tm.team_id
     where tm.organization_id=m.organization_id and tm.user_id=auth.uid() and tm.active and t.status='active' and tm.role=m.role),'[]'::jsonb)))
  from public.organization_memberships m join public.organizations o on o.id=m.organization_id
  where m.user_id=auth.uid() and m.state='active' and private.org_role(m.organization_id) is not null),'[]'::jsonb))
$$;
revoke all on function public.get_my_context() from public,anon;
grant execute on function public.get_my_context() to authenticated;

-- Bidder projection has column-level access to safe inputs only, plus RLS.
grant select (id,organization_id,full_name,email,phone,location) on public.candidates to app_bidder_reader;
grant select on public.candidate_bid_profiles to app_bidder_reader;
create function private.has_bidder_candidate(p_org uuid,p_candidate uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.bidder_grants(p_org,p_candidate,null,'bid.prepare')) or
 exists(select 1 from public.bids b where b.organization_id=p_org and b.candidate_id=p_candidate
   and exists(select 1 from private.bidder_grants(p_org,p_candidate,b.id,'bid.prepare')))
$$;
alter function private.has_bidder_candidate(uuid,uuid) owner to app_permission_reader;
revoke all on function private.has_bidder_candidate(uuid,uuid) from public;
grant execute on function private.has_bidder_candidate(uuid,uuid) to app_bidder_reader;
create policy bidder_projection on public.candidates for select to app_bidder_reader
 using (private.has_bidder_candidate(organization_id,id));
create policy bidder_projection on public.candidate_bid_profiles for select to app_bidder_reader
 using (private.has_bidder_candidate(organization_id,candidate_id));
create function public.get_bidder_candidate(p_org uuid,p_candidate uuid,p_bid uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_email boolean; v_phone boolean; v_result jsonb;
begin
 select bool_or(g.allow_email),bool_or(g.allow_phone) into v_email,v_phone
 from private.bidder_grants(p_org,p_candidate,p_bid,'bid.prepare') g;
 if v_email is null then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select jsonb_build_object('candidateId',c.id,'fullName',c.full_name,'location',c.location,
  'email',case when v_email then c.email else null end,'phone',case when v_phone then c.phone else null end,
  'approvedSummary',s.approved_summary,'documentReferences','[]'::jsonb)
 into v_result from public.candidates c left join public.candidate_bid_profiles s
  on s.organization_id=c.organization_id and s.candidate_id=c.id
 where c.organization_id=p_org and c.id=p_candidate;
 if v_result is null then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 return v_result;
end $$;
alter function public.get_bidder_candidate(uuid,uuid,uuid) owner to app_bidder_reader;
revoke all on function public.get_bidder_candidate(uuid,uuid,uuid) from public,anon;
grant execute on function public.get_bidder_candidate(uuid,uuid,uuid) to authenticated;
revoke create on schema public, private from app_permission_reader, app_command, app_bidder_reader;
commit;

