begin;
create function public.set_candidate_assignment(p_org uuid,p_candidate uuid,p_user uuid,p_assign boolean,p_expected bigint,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_row public.candidates; v_id uuid; v_changed boolean:=false;
begin
 perform 1 from public.organizations where id=p_org for update;
 select * into v_row from public.candidates where organization_id=p_org and id=p_candidate for update;
 if not found or not private.manages_team(p_org,v_row.owning_team_id) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if v_row.row_version is distinct from p_expected then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
 if v_row.status='archived' then raise exception 'CANDIDATE_ARCHIVED' using errcode='22023'; end if;
 if p_assign is null then raise exception 'INVALID_ASSIGNMENT' using errcode='22023'; end if;
 if p_assign and not private.eligible_assignee(p_org,v_row.owning_team_id,p_user,true) then raise exception 'INVALID_ASSIGNEE' using errcode='22023'; end if;
 select id into v_id from public.candidate_assignments where organization_id=p_org and candidate_id=p_candidate
  and user_id=p_user and team_id=v_row.owning_team_id and ended_at is null;
 if p_assign and v_id is null then
  insert into public.candidate_assignments(organization_id,candidate_id,team_id,user_id,created_by)
  values(p_org,p_candidate,v_row.owning_team_id,p_user,private.actor_id()); v_changed:=true;
 elsif not p_assign and v_id is not null then
  update public.candidate_assignments set ended_at=greatest(now(),active_from) where id=v_id; v_changed:=true;
 end if;
 if v_changed then
  update public.candidates set row_version=row_version+1,updated_at=now() where organization_id=p_org and id=p_candidate;
  perform private.append_profile_revision(p_org,p_candidate,p_request);
  perform private.audit(p_org,'candidate.assignment_changed',p_candidate,p_request,v_row.owning_team_id,jsonb_build_object('assigned',p_assign,'userId',p_user));
 end if;
 return private.profile_json(p_org,p_candidate);
end $$;
grant create on schema public to app_command;
alter function public.set_candidate_assignment(uuid,uuid,uuid,boolean,bigint,uuid) owner to app_command;
revoke create on schema public from app_command;
revoke all on function public.set_candidate_assignment(uuid,uuid,uuid,boolean,bigint,uuid) from public,anon;
grant execute on function public.set_candidate_assignment(uuid,uuid,uuid,boolean,bigint,uuid) to authenticated;
-- Do not leave a direct legacy RPC that bypasses the new optimistic boundary.
revoke execute on function public.change_candidate_assignment(uuid,uuid,uuid,boolean,uuid) from authenticated,public,anon;

create or replace function private.candidate_team(p_org uuid,p_candidate uuid) returns uuid language sql stable security definer set search_path='' as $$
 select c.owning_team_id from public.candidates c where c.organization_id=p_org and c.id=p_candidate and c.status<>'archived' and
 (private.reads_candidate(p_org,p_candidate) or exists(select 1 from private.bidder_grants(p_org,p_candidate,null,'bid.prepare')))
$$;

-- Leader roster access is a boolean permission check; ordinary table queries
-- still use authenticated context/RLS and expose only their managed teams.
grant create on schema private to app_permission_reader;
create function private.reads_membership(p_org uuid,p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.org_role(p_org)='admin' or (p_user=private.actor_id() and private.org_role(p_org) is not null) or exists(
  select 1 from public.team_memberships tm join public.organization_memberships m
   on m.organization_id=tm.organization_id and m.user_id=tm.user_id
  where tm.organization_id=p_org and tm.user_id=p_user and tm.active and m.state='active' and tm.role=m.role
   and private.manages_team(p_org,tm.team_id))
$$;
alter function private.reads_membership(uuid,uuid) owner to app_permission_reader;
revoke all on function private.reads_membership(uuid,uuid) from public;
grant execute on function private.reads_membership(uuid,uuid) to authenticated;
revoke create on schema private from app_permission_reader;
alter policy visible on public.organization_memberships using(private.reads_membership(organization_id,user_id));
create or replace function private.can_read_user(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.organization_memberships m where m.user_id=p_user
  and private.reads_membership(m.organization_id,p_user))
$$;

create function public.list_candidates(p_org uuid,p_query text default '',p_status text default 'active',p_team uuid default null,
 p_owner uuid default null,p_assignee uuid default null,p_unassigned boolean default false,p_sort text default 'updated_desc',
 p_page integer default 1,p_page_size integer default 25)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_result jsonb; v_search text;
begin
 if private.org_role(p_org) is null or private.org_role(p_org)='bidder' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_status not in ('active','all','draft','ready','archived') or p_sort not in ('updated_desc','name_asc','name_desc','created_desc')
  or p_page not between 1 and 100000 or p_page_size not between 1 and 100 or length(p_query)>200 then raise exception 'INVALID_FILTER' using errcode='22023'; end if;
 v_search:=replace(replace(replace(p_query,chr(92),chr(92)||chr(92)),'%',chr(92)||'%'),'_',chr(92)||'_');
 with filtered as materialized (
  select c.* from public.candidates c where c.organization_id=p_org
   and (p_status='all' or (p_status='active' and c.status<>'archived') or c.status=p_status)
   and (p_team is null or c.owning_team_id=p_team) and (p_owner is null or c.owner_id=p_owner)
   and (p_query='' or c.full_name ilike '%'||v_search||'%' or c.email ilike '%'||v_search||'%' or c.location ilike '%'||v_search||'%')
   and (p_assignee is null or exists(select 1 from public.candidate_assignments a where a.organization_id=p_org and a.candidate_id=c.id
     and a.team_id=c.owning_team_id and a.user_id=p_assignee and a.ended_at is null and a.active_from<=now()))
   and (not p_unassigned or not exists(select 1 from public.candidate_assignments a where a.organization_id=p_org and a.candidate_id=c.id
     and a.team_id=c.owning_team_id and a.ended_at is null and a.active_from<=now()))
 ), page as (
  select * from filtered order by
   case when p_sort='name_asc' then lower(full_name) end asc nulls last,
   case when p_sort='name_desc' then lower(full_name) end desc nulls last,
   case when p_sort='updated_desc' then updated_at end desc,
   case when p_sort='created_desc' then created_at end desc,id
  limit p_page_size offset (p_page-1)*p_page_size
 )
 select jsonb_build_object('total',(select count(*) from filtered),'page',p_page,'pageSize',p_page_size,
 'items',coalesce((select jsonb_agg(jsonb_build_object('id',id,'fullName',full_name,'email',email,'location',location,
 'status',status,'owningTeamId',owning_team_id,'ownerId',owner_id,'rowVersion',row_version,'updatedAt',updated_at)) from page),'[]'::jsonb)) into v_result;
 return v_result;
end $$;
revoke all on function public.list_candidates(uuid,text,text,uuid,uuid,uuid,boolean,text,integer,integer) from public,anon;
grant execute on function public.list_candidates(uuid,text,text,uuid,uuid,uuid,boolean,text,integer,integer) to authenticated;
commit;

