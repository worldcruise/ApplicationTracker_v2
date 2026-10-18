begin;
-- Finish all audit/reconciliation writes while the actor still has current
-- admin scope. The final membership update and earlier writes commit together.
create or replace function public.set_organization_membership(p_org uuid,p_user uuid,p_role text,p_state text,p_expected bigint,p_request uuid)
returns bigint language plpgsql security definer set search_path='' as $$
declare v_old public.organization_memberships; v_version bigint;
begin
 if private.org_role(p_org) is distinct from 'admin' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 perform 1 from public.organizations where id=p_org for update;
 select * into v_old from public.organization_memberships where organization_id=p_org and user_id=p_user for update;
 if not found then raise exception 'MEMBERSHIP_NOT_FOUND' using errcode='P0002'; end if;
 if v_old.row_version is distinct from p_expected then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
 if p_role is null or p_role not in ('admin','team_leader','team_member','bidder') or
    p_state is null or p_state not in ('active','deactivated') then raise exception 'INVALID_MEMBERSHIP' using errcode='22023'; end if;
 if p_state='active' and not private.identity_confirmed(p_user) then raise exception 'IDENTITY_NOT_CONFIRMED' using errcode='22023'; end if;
 if v_old.role='admin' and v_old.state='active' and (p_role<>'admin' or p_state<>'active') and
   (select count(*) from public.organization_memberships m join public.users u on u.id=m.user_id and u.status='active'
     where m.organization_id=p_org and m.role='admin' and m.state='active')<=1 then
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
 update public.administrative_operations set state='completed',updated_at=now()
  where organization_id=p_org and target_user_id=p_user and state='awaiting_activation' and p_state='active';
 perform private.audit(p_org,'organization.membership_changed',p_user,p_request,null,jsonb_build_object('state',p_state,'role',p_role));
 update public.organization_memberships set role=p_role,state=p_state,row_version=row_version+1,updated_at=now()
  where organization_id=p_org and user_id=p_user returning row_version into v_version;
 return v_version;
end $$;
-- CREATE OR REPLACE preserves ownership/ACL, and these statements make the
-- intended execution boundary explicit for future migration reviews.
alter function public.set_organization_membership(uuid,uuid,text,text,bigint,uuid) owner to app_command;
revoke all on function public.set_organization_membership(uuid,uuid,text,text,bigint,uuid) from public,anon;
grant execute on function public.set_organization_membership(uuid,uuid,text,text,bigint,uuid) to authenticated;
commit;
