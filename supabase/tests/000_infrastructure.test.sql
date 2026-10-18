-- Infrastructure smoke gate only; this does not test application permissions.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(2);
select has_schema('auth', 'Local Supabase provides the authentication schema');
select has_role('authenticated', 'Local Supabase provides the authenticated role');
select * from finish();

rollback;
