begin;
alter table public.candidates alter column full_name drop not null;
alter table public.candidates drop constraint candidates_full_name_check;
alter table public.candidates add check(full_name is null or length(btrim(full_name)) between 1 and 200);
alter table public.candidates drop constraint candidates_status_check;
alter table public.candidates add check(status in ('draft','ready','archived'));
alter table public.candidates add column professional_summary text;
alter table public.candidates add column archived_from_status text check(archived_from_status in ('draft','ready'));
-- C01: the user explicitly selected name + email + location + phone for Ready.
alter table public.candidates add constraint candidate_ready_fields check(status<>'ready' or
 (full_name is not null and email is not null and location is not null and phone is not null));
alter table public.candidates add check(email is null or (length(email)<=320 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'));
alter table public.candidates add check(location is null or length(btrim(location)) between 1 and 500);
alter table public.candidates add check(phone is null or (length(phone)<=40 and phone ~ '^[+0-9(). xXeEtT-]+$'
 and length(regexp_replace(phone,'[^0-9]','','g')) between 7 and 20));
create index candidate_directory on public.candidates(organization_id,status,owning_team_id,updated_at desc,id);
create index candidate_directory_name on public.candidates(organization_id,lower(full_name),id);

-- Date strings retain their original year/month/day precision; range endpoints
-- are comparison-only and are never written as fabricated source dates.
create function private.date_bounds(p_value text) returns daterange language plpgsql immutable set search_path='' as $$
declare v_start date; v_end date; v_parts text[];
begin
 if p_value is null then return null; end if;
 if p_value !~ '^[0-9]{4}(-[0-9]{2})?(-[0-9]{2})?$' then raise exception 'INVALID_PARTIAL_DATE' using errcode='22023'; end if;
 v_parts:=string_to_array(p_value,'-');
 v_start:=make_date(v_parts[1]::integer,coalesce(v_parts[2]::integer,1),coalesce(v_parts[3]::integer,1));
 v_end:=case cardinality(v_parts) when 1 then (v_start+interval '1 year')::date
  when 2 then (v_start+interval '1 month')::date else v_start+1 end;
 return daterange(v_start,v_end,'[)');
exception when datetime_field_overflow then raise exception 'INVALID_PARTIAL_DATE' using errcode='22023';
end $$;
create function private.valid_period(p_start text,p_end text) returns boolean language sql immutable set search_path='' as $$
 select (p_start is null or private.date_bounds(p_start) is not null) and
 (p_end is null or private.date_bounds(p_end) is not null) and
 (p_start is null or p_end is null or lower(private.date_bounds(p_start))<upper(private.date_bounds(p_end)))
$$;
revoke all on function private.date_bounds(text),private.valid_period(text,text) from public;
grant execute on function private.date_bounds(text),private.valid_period(text,text) to app_command,authenticated;

create table public.work_experiences(
 id uuid primary key, organization_id uuid not null, candidate_id uuid not null,
 company text, official_title text, proposed_display_title text,
 title_policy text not null default 'fixed' check(title_policy in ('fixed','tailorable','omit')),
 approved_display_title text, title_approved_by uuid references public.users(id), title_approved_at timestamptz,
 start_date text, end_date text, is_current boolean not null default false, location text,
 source_bullets text[] not null default '{}', achievements text[] not null default '{}',
 preferred_bullet_count integer check(preferred_bullet_count between 1 and 30),
 check(not is_current or end_date is null),
 check(private.valid_period(start_date,end_date)),
 sort_order integer not null check(sort_order>=0),
 removed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(organization_id,candidate_id) references public.candidates(organization_id,id) on delete restrict
);
create index work_experiences_profile on public.work_experiences(organization_id,candidate_id,sort_order) where removed_at is null;
alter table public.work_experiences enable row level security;
alter table public.work_experiences force row level security;
revoke all on public.work_experiences from public,anon,authenticated;
grant select on public.work_experiences to authenticated,app_command;
grant insert,update on public.work_experiences to app_command;
create policy visible on public.work_experiences for select to authenticated,app_command
 using(private.reads_candidate(organization_id,candidate_id));

create table public.educations(
 id uuid primary key, organization_id uuid not null, candidate_id uuid not null,
 institution text, degree text, field_of_study text,
 start_date text, end_date text, display_policy text not null default 'fixed' check(display_policy in ('fixed','tailorable','omit')),
 check(private.valid_period(start_date,end_date)),
 sort_order integer not null check(sort_order>=0),
 removed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(organization_id,candidate_id) references public.candidates(organization_id,id) on delete restrict
);
create index educations_profile on public.educations(organization_id,candidate_id,sort_order) where removed_at is null;
alter table public.educations enable row level security;
alter table public.educations force row level security;
revoke all on public.educations from public,anon,authenticated;
grant select on public.educations to authenticated,app_command;
grant insert,update on public.educations to app_command;
create policy visible on public.educations for select to authenticated,app_command
 using(private.reads_candidate(organization_id,candidate_id));

create table public.certifications(
 id uuid primary key, organization_id uuid not null, candidate_id uuid not null,
 name text, issuer text, issue_date text, expiry_date text,
 verification_status text not null default 'unverified' check(verification_status in ('unverified','verified','expired')),
 credential_id text, check(private.valid_period(issue_date,expiry_date)),
 sort_order integer not null check(sort_order>=0),
 removed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(organization_id,candidate_id) references public.candidates(organization_id,id) on delete restrict
);
create index certifications_profile on public.certifications(organization_id,candidate_id,sort_order) where removed_at is null;
alter table public.certifications enable row level security;
alter table public.certifications force row level security;
revoke all on public.certifications from public,anon,authenticated;
grant select on public.certifications to authenticated,app_command;
grant insert,update on public.certifications to app_command;
create policy visible on public.certifications for select to authenticated,app_command
 using(private.reads_candidate(organization_id,candidate_id));

create table public.candidate_links(
 id uuid primary key, organization_id uuid not null, candidate_id uuid not null,
 link_type text not null check(link_type in ('linkedin','github','website','portfolio','other')),
 url text not null check(length(url)<=2048 and url ~ '^https?://[^/?#[:space:]@]+([/?#][^[:cntrl:]]*)?$'),
 sort_order integer not null check(sort_order>=0),
 removed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(organization_id,candidate_id) references public.candidates(organization_id,id) on delete restrict
);
create index candidate_links_profile on public.candidate_links(organization_id,candidate_id,sort_order) where removed_at is null;
alter table public.candidate_links enable row level security;
alter table public.candidate_links force row level security;
revoke all on public.candidate_links from public,anon,authenticated;
grant select on public.candidate_links to authenticated,app_command;
grant insert,update on public.candidate_links to app_command;
create policy visible on public.candidate_links for select to authenticated,app_command
 using(private.reads_candidate(organization_id,candidate_id));

create table public.candidate_profile_revisions(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, candidate_id uuid not null,
 revision_number bigint not null check(revision_number>0), verified_snapshot jsonb not null,
 changed_by uuid references public.users(id), request_id uuid not null, created_at timestamptz not null default now(),
 unique(candidate_id,revision_number),
 foreign key(organization_id,candidate_id) references public.candidates(organization_id,id) on delete restrict
);
alter table public.candidate_profile_revisions enable row level security;
alter table public.candidate_profile_revisions force row level security;
revoke all on public.candidate_profile_revisions from public,anon,authenticated;
grant select on public.candidate_profile_revisions to authenticated,app_command;
grant insert on public.candidate_profile_revisions to app_command;
create policy visible on public.candidate_profile_revisions for select to authenticated,app_command
 using(private.reads_candidate(organization_id,candidate_id));
create policy append_revision on public.candidate_profile_revisions for insert to app_command
 with check(private.reads_candidate(organization_id,candidate_id) and changed_by=private.actor_id());
create function private.immutable_revision() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'IMMUTABLE_PROFILE_REVISION' using errcode='42501'; end $$;
revoke all on function private.immutable_revision() from public;
create trigger immutable before update or delete on public.candidate_profile_revisions
 for each row execute function private.immutable_revision();

grant create on schema private to app_permission_reader;
create function private.edits_candidate(p_org uuid,p_candidate uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.reads_candidate(p_org,p_candidate) and exists(select 1 from public.candidates c
  where c.organization_id=p_org and c.id=p_candidate and c.status<>'archived')
$$;
-- status is the only additional scope column needed by the permission reader.
grant select(status) on public.candidates to app_permission_reader;
alter function private.edits_candidate(uuid,uuid) owner to app_permission_reader;
revoke all on function private.edits_candidate(uuid,uuid) from public;
grant execute on function private.edits_candidate(uuid,uuid) to app_command;
revoke create on schema private from app_permission_reader;
create policy command_insert on public.work_experiences for insert to app_command with check(private.edits_candidate(organization_id,candidate_id));
create policy command_update on public.work_experiences for update to app_command using(private.edits_candidate(organization_id,candidate_id)) with check(private.edits_candidate(organization_id,candidate_id));
create policy command_insert on public.educations for insert to app_command with check(private.edits_candidate(organization_id,candidate_id));
create policy command_update on public.educations for update to app_command using(private.edits_candidate(organization_id,candidate_id)) with check(private.edits_candidate(organization_id,candidate_id));
create policy command_insert on public.certifications for insert to app_command with check(private.edits_candidate(organization_id,candidate_id));
create policy command_update on public.certifications for update to app_command using(private.edits_candidate(organization_id,candidate_id)) with check(private.edits_candidate(organization_id,candidate_id));
create policy command_insert on public.candidate_links for insert to app_command with check(private.edits_candidate(organization_id,candidate_id));
create policy command_update on public.candidate_links for update to app_command using(private.edits_candidate(organization_id,candidate_id)) with check(private.edits_candidate(organization_id,candidate_id));
alter policy command_select on public.candidates using(private.manages_team(organization_id,owning_team_id) or private.reads_candidate(organization_id,id));
alter policy command_update on public.candidates using(private.reads_candidate(organization_id,id)) with check(private.reads_candidate(organization_id,id));
create function private.guard_profile_parent() returns trigger language plpgsql set search_path='' as $$
begin
 if new.id<>old.id or new.organization_id<>old.organization_id or new.candidate_id<>old.candidate_id then
  raise exception 'IMMUTABLE_PROFILE_PARENT' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function private.guard_profile_parent() from public;
create trigger immutable_parent before update on public.work_experiences for each row execute function private.guard_profile_parent();
create trigger immutable_parent before update on public.educations for each row execute function private.guard_profile_parent();
create trigger immutable_parent before update on public.certifications for each row execute function private.guard_profile_parent();
create trigger immutable_parent before update on public.candidate_links for each row execute function private.guard_profile_parent();
commit;

