begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into auth.users(id,email,email_confirmed_at) values
 ('14000000-0000-4000-8000-000000000001','synthetic-admin@example.invalid',now()),
 ('14000000-0000-4000-8000-000000000002','synthetic-other-admin@example.invalid',now());
insert into public.users(id,display_name) values('14000000-0000-4000-8000-000000000001','Synthetic Admin'),('14000000-0000-4000-8000-000000000002','Synthetic Other Admin');
insert into public.organizations(id,name) values('14000000-0000-4000-8000-000000000100','Synthetic Intake'),('14000000-0000-4000-8000-000000000101','Synthetic Other');
insert into public.organization_memberships(organization_id,user_id,role,state) values
 ('14000000-0000-4000-8000-000000000100','14000000-0000-4000-8000-000000000001','admin','active'),
 ('14000000-0000-4000-8000-000000000101','14000000-0000-4000-8000-000000000002','admin','active');
insert into public.teams(id,organization_id,name,created_by) values('14000000-0000-4000-8000-000000000200','14000000-0000-4000-8000-000000000100','Synthetic Intake Team','14000000-0000-4000-8000-000000000001');
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select lives_ok($$select public.configure_registration('14000000-0000-4000-8000-000000000100',true)$$,'trusted operator selects existing organization');
insert into auth.users(id,email,raw_user_meta_data) values
 ('14000000-0000-4000-8000-000000000003','synthetic-applicant@example.invalid','{"full_name":"Synthetic Applicant","role":"admin","organization_id":"14000000-0000-4000-8000-000000000101"}'),
 ('14000000-0000-4000-8000-000000000004','synthetic-rejected@example.invalid','{"full_name":"Synthetic Rejected"}');
select is((select count(*)::int from public.account_requests),2,'one pending request per Auth identity before verification');
select is((select organization_id::text from public.account_requests where user_id='14000000-0000-4000-8000-000000000003'),'14000000-0000-4000-8000-000000000100','caller metadata cannot choose organization');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"14000000-0000-4000-8000-000000000003"}',true);
set local role authenticated;
select is(public.get_my_account_status()->>'status','pending','applicant reads own status');
select is(public.get_my_account_status()->>'emailVerified','false','email verification independent of approval');
select is((select count(*)::int from public.account_requests),0,'applicant cannot enumerate raw requests or reviewer fields');
select is(jsonb_array_length(public.get_my_context()->'organizations'),0,'no automatic membership or Admin');
select is((select count(*)::int from public.candidates),0,'pending user sees no candidates');
select is((select count(*)::int from public.resume_versions),0,'pending user sees no document versions');
select throws_ok($$update public.account_requests set status='approved'$$,'42501',null,'direct self approval denied');
select throws_ok($$select public.list_account_requests('14000000-0000-4000-8000-000000000100')$$,'42501','FORBIDDEN','pending review list denied');
select throws_ok($$select public.review_account_request('14000000-0000-4000-8000-000000000100','14000000-0000-4000-8000-000000000004','approved','admin',null,null,1,gen_random_uuid())$$,'42501','FORBIDDEN','pending approval attempt denied');
select throws_ok($$select public.configure_registration('14000000-0000-4000-8000-000000000101',true)$$,'42501',null,'applicant cannot reconfigure target');
reset role;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"14000000-0000-4000-8000-000000000001"}',true);
set local role authenticated;
select is(jsonb_array_length(public.list_account_requests('14000000-0000-4000-8000-000000000100')),2,'Admin sees scoped applicants');
select throws_ok($$select public.review_account_request('14000000-0000-4000-8000-000000000100','14000000-0000-4000-8000-000000000003','approved','team_member','14000000-0000-4000-8000-000000000200',null,1,gen_random_uuid())$$,'22023','IDENTITY_NOT_CONFIRMED','approval requires independently verified email');
reset role;
update auth.users set email_confirmed_at=now() where id='14000000-0000-4000-8000-000000000003';
set local role authenticated;
select throws_ok($$select public.review_account_request('14000000-0000-4000-8000-000000000100','14000000-0000-4000-8000-000000000003','approved','team_member',null,null,1,gen_random_uuid())$$,'22023','INVALID_REVIEW','non-Admin role requires a team');
select throws_ok($$select public.review_account_request('14000000-0000-4000-8000-000000000100','14000000-0000-4000-8000-000000000003','approved','team_member','14000000-0000-4000-8000-000000000200',null,9,gen_random_uuid())$$,'40001','VERSION_CONFLICT','stale review denied');
select is(public.review_account_request('14000000-0000-4000-8000-000000000100','14000000-0000-4000-8000-000000000003','approved','team_member','14000000-0000-4000-8000-000000000200',null,1,gen_random_uuid()),2::bigint,'approval commits membership and decision');
select is(public.review_account_request('14000000-0000-4000-8000-000000000100','14000000-0000-4000-8000-000000000003','approved','team_member','14000000-0000-4000-8000-000000000200',null,1,gen_random_uuid()),2::bigint,'identical retry safe');
select throws_ok($$select public.review_account_request('14000000-0000-4000-8000-000000000100','14000000-0000-4000-8000-000000000003','rejected',null,null,null,1,gen_random_uuid())$$,'40001','VERSION_CONFLICT','conflicting second reviewer decision cannot overwrite');
select is(public.review_account_request('14000000-0000-4000-8000-000000000100','14000000-0000-4000-8000-000000000004','rejected',null,null,'Synthetic rejection reason',1,gen_random_uuid()),2::bigint,'rejection records terminal decision');
reset role;
select is((select count(*)::int from public.organization_memberships where user_id='14000000-0000-4000-8000-000000000003' and state='active'),1,'approved active organization membership exists');
select is((select count(*)::int from public.team_memberships where user_id='14000000-0000-4000-8000-000000000003' and active),1,'required team membership exists');
select is((select count(*)::int from public.organization_memberships where user_id='14000000-0000-4000-8000-000000000004'),0,'rejection grants no membership');
select is((select count(*)::int from public.audit_logs where action in ('account.approved','account.rejected')),2,'retries append no duplicate review audit');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"14000000-0000-4000-8000-000000000003"}',true);
set local role authenticated;
select is(jsonb_array_length(public.get_my_context()->'organizations'),1,'approved user resolves current membership');
reset role;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"14000000-0000-4000-8000-000000000004"}',true);
set local role authenticated;
select is(public.get_my_account_status()->>'status','rejected','rejected user receives clear own status');
select is(jsonb_array_length(public.get_my_context()->'organizations'),0,'rejected user stays blocked');
reset role;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"14000000-0000-4000-8000-000000000002"}',true);
set local role authenticated;
select throws_ok($$select public.list_account_requests('14000000-0000-4000-8000-000000000100')$$,'42501','FORBIDDEN','other organization Admin cannot review');
select is(jsonb_array_length(public.get_my_context()->'organizations'),1,'existing approved/invited users unchanged');
reset role;
select * from finish();
rollback;
