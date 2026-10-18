-- Synthetic fixtures are transaction-local and rolled back. Never seed hosted projects.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select ok(not has_schema_privilege('app_permission_reader','auth','USAGE'),'scope reader cannot access managed Auth schema');
insert into auth.users(id,email,email_confirmed_at) values ('00000000-0000-4000-8000-000000000001','synthetic-1@example.invalid',now()),('00000000-0000-4000-8000-000000000002','synthetic-2@example.invalid',now()),('00000000-0000-4000-8000-000000000003','synthetic-3@example.invalid',now()),('00000000-0000-4000-8000-000000000004','synthetic-4@example.invalid',now()),('00000000-0000-4000-8000-000000000005','synthetic-5@example.invalid',now()),('00000000-0000-4000-8000-000000000006','synthetic-6@example.invalid',now()),('00000000-0000-4000-8000-000000000008','synthetic-8@example.invalid',now()),('00000000-0000-4000-8000-000000000009','synthetic-9@example.invalid',now()),('00000000-0000-4000-8000-000000000011','synthetic-11@example.invalid',now()),('00000000-0000-4000-8000-000000000012','synthetic-12@example.invalid',now()),('00000000-0000-4000-8000-000000000013','synthetic-13@example.invalid',now()),('00000000-0000-4000-8000-000000000014','synthetic-14@example.invalid',now());
insert into public.users(id,display_name) values ('00000000-0000-4000-8000-000000000001','Synthetic user 1'),('00000000-0000-4000-8000-000000000002','Synthetic user 2'),('00000000-0000-4000-8000-000000000003','Synthetic user 3'),('00000000-0000-4000-8000-000000000004','Synthetic user 4'),('00000000-0000-4000-8000-000000000005','Synthetic user 5'),('00000000-0000-4000-8000-000000000006','Synthetic user 6'),('00000000-0000-4000-8000-000000000008','Synthetic user 8'),('00000000-0000-4000-8000-000000000009','Synthetic user 9'),('00000000-0000-4000-8000-000000000011','Synthetic user 11'),('00000000-0000-4000-8000-000000000012','Synthetic user 12'),('00000000-0000-4000-8000-000000000013','Synthetic user 13'),('00000000-0000-4000-8000-000000000014','Synthetic user 14');
insert into public.organizations(id,name) values('00000000-0000-4000-8000-000000000100','Synthetic North'),('00000000-0000-4000-8000-000000000101','Synthetic South');
insert into public.organization_memberships(organization_id,user_id,role,state) values ('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000001','admin','active'),('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000002','team_leader','active'),('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000003','team_member','active'),('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000004','bidder','active'),('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000005','team_leader','active'),('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000006','team_member','active'),('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000008','team_member','deactivated'),('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000009','team_member','invited'),('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000011','admin','active'),('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000012','team_leader','active'),('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000013','team_member','active'),('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000014','bidder','active');
insert into public.teams(id,organization_id,name,created_by) values('00000000-0000-4000-8000-000000000200','00000000-0000-4000-8000-000000000100','Synthetic Alpha','00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000100','Synthetic Beta','00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000202','00000000-0000-4000-8000-000000000101','Synthetic Gamma','00000000-0000-4000-8000-000000000011');
insert into public.team_memberships(organization_id,team_id,user_id,role,created_by) values ('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000200','00000000-0000-4000-8000-000000000002','team_leader','00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000200','00000000-0000-4000-8000-000000000003','team_member','00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000200','00000000-0000-4000-8000-000000000004','bidder','00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000005','team_leader','00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000006','team_member','00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000200','00000000-0000-4000-8000-000000000008','team_member','00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000200','00000000-0000-4000-8000-000000000009','team_member','00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000202','00000000-0000-4000-8000-000000000012','team_leader','00000000-0000-4000-8000-000000000011'),('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000202','00000000-0000-4000-8000-000000000013','team_member','00000000-0000-4000-8000-000000000011'),('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000202','00000000-0000-4000-8000-000000000014','bidder','00000000-0000-4000-8000-000000000011');
insert into public.candidates(id,organization_id,owning_team_id,owner_id,full_name,email,phone,private_notes,created_by) values
('00000000-0000-4000-8000-000000000300','00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000200','00000000-0000-4000-8000-000000000003','Synthetic Avery','avery@example.invalid','+1-202-555-0100','PRIVATE CANDIDATE NOTES','00000000-0000-4000-8000-000000000001'),
('00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000200','00000000-0000-4000-8000-000000000003','Synthetic Blair',null,null,'UNRELATED PROFILE','00000000-0000-4000-8000-000000000001'),
('00000000-0000-4000-8000-000000000302','00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000006','Synthetic Casey',null,null,null,'00000000-0000-4000-8000-000000000001'),
('00000000-0000-4000-8000-000000000303','00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000202','00000000-0000-4000-8000-000000000013','Synthetic Devin',null,null,null,'00000000-0000-4000-8000-000000000011');
insert into public.candidate_assignments(organization_id,candidate_id,team_id,user_id,created_by) values
('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000300','00000000-0000-4000-8000-000000000200','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000302','00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000001'),
('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000303','00000000-0000-4000-8000-000000000202','00000000-0000-4000-8000-000000000013','00000000-0000-4000-8000-000000000011');
insert into public.candidate_bid_profiles(organization_id,candidate_id,approved_summary,approved_by) values('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000300','Approved synthetic professional summary','00000000-0000-4000-8000-000000000002');
insert into public.bids(id,organization_id,candidate_id,team_id,owner_id,company_name,job_title,created_by) values
('00000000-0000-4000-8000-000000000400','00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000300','00000000-0000-4000-8000-000000000200','00000000-0000-4000-8000-000000000004','Synthetic Co','Engineer','00000000-0000-4000-8000-000000000001'),
('00000000-0000-4000-8000-000000000401','00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000300','00000000-0000-4000-8000-000000000200','00000000-0000-4000-8000-000000000001','Other Synthetic Co','Engineer','00000000-0000-4000-8000-000000000001'),
('00000000-0000-4000-8000-000000000402','00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000303','00000000-0000-4000-8000-000000000202','00000000-0000-4000-8000-000000000014','Synthetic South Co','Engineer','00000000-0000-4000-8000-000000000011');
insert into public.bid_access_grants(id,organization_id,bid_id,user_id,capability,allow_email,created_by) values
('00000000-0000-4000-8000-000000000600','00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000400','00000000-0000-4000-8000-000000000004','bid.prepare',true,'00000000-0000-4000-8000-000000000001');
insert into public.interviews(id,organization_id,bid_id,round_number,created_by) values('00000000-0000-4000-8000-000000000500','00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000400',1,'00000000-0000-4000-8000-000000000001');
insert into public.interview_feedback(organization_id,interview_id,feedback,created_by) values('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000500','PRIVATE INTERVIEW FEEDBACK','00000000-0000-4000-8000-000000000001');
select ok((select not rolcanlogin and not rolbypassrls from pg_roles where rolname='app_command'),'command role cannot login or bypass RLS');
select ok((select not rolcanlogin and not rolbypassrls from pg_roles where rolname='app_bidder_reader'),'projection role cannot login or bypass RLS');
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_roles r on r.oid=c.relowner where n.nspname='public' and c.relkind='r' and r.rolname in ('app_command','app_permission_reader','app_bidder_reader')),0,'runtime roles never own tables');
select ok((select bool_and(c.relrowsecurity and c.relforcerowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'),'all business tables force RLS');
select ok(not has_table_privilege('authenticated','public.organization_memberships','UPDATE'),'no direct role updates');
select ok(not has_table_privilege('authenticated','public.candidates','INSERT'),'no direct candidate inserts');
select ok(not has_table_privilege('authenticated','public.audit_logs','INSERT'),'no fabricated audit inserts');
select ok(not has_table_privilege('app_command','public.audit_logs','UPDATE'),'commands cannot rewrite audit');
select ok(not has_table_privilege('app_bidder_reader','public.interview_feedback','SELECT'),'projection role cannot select feedback');
select ok(not has_column_privilege('app_bidder_reader','public.candidates','private_notes','SELECT'),'projection role cannot select private notes');
select ok(not has_function_privilege('anon','public.create_team(uuid,text,uuid)','EXECUTE'),'anonymous command execution denied');
select ok(not has_function_privilege('authenticated','public.bootstrap_organization(uuid,uuid,text,uuid)','EXECUTE'),'bootstrap not available to application users');
select ok(not pg_has_role('authenticated','app_command','MEMBER'),'authenticated cannot assume command role');
select ok(not has_column_privilege('app_permission_reader','public.candidates','private_notes','SELECT'),'permission helper cannot read profile notes');
select ok(not has_function_privilege('app_bidder_reader','private.auth_identity(text)','EXECUTE'),'projection reader cannot look up Auth identities');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner
 where n.nspname='public' and r.rolname='app_command' and p.prosecdef
  and p.proconfig @> array['search_path=""'] and not has_function_privilege('anon',p.oid,'EXECUTE')),13,'every protected command has restricted ownership, empty search path and no anonymous execution');
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"admin"}}',true);
set local role authenticated;

select is((select count(*)::int from public.candidates),3,'admin sees only own organization candidates');
select is((select count(*)::int from public.users),8,'admin roster excludes unrelated organization identities');
select is((select count(*)::int from public.teams),2,'admin sees both organization teams');
select is((select count(*)::int from public.interview_feedback),1,'admin can read own organization feedback');
select throws_ok($$update public.organization_memberships set role='admin' where user_id='00000000-0000-4000-8000-000000000003'$$,'42501',null,'direct role mutation denied even to admin');
select throws_ok($$select public.set_organization_membership('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000001','admin','deactivated',1,'00000000-0000-4000-8000-000000000700')$$,'22023','LAST_ACTIVE_ADMIN','cannot deactivate last admin');
select throws_ok($$select public.set_organization_membership('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000003','team_member','deactivated',99,'00000000-0000-4000-8000-000000000700')$$,'40001','VERSION_CONFLICT','stale membership version rejected');
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"role":"admin"}}',true);
set local role authenticated;

select is((select count(*)::int from public.candidates),2,'leader sees own team only');
select is((select count(*)::int from public.interview_feedback),1,'own team leader sees feedback');
select lives_ok($$select public.change_candidate_assignment('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000003',true,'00000000-0000-4000-8000-000000000700')$$,'leader can assign within team');
select lives_ok($$select public.change_candidate_assignment('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000003',false,'00000000-0000-4000-8000-000000000700')$$,'leader can end assignment without deleting history');
select is((select count(*)::int from public.candidate_assignments where candidate_id='00000000-0000-4000-8000-000000000301' and ended_at is not null),1,'ended assignment preserved');
select throws_ok($$select public.change_candidate_assignment('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000302','00000000-0000-4000-8000-000000000006',true,'00000000-0000-4000-8000-000000000700')$$,'42501','FORBIDDEN','leader cannot assign unrelated team');
select throws_ok($$select public.change_candidate_assignment('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000300','00000000-0000-4000-8000-000000000006',true,'00000000-0000-4000-8000-000000000700')$$,'22023','INVALID_ASSIGNEE','cross-team assignee rejected');
select throws_ok($$select public.set_organization_membership('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000003','admin','active',1,'00000000-0000-4000-8000-000000000700')$$,'42501','FORBIDDEN','leader cannot escalate members');
select lives_ok($$select public.create_candidate('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000200','00000000-0000-4000-8000-000000000003','Synthetic New Candidate','00000000-0000-4000-8000-000000000700')$$,'leader creates own-team candidate with eligible owner');
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated","app_metadata":{"role":"admin"}}',true);
set local role authenticated;

select is((select count(*)::int from public.candidates),1,'member sees only assigned candidate, not other owned records');
select is((select count(*)::int from public.users),1,'member cannot enumerate organization identities');
select is((select count(*)::int from public.interview_feedback),1,'assigned member sees scoped feedback');
select throws_ok($$select public.change_candidate_assignment('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000003',true,'00000000-0000-4000-8000-000000000700')$$,'42501','FORBIDDEN','member cannot self-assign');
select throws_ok($$select public.create_team('00000000-0000-4000-8000-000000000100','Escalation','00000000-0000-4000-8000-000000000700')$$,'42501','FORBIDDEN','forged JWT admin metadata is ignored');
select lives_ok($$select public.create_draft_bid('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000300','Synthetic Additional Co','Engineer','00000000-0000-4000-8000-000000000700')$$,'assigned member can prepare draft');
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated","app_metadata":{"role":"admin"}}',true);
set local role authenticated;

select is((select count(*)::int from public.candidates),0,'bidder cannot read raw profiles, including owned/linked candidates');
select is((select count(*)::int from public.candidate_bid_profiles),0,'bidder cannot read raw summary relation');
select is((select count(*)::int from public.candidate_assignments),0,'bidder cannot inspect profile assignments');
select is((select count(*)::int from public.interviews),0,'bidder cannot read interviews');
select is((select count(*)::int from public.interview_feedback),0,'bidder cannot read feedback');
select is((select count(*)::int from public.bids),1,'bidder sees exact granted bid only');
select is(public.get_bidder_candidate('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000300','00000000-0000-4000-8000-000000000400')->>'email','avery@example.invalid','explicit email grant honored');
select ok(public.get_bidder_candidate('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000300','00000000-0000-4000-8000-000000000400')->>'phone' is null,'phone denied by default');
select is(public.get_bidder_candidate('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000300','00000000-0000-4000-8000-000000000400')->>'approvedSummary','Approved synthetic professional summary','only approved summary returned');
select ok(not (public.get_bidder_candidate('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000300','00000000-0000-4000-8000-000000000400') ? 'privateNotes'),'projection excludes notes');
select ok(not (public.get_bidder_candidate('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000300','00000000-0000-4000-8000-000000000400') ? 'interviewFeedback'),'projection excludes feedback');
select is(jsonb_array_length(public.get_bidder_candidate('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000300','00000000-0000-4000-8000-000000000400')->'documentReferences'),0,'no fabricated document references');
select throws_ok($$select public.get_bidder_candidate('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000300',null)$$,'42501','FORBIDDEN','bid grant does not expand to whole candidate');
select throws_ok($$select public.get_bidder_candidate('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000300','00000000-0000-4000-8000-000000000401')$$,'42501','FORBIDDEN','unrelated bid denied');
select throws_ok($$select public.get_bidder_candidate('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000303','00000000-0000-4000-8000-000000000402')$$,'42501','FORBIDDEN','cross organization projection denied');
select throws_ok($$select public.approve_bidder_summary('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000300','Escalation',1,'00000000-0000-4000-8000-000000000700')$$,'42501','FORBIDDEN','bidder cannot approve profile summary');
select throws_ok($$select public.create_draft_bid('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000300','Unrelated','Engineer','00000000-0000-4000-8000-000000000700')$$,'42501','FORBIDDEN','bid-only grant cannot create unrelated draft');
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000005","role":"authenticated","app_metadata":{"role":"admin"}}',true);
set local role authenticated;

select is((select count(*)::int from public.candidates),1,'second leader sees only second team');
select is((select count(*)::int from public.interview_feedback),0,'second team cannot see first team feedback');
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000008","role":"authenticated","app_metadata":{"role":"admin"}}',true);
set local role authenticated;

select is((select count(*)::int from public.candidates),0,'deactivated membership denies stale session');
select is(jsonb_array_length(public.get_my_context()->'organizations'),0,'deactivated context has no organization');
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000009","role":"authenticated","app_metadata":{"role":"admin"}}',true);
set local role authenticated;

select is((select count(*)::int from public.candidates),0,'invited identity has no operational access');
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000011","role":"authenticated","app_metadata":{"role":"admin"}}',true);
set local role authenticated;

select is((select count(*)::int from public.candidates),1,'second organization admin is isolated');
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"admin"}}',true);
set local role authenticated;

select lives_ok($$select public.revoke_bidder_access('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000600','00000000-0000-4000-8000-000000000700')$$,'grant revocation succeeds');
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated","app_metadata":{"role":"admin"}}',true);
set local role authenticated;

select throws_ok($$select public.get_bidder_candidate('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000300','00000000-0000-4000-8000-000000000400')$$,'42501','FORBIDDEN','revocation effective with existing token');
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"admin"}}',true);
set local role authenticated;

select lives_ok($$select public.grant_bidder_access('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000300',null,'bid.prepare',false,false,now()+interval '1 day','00000000-0000-4000-8000-000000000700')$$,'candidate scope grant allowed for same-team bidder');
select throws_ok($$select public.grant_bidder_access('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000302',null,'bid.prepare',false,false,null,'00000000-0000-4000-8000-000000000700')$$,'22023','INVALID_GRANT_SCOPE','candidate grant cannot expand team scope');
select lives_ok($$select public.begin_user_provisioning('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000800','synthetic-9@example.invalid','Synthetic Invited','team_member')$$,'provisioning starts durably');
select lives_ok($$select public.begin_user_provisioning('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000800','synthetic-9@example.invalid','Synthetic Invited','team_member')$$,'same frozen provisioning operation can retry');
select throws_ok($$select public.begin_user_provisioning('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000800','changed@example.invalid','Synthetic Invited','team_member')$$,'22023','KEY_PAYLOAD_MISMATCH','changed payload rejected');
select is(public.complete_user_provisioning('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000800')->>'state','awaiting_activation','Auth identity attach remains inactive');
select lives_ok($$select public.set_organization_membership('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000009','team_member','active',1,'00000000-0000-4000-8000-000000000700')$$,'confirmed invited identity explicitly activated');
select is((select state from public.administrative_operations where operation_id='00000000-0000-4000-8000-000000000800'),'completed','activation reconciles operation');
select lives_ok($$select public.set_organization_membership('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000003','team_member','deactivated',1,'00000000-0000-4000-8000-000000000700')$$,'deactivation commits database revocation');
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated","app_metadata":{"role":"admin"}}',true);
set local role authenticated;

select is((select count(*)::int from public.candidates),0,'deactivated member loses access immediately');
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"admin"}}',true);
set local role authenticated;

select lives_ok($$select public.set_organization_membership('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000003','team_member','active',2,'00000000-0000-4000-8000-000000000700')$$,'reactivation allowed');
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated","app_metadata":{"role":"admin"}}',true);
set local role authenticated;

select is((select count(*)::int from public.candidates),0,'reactivation does not restore old assignments/team membership');
reset role;
select throws_ok($$insert into public.candidate_assignments(organization_id,candidate_id,team_id,user_id,created_by) values('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000303','00000000-0000-4000-8000-000000000200','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001')$$,'23503',null,'composite foreign key rejects cross-tenant child');
select throws_ok($$delete from public.candidate_assignments where candidate_id='00000000-0000-4000-8000-000000000301'$$,'42501','immutable assignment history','history cannot be deleted even accidentally by owner');
select ok(not has_schema_privilege('app_command','public','CREATE'),'command role cannot create replacement functions');
select ok(not has_schema_privilege('app_permission_reader','private','CREATE'),'scope reader cannot create helpers');
insert into public.bid_access_grants(organization_id,candidate_id,user_id,capability,created_at,expires_at,created_by)
 values('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000004','bid.prepare',now()-interval '2 days',now()-interval '1 day','00000000-0000-4000-8000-000000000001');
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.get_bidder_candidate('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000301',null)$$,'42501','FORBIDDEN','expired grant denied');
select lives_ok($$select public.get_bidder_candidate('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000300',null)$$,'candidate grant permits safe preparation projection');
select lives_ok($$select public.create_draft_bid('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000300','Synthetic Granted Co','Engineer','00000000-0000-4000-8000-000000000700')$$,'candidate grant allows bidder draft creation only within current team');
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.set_team_membership('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000200','00000000-0000-4000-8000-000000000004','bidder',false,1,'00000000-0000-4000-8000-000000000700')$$,'admin deactivates team membership');
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.get_bidder_candidate('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000300',null)$$,'42501','FORBIDDEN','inactive team revokes bidder projection');
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.set_team_membership('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000200','00000000-0000-4000-8000-000000000004','bidder',true,2,'00000000-0000-4000-8000-000000000700')$$,'team membership may be restored explicitly');
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.get_bidder_candidate('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000300',null)$$,'42501','FORBIDDEN','restoring team does not resurrect revoked grants');
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select lives_ok($$select public.bootstrap_organization('00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000001','Synthetic Bootstrap','00000000-0000-4000-8000-000000000701')$$,'operator bootstrap creates organization and confirmed admin atomically');
select throws_ok($$select public.bootstrap_organization('00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000001','Retry','00000000-0000-4000-8000-000000000702')$$,'23505','BOOTSTRAP_ALREADY_EXISTS','bootstrap refuses existing organization');
reset role;
select is((select count(*)::int from public.audit_logs where organization_id='00000000-0000-4000-8000-000000000102' and action='organization.bootstrapped'),1,'bootstrap audit recorded exactly once');
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.begin_user_provisioning('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000801','synthetic-11@example.invalid','Synthetic Second Admin','admin')$$,'second admin provisioning begins');
select lives_ok($$select public.complete_user_provisioning('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000801')$$,'second admin identity attaches inactive');
select lives_ok($$select public.set_organization_membership('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000011','admin','active',1,'00000000-0000-4000-8000-000000000703')$$,'confirmed second admin activates explicitly');
reset role;
update public.users set status='deactivated' where id='00000000-0000-4000-8000-000000000011';
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.set_organization_membership('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000001','admin','deactivated',1,'00000000-0000-4000-8000-000000000704')$$,'22023','LAST_ACTIVE_ADMIN','inactive identity cannot count as the remaining admin');
reset role;
update public.users set status='active' where id='00000000-0000-4000-8000-000000000011';
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.set_organization_membership('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000001','admin','deactivated',1,'00000000-0000-4000-8000-000000000704')$$,'admin can deactivate self when another effective admin remains');
select is((select count(*)::int from public.candidates),0,'self-deactivated admin immediately loses candidate access');
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000011","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*)::int from public.audit_logs where organization_id='00000000-0000-4000-8000-000000000100' and subject_id='00000000-0000-4000-8000-000000000001'
 and action='organization.membership_changed' and redacted_change_summary->>'state'='deactivated'),1,'self-deactivation and audit commit atomically');
select is((select state from public.organization_memberships where organization_id='00000000-0000-4000-8000-000000000100' and user_id='00000000-0000-4000-8000-000000000001'),'deactivated','other admin retains access to deactivated membership history');
reset role;
-- Simulate a later transfer as the migration owner, never as an exposed command.
-- An old-team assignment cannot turn into new-team authorization.
insert into public.team_memberships(organization_id,team_id,user_id,role,created_by)
 values('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000200','00000000-0000-4000-8000-000000000006','team_member','00000000-0000-4000-8000-000000000011');
insert into public.candidate_assignments(organization_id,candidate_id,team_id,user_id,created_by)
 values('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000300','00000000-0000-4000-8000-000000000200','00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000011');
select lives_ok($$update public.candidates set owning_team_id='00000000-0000-4000-8000-000000000201' where id='00000000-0000-4000-8000-000000000300'$$,'ownership change can preserve old assignment history');
select ok(exists(select 1 from public.candidate_assignments where candidate_id='00000000-0000-4000-8000-000000000300' and team_id='00000000-0000-4000-8000-000000000200'),'historical assignment retains original team');
select is((select team_id from public.bids where id='00000000-0000-4000-8000-000000000400'),'00000000-0000-4000-8000-000000000200'::uuid,'candidate ownership change never moves historical bid team');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000006","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*)::int from public.candidates where id='00000000-0000-4000-8000-000000000300'),0,'old-team assignment cannot authorize the new team even with both memberships');
reset role;
select * from finish();
rollback;
