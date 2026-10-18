-- Transaction-local synthetic profile fixture; no hosted seed or real data.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into auth.users(id,email,email_confirmed_at) select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'profile-'||n||'@example.invalid',now() from generate_series(1,5) n;
insert into public.users(id,display_name) select id,'Synthetic Profile User' from auth.users where email like 'profile-%@example.invalid';
insert into public.organizations(id,name) values('00000000-0000-4000-8000-000000000100','Synthetic Profiles');
insert into public.organization_memberships(organization_id,user_id,role,state)
 select '00000000-0000-4000-8000-000000000100',('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 case n when 1 then 'admin' when 2 then 'team_leader' when 3 then 'team_member' when 4 then 'bidder' else 'team_member' end,'active'
 from generate_series(1,5) n;
insert into public.teams(id,organization_id,name,created_by) values('00000000-0000-4000-8000-000000000200','00000000-0000-4000-8000-000000000100','Synthetic Team','00000000-0000-4000-8000-000000000001');
insert into public.team_memberships(organization_id,team_id,user_id,role,created_by)
 select organization_id,'00000000-0000-4000-8000-000000000200',user_id,role,'00000000-0000-4000-8000-000000000001' from public.organization_memberships where role<>'admin';
select set_config('test.profile','{"fullName":null,"email":null,"phone":null,"location":null,"seniorityPreference":null,"professionalSummary":null,"privateNotes":null,"status":"draft","links":[],"experiences":[],"educations":[],"certifications":[]}',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select set_config('test.candidate',(public.create_candidate_profile('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000200',null,current_setting('test.profile')::jsonb,gen_random_uuid())->>'id'),true);
select is((select count(*)::int from public.candidate_profile_revisions),1,'creation creates initial frozen revision');
select ok((public.get_candidate_profile('00000000-0000-4000-8000-000000000100',current_setting('test.candidate')::uuid)->>'fullName') is null,'empty draft retains unknown name as null');
select throws_ok($$select public.save_candidate_profile('00000000-0000-4000-8000-000000000100',current_setting('test.candidate')::uuid,1,current_setting('test.profile')::jsonb||'{"status":"ready","fullName":"Synthetic Avery","email":"avery@example.invalid","location":"Synthetic City"}',gen_random_uuid())$$,'23514',null,'Ready requires phone per explicit C01 decision');
select set_config('test.profile',(current_setting('test.profile')::jsonb||'{"fullName":"Synthetic Avery","email":"avery@example.invalid","phone":"+1-202-555-0100","location":"Synthetic City","status":"ready","experiences":[{"id":"00000000-0000-4000-8000-000000000600","company":"Synthetic Co","officialTitle":"Software Engineer II","proposedDisplayTitle":"Software Engineer","titlePolicy":"tailorable","startDate":"2020-02","endDate":"2022","current":false,"location":null,"sourceBullets":["Synthetic verified work"],"achievements":[],"preferredBulletCount":3}]}')::text,true);
select lives_ok($$select public.save_candidate_profile('00000000-0000-4000-8000-000000000100',current_setting('test.candidate')::uuid,1,current_setting('test.profile')::jsonb,gen_random_uuid())$$,'complete Ready profile persists');
select is((select start_date from public.work_experiences),'2020-02','date precision preserved without invented day');
select throws_ok($$select public.save_candidate_profile('00000000-0000-4000-8000-000000000100',current_setting('test.candidate')::uuid,1,current_setting('test.profile')::jsonb,gen_random_uuid())$$,'40001','VERSION_CONFLICT','stale save cannot overwrite current profile');
select is((select verified_snapshot->>'fullName' from public.candidate_profile_revisions where revision_number=1),null::text,'earlier snapshot remains unchanged');
select lives_ok($$select public.set_candidate_assignment('00000000-0000-4000-8000-000000000100',current_setting('test.candidate')::uuid,'00000000-0000-4000-8000-000000000003',true,2,gen_random_uuid())$$,'leader/admin assignment uses candidate version');
select lives_ok($$select public.approve_candidate_title('00000000-0000-4000-8000-000000000100',current_setting('test.candidate')::uuid,'00000000-0000-4000-8000-000000000600',3,gen_random_uuid())$$,'authorized title approval is separate command');
select is((select official_title from public.work_experiences),'Software Engineer II','approval never overwrites official title');
select is((select approved_display_title from public.work_experiences),'Software Engineer','approved presentation title retained separately');
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*)::int from public.work_experiences),1,'assigned member reads profile children');
select throws_ok($$select public.approve_candidate_title('00000000-0000-4000-8000-000000000100',current_setting('test.candidate')::uuid,'00000000-0000-4000-8000-000000000600',4,gen_random_uuid())$$,'42501','FORBIDDEN','member cannot approve display title');
select lives_ok($$select public.save_candidate_profile('00000000-0000-4000-8000-000000000100',current_setting('test.candidate')::uuid,4,jsonb_set(current_setting('test.profile')::jsonb,'{experiences,0,proposedDisplayTitle}','"Backend Engineer"'),gen_random_uuid())$$,'assigned member edits actual persisted profile');
select ok((select approved_display_title is null from public.work_experiences),'edited title invalidates prior approval');
select throws_ok($$update public.candidate_profile_revisions set verified_snapshot='{}'$$,'42501',null,'clients cannot rewrite profile history');
select throws_ok($$delete from public.work_experiences$$,'42501',null,'clients cannot delete child history');
select lives_ok($$select public.set_candidate_archived('00000000-0000-4000-8000-000000000100',current_setting('test.candidate')::uuid,5,true,gen_random_uuid())$$,'authorized member archives assigned candidate');
select throws_ok($$select public.save_candidate_profile('00000000-0000-4000-8000-000000000100',current_setting('test.candidate')::uuid,6,current_setting('test.profile')::jsonb,gen_random_uuid())$$,'22023','CANDIDATE_ARCHIVED','archive is read-only');
select is((public.list_candidates('00000000-0000-4000-8000-000000000100')->>'total')::int,0,'default directory excludes archived records');
select is((public.list_candidates('00000000-0000-4000-8000-000000000100',p_status=>'archived')->>'total')::int,1,'explicit archived filter exposes authorized history');
select lives_ok($$select public.set_candidate_archived('00000000-0000-4000-8000-000000000100',current_setting('test.candidate')::uuid,6,false,gen_random_uuid())$$,'explicit restore keeps prior Ready state');
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*)::int from public.work_experiences),0,'bidder cannot read raw experiences');
select is((select count(*)::int from public.candidate_profile_revisions),0,'bidder cannot read frozen profile history');
select throws_ok($$select public.save_candidate_profile('00000000-0000-4000-8000-000000000100',current_setting('test.candidate')::uuid,7,current_setting('test.profile')::jsonb,gen_random_uuid())$$,'42501','FORBIDDEN','bidder cannot edit even with known ID/version');
reset role;
select throws_ok($$update public.candidate_profile_revisions set verified_snapshot='{}'$$,'42501','IMMUTABLE_PROFILE_REVISION','history trigger prevents accidental owner rewrite');
select throws_ok($$select private.date_bounds('2023-02-29')$$,'22023','INVALID_PARTIAL_DATE','invalid calendar dates rejected');
select ok(not private.valid_period('2024-03','2023'),'impossible period rejected');
select * from finish();
rollback;

