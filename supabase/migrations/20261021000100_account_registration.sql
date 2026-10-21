-- Public registration is an admission request, never a membership grant.
begin;
create role app_registration_writer nologin nobypassrls noinherit;
grant app_registration_writer to postgres;
grant usage on schema public,private to app_registration_writer;
grant create on schema public,private to app_registration_writer,app_command,app_permission_reader;
create table private.registration_configuration (
 singleton boolean primary key default true check(singleton),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 enabled boolean not null default false
);
revoke all on private.registration_configuration from public,anon,authenticated;
grant select on private.registration_configuration to app_registration_writer;
create table public.account_requests (
 user_id uuid primary key references auth.users(id) on delete restrict,
 organization_id uuid not null references public.organizations(id) on delete restrict,
 full_name text not null check(length(btrim(full_name)) between 1 and 200),
 email text not null check(length(email) between 3 and 320),
 registered_at timestamptz not null default now(),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 assigned_role text check(assigned_role in ('admin','team_leader','team_member','bidder')),
 team_id uuid,
 reviewed_by uuid references public.users(id) on delete restrict,
 reviewed_at timestamptz,
 reason text check(length(reason)<=2000),
 row_version bigint not null default 1 check(row_version>0),
 foreign key(organization_id,team_id) references public.teams(organization_id,id) on delete restrict,
 check((status='pending' and assigned_role is null and team_id is null and reviewed_by is null and reviewed_at is null and reason is null)
 or (status='rejected' and assigned_role is null and team_id is null and reviewed_by is not null and reviewed_at is not null)
 or (status='approved' and assigned_role is not null and reviewed_by is not null and reviewed_at is not null
 and ((assigned_role='admin' and team_id is null) or (assigned_role<>'admin' and team_id is not null))))
);
create index account_requests_review on public.account_requests(organization_id,status,registered_at,user_id);
alter table public.account_requests enable row level security;
alter table public.account_requests force row level security;
revoke all on public.account_requests from public,anon,authenticated;
-- Only the status projection is public to applicants; the raw relation is Admin-only.
grant select on public.account_requests to authenticated,app_permission_reader,app_command;
grant insert on public.account_requests to app_registration_writer;
grant update on public.account_requests to app_command;
create policy scope_reader on public.account_requests for select to app_permission_reader using(true);
create policy capture on public.account_requests for insert to app_registration_writer with check(status='pending');
create policy reviewer_read on public.account_requests for select to authenticated using(private.org_role(organization_id)='admin');
create policy command_read on public.account_requests for select to app_command using(user_id=private.actor_id() or private.org_role(organization_id)='admin');
create policy command_review on public.account_requests for update to app_command using(private.org_role(organization_id)='admin') with check(private.org_role(organization_id)='admin');

create function public.configure_registration(p_org uuid,p_enabled boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 if private.actor_role() is distinct from 'service_role' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_enabled is null or not exists(select 1 from public.organizations where id=p_org and status='active')
 or not exists(select 1 from public.organization_memberships where organization_id=p_org and role='admin' and state='active')
 then raise exception 'INVALID_REGISTRATION_ORGANIZATION' using errcode='22023'; end if;
 insert into private.registration_configuration(singleton,organization_id,enabled) values(true,p_org,p_enabled)
 on conflict(singleton) do update set organization_id=excluded.organization_id,enabled=excluded.enabled;
end $$;
revoke all on function public.configure_registration(uuid,boolean) from public,anon,authenticated;
grant execute on function public.configure_registration(uuid,boolean) to service_role;

create function public.registration_available() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.registration_configuration c join public.organizations o on o.id=c.organization_id where c.enabled and o.status='active')
$$;
grant select(id,status) on public.organizations to app_registration_writer;
create policy registration_target on public.organizations for select to app_registration_writer using(true);
alter function public.registration_available() owner to app_registration_writer;
revoke all on function public.registration_available() from public;
grant execute on function public.registration_available() to anon,authenticated;

create function private.capture_account_request() returns trigger language plpgsql security definer set search_path='' as $$
declare v_org uuid; v_name text;
begin
 -- Trusted invitations retain the existing provisioning/activation workflow.
 if new.invited_at is not null then return new; end if;
 select c.organization_id into v_org from private.registration_configuration c join public.organizations o on o.id=c.organization_id
 where c.enabled and o.status='active';
 if v_org is null then
   if new.raw_user_meta_data->>'registration_flow'='approval_v1' then raise exception 'REGISTRATION_UNAVAILABLE'; end if;
   return new;
 end if;
 v_name:=btrim(new.raw_user_meta_data->>'full_name');
 if v_name is null or length(v_name) not between 1 and 200 or new.email is null then raise exception 'INVALID_REGISTRATION'; end if;
 insert into public.account_requests(user_id,organization_id,full_name,email) values(new.id,v_org,v_name,lower(new.email));
 return new;
end $$;
alter function private.capture_account_request() owner to app_registration_writer;
revoke all on function private.capture_account_request() from public,anon,authenticated;
create trigger capture_account_request after insert on auth.users for each row execute function private.capture_account_request();

-- A narrow managed-Auth bridge; never grant Auth-table access to runtime roles.
create function private.registration_identity(p_user uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('email',email,'emailVerified',email_confirmed_at is not null) from auth.users where id=p_user
$$;
revoke all on function private.registration_identity(uuid) from public,anon,authenticated;
grant execute on function private.registration_identity(uuid) to app_command;
grant execute on function private.identity_confirmed(uuid) to app_permission_reader;
create or replace function private.org_role(p_org uuid) returns text language sql stable security definer set search_path='' as $$
 select m.role from public.organization_memberships m
 join public.users u on u.id=m.user_id and u.status='active'
 join public.organizations o on o.id=m.organization_id and o.status='active'
 where m.organization_id=p_org and m.user_id=private.actor_id() and m.state='active'
 and not exists(select 1 from public.account_requests r where r.user_id=m.user_id
   and (r.status<>'approved' or not private.identity_confirmed(r.user_id)))
$$;

create function public.get_my_account_status() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
 if private.actor_id() is null then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select jsonb_build_object('status',status,'registeredAt',registered_at,'reviewedAt',reviewed_at,'reason',reason,
 'emailVerified',coalesce((private.registration_identity(user_id)->>'emailVerified')::boolean,false)) into v_result
 from public.account_requests where user_id=private.actor_id();
 return coalesce(v_result,jsonb_build_object('status','not_requested'));
end $$;
alter function public.get_my_account_status() owner to app_command;
revoke all on function public.get_my_account_status() from public,anon;
grant execute on function public.get_my_account_status() to authenticated;

create function public.list_account_requests(p_org uuid,p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if private.org_role(p_org) is distinct from 'admin' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_offset<0 or p_offset>100000 then raise exception 'INVALID_OFFSET' using errcode='22023'; end if;
 return coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('registered_email',r.email,
 'email',coalesce(private.registration_identity(r.user_id)->>'email',r.email),
 'email_verified',coalesce((private.registration_identity(r.user_id)->>'emailVerified')::boolean,false)))
 from (select * from public.account_requests where organization_id=p_org order by registered_at desc,user_id limit 50 offset p_offset) r),'[]'::jsonb);
end $$;
alter function public.list_account_requests(uuid,integer) owner to app_command;
revoke all on function public.list_account_requests(uuid,integer) from public,anon;
grant execute on function public.list_account_requests(uuid,integer) to authenticated;

create function public.review_account_request(p_org uuid,p_user uuid,p_decision text,p_role text,p_team uuid,p_reason text,p_expected bigint,p_request uuid)
returns bigint language plpgsql security definer set search_path='' as $$
declare r public.account_requests; v_reason text:=nullif(btrim(p_reason),'');
begin
 if private.org_role(p_org) is distinct from 'admin' or p_user=private.actor_id() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 -- Same organization lock order as existing membership commands; serialize concurrent reviewers.
 perform 1 from public.organizations where id=p_org for update;
 select * into r from public.account_requests where organization_id=p_org and user_id=p_user for update;
 if not found then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_decision not in ('approved','rejected') or p_decision is null or length(v_reason)>2000 or p_expected is null or p_request is null
 or (p_decision='rejected' and (p_role is not null or p_team is not null))
 or (p_decision='approved' and (p_role is null or p_role not in ('admin','team_leader','team_member','bidder')
   or (p_role='admin' and p_team is not null) or (p_role<>'admin' and p_team is null))) then raise exception 'INVALID_REVIEW' using errcode='22023'; end if;
 if r.status<>'pending' then
   if r.status=p_decision and r.assigned_role is not distinct from p_role and r.team_id is not distinct from p_team and r.reason is not distinct from v_reason then return r.row_version; end if;
   raise exception 'VERSION_CONFLICT' using errcode='40001';
 end if;
 if r.row_version<>p_expected then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
 if p_decision='approved' then
   if not private.identity_confirmed(p_user) then raise exception 'IDENTITY_NOT_CONFIRMED' using errcode='22023'; end if;
   if p_team is not null and not exists(select 1 from public.teams where organization_id=p_org and id=p_team and status='active') then raise exception 'INVALID_TEAM' using errcode='22023'; end if;
   if exists(select 1 from public.users where id=p_user and status<>'active')
     or exists(select 1 from public.organization_memberships where organization_id=p_org and user_id=p_user) then raise exception 'EXISTING_MEMBERSHIP' using errcode='40001'; end if;
   insert into public.users(id,display_name) values(p_user,r.full_name) on conflict(id) do nothing;
   insert into public.organization_memberships(organization_id,user_id,role,state,created_by) values(p_org,p_user,p_role,'active',private.actor_id());
   if p_team is not null then insert into public.team_memberships(organization_id,team_id,user_id,role,created_by) values(p_org,p_team,p_user,p_role,private.actor_id()); end if;
 end if;
 update public.account_requests set status=p_decision,assigned_role=p_role,team_id=p_team,reason=v_reason,
 reviewed_by=private.actor_id(),reviewed_at=now(),row_version=row_version+1 where user_id=p_user;
 perform private.audit(p_org,'account.'||p_decision,p_user,p_request,p_team,jsonb_build_object('role',p_role));
 return r.row_version+1;
end $$;
alter function public.review_account_request(uuid,uuid,text,text,uuid,text,bigint,uuid) owner to app_command;
revoke all on function public.review_account_request(uuid,uuid,text,text,uuid,text,bigint,uuid) from public,anon;
grant execute on function public.review_account_request(uuid,uuid,text,text,uuid,text,bigint,uuid) to authenticated;
revoke create on schema public,private from app_registration_writer,app_command,app_permission_reader;
commit;
