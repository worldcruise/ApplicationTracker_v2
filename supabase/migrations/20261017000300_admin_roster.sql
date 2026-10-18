begin;
-- Ordinary roster queries still execute as the user. This boolean helper only
-- permits display-name rows for users sharing an organization the actor admins.
grant create on schema private to app_permission_reader;
create function private.can_read_user(p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.organization_memberships m where m.user_id=p_user
  and private.org_role(m.organization_id)='admin')
$$;
alter function private.can_read_user(uuid) owner to app_permission_reader;
revoke all on function private.can_read_user(uuid) from public;
grant execute on function private.can_read_user(uuid) to authenticated;
revoke create on schema private from app_permission_reader;
alter policy visible on public.users using (id=private.actor_id() or private.can_read_user(id));
commit;
