-- Foundation anchors only; full profile/workflow/version models follow in later migrations.
-- Tables remain owned by the migration owner, never by runtime command roles.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
revoke create on schema public from public, anon, authenticated;
create role app_permission_reader nologin nobypassrls noinherit;
create role app_command nologin nobypassrls noinherit;
create role app_bidder_reader nologin nobypassrls noinherit;
grant usage on schema public, private, auth to app_permission_reader, app_command, app_bidder_reader;
grant usage on schema private to authenticated;
grant execute on function auth.uid(), auth.role() to app_permission_reader, app_command, app_bidder_reader;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 200),
  status text not null default 'active' check (status in ('active','suspended')),
  default_timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version bigint not null default 1 check (row_version > 0)
);
create table public.users (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null check (length(btrim(display_name)) between 1 and 200),
  status text not null default 'active' check (status in ('active','deactivated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.organization_memberships (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  user_id uuid not null references public.users(id) on delete restrict,
  role text not null check (role in ('admin','team_leader','team_member','bidder')),
  state text not null default 'invited' check (state in ('invited','active','deactivated')),
  created_by uuid references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version bigint not null default 1 check (row_version > 0),
  primary key (organization_id,user_id)
);
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null check (length(btrim(name)) between 1 and 200),
  status text not null default 'active' check (status in ('active','archived')),
  approval_policy jsonb, -- NULL means undecided, never an implicit approval bypass.
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version bigint not null default 1 check (row_version > 0),
  unique (organization_id,id),
  unique (organization_id,name)
);
create table public.team_memberships (
  organization_id uuid not null,
  team_id uuid not null,
  user_id uuid not null,
  role text not null check (role in ('team_leader','team_member','bidder')),
  active boolean not null default true,
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version bigint not null default 1 check (row_version > 0),
  primary key (organization_id,team_id,user_id),
  foreign key (organization_id,team_id) references public.teams(organization_id,id) on delete restrict,
  foreign key (organization_id,user_id) references public.organization_memberships(organization_id,user_id) on delete restrict
);
create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  owning_team_id uuid not null,
  owner_id uuid,
  full_name text not null check (length(btrim(full_name)) between 1 and 200),
  email text,
  phone text,
  location text,
  seniority_preference text,
  status text not null default 'draft' check (status in ('draft','archived')),
  private_notes text,
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version bigint not null default 1 check (row_version > 0),
  unique (organization_id,id),
  unique (organization_id,id,owning_team_id),
  foreign key (organization_id,owning_team_id) references public.teams(organization_id,id) on delete restrict,
  foreign key (organization_id,owner_id) references public.organization_memberships(organization_id,user_id) on delete restrict
);
create table public.candidate_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  candidate_id uuid not null,
  team_id uuid not null,
  user_id uuid not null,
  assignment_kind text not null default 'profile' check (assignment_kind in ('profile')),
  active_from timestamptz not null default now(),
  ended_at timestamptz,
  created_by uuid not null references public.users(id) on delete restrict,
  check (ended_at is null or ended_at >= active_from),
  foreign key (organization_id,candidate_id,team_id) references public.candidates(organization_id,id,owning_team_id) on delete restrict,
  foreign key (organization_id,team_id,user_id) references public.team_memberships(organization_id,team_id,user_id) on delete restrict
);
create unique index candidate_assignment_active on public.candidate_assignments(organization_id,candidate_id,user_id)
  where ended_at is null;
create table public.candidate_bid_profiles (
  organization_id uuid not null,
  candidate_id uuid not null,
  approved_summary text not null check (length(btrim(approved_summary)) between 1 and 4000),
  approved_by uuid not null references public.users(id) on delete restrict,
  approved_at timestamptz not null default now(),
  row_version bigint not null default 1,
  primary key (organization_id,candidate_id),
  foreign key (organization_id,candidate_id) references public.candidates(organization_id,id) on delete restrict
);
create table public.bids (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  candidate_id uuid not null,
  team_id uuid not null,
  owner_id uuid not null,
  company_name text not null,
  job_title text not null,
  status text not null default 'draft' check (status = 'draft'), -- no submission command in this milestone
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version bigint not null default 1,
  unique (organization_id,id),
  unique (organization_id,id,candidate_id),
  foreign key (organization_id,candidate_id) references public.candidates(organization_id,id) on delete restrict,
  foreign key (organization_id,team_id) references public.teams(organization_id,id) on delete restrict,
  foreign key (organization_id,owner_id) references public.organization_memberships(organization_id,user_id) on delete restrict
);
create table public.bid_access_grants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  bid_id uuid,
  candidate_id uuid,
  user_id uuid not null,
  capability text not null check (capability in ('bid.prepare','document.read','document.export')),
  allow_email boolean not null default false,
  allow_phone boolean not null default false,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (num_nonnulls(bid_id,candidate_id) = 1),
  check (expires_at is null or expires_at > created_at),
  foreign key (organization_id,bid_id) references public.bids(organization_id,id) on delete restrict,
  foreign key (organization_id,candidate_id) references public.candidates(organization_id,id) on delete restrict,
  foreign key (organization_id,user_id) references public.organization_memberships(organization_id,user_id) on delete restrict
);
-- Permission anchors; complete scheduling/result workflow is deliberately a later task.
create table public.interviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  bid_id uuid not null,
  round_number integer not null check (round_number > 0),
  scheduled_at timestamptz,
  timezone text,
  lifecycle_status text not null default 'planned' check (lifecycle_status in ('planned','completed','cancelled')),
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version bigint not null default 1,
  unique (organization_id,id),
  unique (bid_id,round_number),
  foreign key (organization_id,bid_id) references public.bids(organization_id,id) on delete restrict
);
create table public.interview_feedback (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  interview_id uuid not null,
  feedback text not null,
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (organization_id,interview_id) references public.interviews(organization_id,id) on delete restrict
);
create table public.administrative_operations (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  operation_id uuid not null,
  actor_id uuid not null references public.users(id) on delete restrict,
  operation_type text not null check (operation_type = 'provision_user'),
  request_hash text not null,
  email text not null,
  display_name text not null,
  desired_role text not null check (desired_role in ('admin','team_leader','team_member','bidder')),
  target_user_id uuid references public.users(id) on delete restrict,
  state text not null default 'pending_auth' check (state in ('pending_auth','awaiting_activation','completed')),
  last_error_code text check (last_error_code in ('AUTH_UNAVAILABLE','CONFIGURATION_REQUIRED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id,operation_id)
);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_id uuid references public.users(id) on delete restrict,
  action text not null,
  subject_id uuid not null,
  team_id uuid,
  request_id uuid not null,
  redacted_change_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (organization_id,team_id) references public.teams(organization_id,id) on delete restrict
);
create index organization_membership_active on public.organization_memberships(user_id,organization_id) where state='active';
create index team_membership_active on public.team_memberships(user_id,organization_id,team_id) where active;
create index candidate_scope on public.candidates(organization_id,owning_team_id);
create index assignment_scope on public.candidate_assignments(organization_id,user_id,candidate_id) where ended_at is null;
create index bid_scope on public.bids(organization_id,team_id,candidate_id);
create index grant_scope on public.bid_access_grants(organization_id,user_id,capability) where revoked_at is null;
create index interview_bid on public.interviews(organization_id,bid_id);
create index feedback_interview on public.interview_feedback(organization_id,interview_id);
create index audit_scope on public.audit_logs(organization_id,created_at desc);

-- RLS is forced even for table owners. No authenticated direct mutation grants.
alter table public.organizations enable row level security;
alter table public.organizations force row level security;
revoke all on public.organizations from public, anon, authenticated;
grant select on public.organizations to authenticated;
alter table public.users enable row level security;
alter table public.users force row level security;
revoke all on public.users from public, anon, authenticated;
grant select on public.users to authenticated;
alter table public.organization_memberships enable row level security;
alter table public.organization_memberships force row level security;
revoke all on public.organization_memberships from public, anon, authenticated;
grant select on public.organization_memberships to authenticated;
alter table public.teams enable row level security;
alter table public.teams force row level security;
revoke all on public.teams from public, anon, authenticated;
grant select on public.teams to authenticated;
alter table public.team_memberships enable row level security;
alter table public.team_memberships force row level security;
revoke all on public.team_memberships from public, anon, authenticated;
grant select on public.team_memberships to authenticated;
alter table public.candidates enable row level security;
alter table public.candidates force row level security;
revoke all on public.candidates from public, anon, authenticated;
grant select on public.candidates to authenticated;
alter table public.candidate_assignments enable row level security;
alter table public.candidate_assignments force row level security;
revoke all on public.candidate_assignments from public, anon, authenticated;
grant select on public.candidate_assignments to authenticated;
alter table public.candidate_bid_profiles enable row level security;
alter table public.candidate_bid_profiles force row level security;
revoke all on public.candidate_bid_profiles from public, anon, authenticated;
grant select on public.candidate_bid_profiles to authenticated;
alter table public.bids enable row level security;
alter table public.bids force row level security;
revoke all on public.bids from public, anon, authenticated;
grant select on public.bids to authenticated;
alter table public.bid_access_grants enable row level security;
alter table public.bid_access_grants force row level security;
revoke all on public.bid_access_grants from public, anon, authenticated;
grant select on public.bid_access_grants to authenticated;
alter table public.interviews enable row level security;
alter table public.interviews force row level security;
revoke all on public.interviews from public, anon, authenticated;
grant select on public.interviews to authenticated;
alter table public.interview_feedback enable row level security;
alter table public.interview_feedback force row level security;
revoke all on public.interview_feedback from public, anon, authenticated;
grant select on public.interview_feedback to authenticated;
alter table public.administrative_operations enable row level security;
alter table public.administrative_operations force row level security;
revoke all on public.administrative_operations from public, anon, authenticated;
grant select on public.administrative_operations to authenticated;
alter table public.audit_logs enable row level security;
alter table public.audit_logs force row level security;
revoke all on public.audit_logs from public, anon, authenticated;
grant select on public.audit_logs to authenticated;

-- A non-login scope reader breaks membership-policy recursion. It cannot read
-- profile bodies, private notes, feedback, audit payloads, or Auth password data.
grant select on public.organizations, public.users, public.organization_memberships,
  public.teams, public.team_memberships, public.candidate_assignments,
  public.bid_access_grants to app_permission_reader;
grant select (id,organization_id,owning_team_id) on public.candidates to app_permission_reader;
grant select (id,organization_id,candidate_id,team_id,owner_id) on public.bids to app_permission_reader;
grant select (id,organization_id,bid_id) on public.interviews to app_permission_reader;
grant select (id,email,email_confirmed_at) on auth.users to app_permission_reader;
create policy scope_reader on public.organizations for select to app_permission_reader using (true);
create policy scope_reader on public.users for select to app_permission_reader using (true);
create policy scope_reader on public.organization_memberships for select to app_permission_reader using (true);
create policy scope_reader on public.teams for select to app_permission_reader using (true);
create policy scope_reader on public.team_memberships for select to app_permission_reader using (true);
create policy scope_reader on public.candidates for select to app_permission_reader using (true);
create policy scope_reader on public.candidate_assignments for select to app_permission_reader using (true);
create policy scope_reader on public.bids for select to app_permission_reader using (true);
create policy scope_reader on public.bid_access_grants for select to app_permission_reader using (true);
create policy scope_reader on public.interviews for select to app_permission_reader using (true);

create function private.org_role(p_org uuid) returns text language sql stable security definer set search_path = ''
as $$
  select m.role from public.organization_memberships m
  join public.users u on u.id=m.user_id and u.status='active'
  join public.organizations o on o.id=m.organization_id and o.status='active'
  where m.organization_id=p_org and m.user_id=auth.uid() and m.state='active'
$$;
create function private.in_team(p_org uuid,p_team uuid) returns boolean language sql stable security definer set search_path = ''
as $$
  select exists(select 1 from public.team_memberships m join public.teams t
    on t.organization_id=m.organization_id and t.id=m.team_id and t.status='active'
    where m.organization_id=p_org and m.team_id=p_team and m.user_id=auth.uid()
      and m.active and m.role=private.org_role(p_org))
$$;
create function private.manages_team(p_org uuid,p_team uuid) returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(private.org_role(p_org)='admin' or
  (private.org_role(p_org)='team_leader' and private.in_team(p_org,p_team)),false) $$;
create function private.reads_candidate(p_org uuid,p_candidate uuid) returns boolean language sql stable security definer set search_path = ''
as $$
 select exists(select 1 from public.candidates c where c.organization_id=p_org and c.id=p_candidate and (
   private.manages_team(p_org,c.owning_team_id) or
   (private.org_role(p_org)='team_member' and private.in_team(p_org,c.owning_team_id)
    and exists(select 1 from public.candidate_assignments a where a.organization_id=p_org
      and a.candidate_id=c.id and a.user_id=auth.uid() and a.ended_at is null and a.active_from<=now()))))
$$;
create function private.bidder_grants(p_org uuid,p_candidate uuid,p_bid uuid,p_capability text)
returns table(allow_email boolean,allow_phone boolean) language sql stable security definer set search_path = ''
as $$
 select g.allow_email,g.allow_phone from public.bid_access_grants g
 join public.candidates c on c.organization_id=g.organization_id and c.id=p_candidate
 left join public.bids b on b.organization_id=p_org and b.id=p_bid and b.candidate_id=c.id
 where g.organization_id=p_org and g.user_id=auth.uid() and private.org_role(p_org)='bidder'
  and g.capability=p_capability and g.revoked_at is null and (g.expires_at is null or g.expires_at>now())
  and ((g.candidate_id=c.id and (p_bid is null or b.id is not null)
        and private.in_team(p_org,coalesce(b.team_id,c.owning_team_id)))
       or (p_bid is not null and g.bid_id=b.id and private.in_team(p_org,b.team_id)))
$$;
create function private.reads_bid(p_org uuid,p_bid uuid) returns boolean language sql stable security definer set search_path = ''
as $$
 select exists(select 1 from public.bids b where b.organization_id=p_org and b.id=p_bid and
  (private.manages_team(p_org,b.team_id) or
   (private.org_role(p_org)='team_member' and private.in_team(p_org,b.team_id) and private.reads_candidate(p_org,b.candidate_id)) or
   exists(select 1 from private.bidder_grants(p_org,b.candidate_id,b.id,'bid.prepare'))))
$$;
create function private.reads_interview(p_org uuid,p_interview uuid) returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(private.org_role(p_org)<>'bidder' and exists(select 1 from public.interviews i
 where i.organization_id=p_org and i.id=p_interview and private.reads_bid(p_org,i.bid_id)),false) $$;
create function private.auth_identity(p_email text) returns table(id uuid,confirmed boolean)
language sql stable security definer set search_path = ''
as $$ select u.id,u.email_confirmed_at is not null from auth.users u where lower(u.email)=lower(p_email) $$;

alter function private.org_role(uuid) owner to app_permission_reader;
revoke all on function private.org_role(uuid) from public, anon, authenticated;
grant execute on function private.org_role(uuid) to app_command, app_bidder_reader;
alter function private.in_team(uuid,uuid) owner to app_permission_reader;
revoke all on function private.in_team(uuid,uuid) from public, anon, authenticated;
grant execute on function private.in_team(uuid,uuid) to app_command, app_bidder_reader;
alter function private.manages_team(uuid,uuid) owner to app_permission_reader;
revoke all on function private.manages_team(uuid,uuid) from public, anon, authenticated;
grant execute on function private.manages_team(uuid,uuid) to app_command, app_bidder_reader;
alter function private.reads_candidate(uuid,uuid) owner to app_permission_reader;
revoke all on function private.reads_candidate(uuid,uuid) from public, anon, authenticated;
grant execute on function private.reads_candidate(uuid,uuid) to app_command, app_bidder_reader;
alter function private.bidder_grants(uuid,uuid,uuid,text) owner to app_permission_reader;
revoke all on function private.bidder_grants(uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function private.bidder_grants(uuid,uuid,uuid,text) to app_command, app_bidder_reader;
alter function private.reads_bid(uuid,uuid) owner to app_permission_reader;
revoke all on function private.reads_bid(uuid,uuid) from public, anon, authenticated;
grant execute on function private.reads_bid(uuid,uuid) to app_command, app_bidder_reader;
alter function private.reads_interview(uuid,uuid) owner to app_permission_reader;
revoke all on function private.reads_interview(uuid,uuid) from public, anon, authenticated;
grant execute on function private.reads_interview(uuid,uuid) to app_command, app_bidder_reader;
alter function private.auth_identity(text) owner to app_permission_reader;
revoke all on function private.auth_identity(text) from public, anon, authenticated;
grant execute on function private.auth_identity(text) to app_command, app_bidder_reader;
grant execute on function private.org_role(uuid),private.in_team(uuid,uuid),
 private.manages_team(uuid,uuid),private.reads_candidate(uuid,uuid),
 private.reads_bid(uuid,uuid),private.reads_interview(uuid,uuid) to authenticated;

create policy visible on public.organizations for select to authenticated using (private.org_role(id) is not null);
create policy visible on public.users for select to authenticated using (id=auth.uid());
create policy visible on public.organization_memberships for select to authenticated
 using (private.org_role(organization_id)='admin' or (user_id=auth.uid() and private.org_role(organization_id) is not null));
create policy visible on public.teams for select to authenticated
 using (private.org_role(organization_id)='admin' or private.in_team(organization_id,id));
create policy visible on public.team_memberships for select to authenticated
 using (private.manages_team(organization_id,team_id) or (user_id=auth.uid() and private.org_role(organization_id) is not null));
create policy visible on public.candidates for select to authenticated using (private.reads_candidate(organization_id,id));
create policy visible on public.candidate_assignments for select to authenticated using (private.reads_candidate(organization_id,candidate_id));
create policy visible on public.candidate_bid_profiles for select to authenticated using (private.reads_candidate(organization_id,candidate_id));
create policy visible on public.bids for select to authenticated using (private.reads_bid(organization_id,id));
create policy visible on public.bid_access_grants for select to authenticated
 using (private.org_role(organization_id)='admin' or (user_id=auth.uid() and private.org_role(organization_id) is not null));
create policy visible on public.interviews for select to authenticated using (private.reads_interview(organization_id,id));
create policy visible on public.interview_feedback for select to authenticated using (private.reads_interview(organization_id,interview_id));
create policy visible on public.administrative_operations for select to authenticated using (private.org_role(organization_id)='admin');
-- Redacted summaries only. Members/bidders never inherit another actor's activity.
create policy visible on public.audit_logs for select to authenticated using (
 private.org_role(organization_id)='admin' or
 (private.org_role(organization_id)='team_leader' and private.in_team(organization_id,team_id)) or
 (private.org_role(organization_id) is not null and actor_id=auth.uid()));

-- Protect stored assignment history even against accidental command-role updates.
create function private.guard_assignment_history() returns trigger language plpgsql set search_path = '' as $$
begin
 if tg_op='DELETE' then raise exception 'immutable assignment history' using errcode='42501'; end if;
 if old.ended_at is not null or new.ended_at is null or
    (to_jsonb(new)-'ended_at') is distinct from (to_jsonb(old)-'ended_at') then
   raise exception 'immutable assignment history' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function private.guard_assignment_history() from public;
create trigger assignment_history before update or delete on public.candidate_assignments
 for each row execute function private.guard_assignment_history();

commit;

