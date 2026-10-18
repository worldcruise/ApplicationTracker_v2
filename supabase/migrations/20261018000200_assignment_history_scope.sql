begin;
-- Assignment history records the team at assignment time, not the candidate's
-- forever-current team. Keep tenant FKs without making later audited transfers
-- rewrite or delete old assignments. No transfer command is exposed here.
do $$
declare v_constraint name;
begin
 select conname into strict v_constraint from pg_constraint
 where conrelid='public.candidate_assignments'::regclass
  and confrelid='public.candidates'::regclass and contype='f';
 execute format('alter table public.candidate_assignments drop constraint %I',v_constraint);
end $$;
alter table public.candidate_assignments add constraint assignment_candidate_tenant
 foreign key (organization_id,candidate_id) references public.candidates(organization_id,id) on delete restrict;
-- The existing (organization, team, user) FK retains the historical team and
-- membership identity. Insert commands separately validate current ownership.
create or replace function private.reads_candidate(p_org uuid,p_candidate uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.candidates c where c.organization_id=p_org and c.id=p_candidate and (
  private.manages_team(p_org,c.owning_team_id) or
  (private.org_role(p_org)='team_member' and private.in_team(p_org,c.owning_team_id)
   and exists(select 1 from public.candidate_assignments a where a.organization_id=p_org
    and a.candidate_id=c.id and a.team_id=c.owning_team_id and a.user_id=private.actor_id()
    and a.ended_at is null and a.active_from<=now()))))
$$;
revoke all on function private.reads_candidate(uuid,uuid) from public,anon;
grant execute on function private.reads_candidate(uuid,uuid) to authenticated,app_command,app_bidder_reader;
commit;
