begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into auth.users(id,email,email_confirmed_at) select ('a8000000-0000-4000-9000-'||lpad(n::text,12,'0'))::uuid,'resume-'||n||'@example.invalid',now() from generate_series(1,4) n;
insert into public.users(id,display_name) select id,'Synthetic Resume User' from auth.users where email like 'resume-%@example.invalid';
insert into public.organizations(id,name) values('a8000000-0000-4000-9000-000000000100','Synthetic Resume Org');
insert into public.organization_memberships(organization_id,user_id,role,state) select 'a8000000-0000-4000-9000-000000000100',('a8000000-0000-4000-9000-'||lpad(n::text,12,'0'))::uuid,case n when 1 then 'admin' when 2 then 'team_leader' when 3 then 'team_member' else 'bidder' end,'active' from generate_series(1,4) n;
insert into public.teams(id,organization_id,name,created_by) values('a8000000-0000-4000-9000-000000000200','a8000000-0000-4000-9000-000000000100','Synthetic Resume Team','a8000000-0000-4000-9000-000000000001');
insert into public.team_memberships(organization_id,team_id,user_id,role,created_by) select organization_id,'a8000000-0000-4000-9000-000000000200',user_id,role,'a8000000-0000-4000-9000-000000000001' from public.organization_memberships where role<>'admin';
select set_config('request.jwt.claims','{"sub":"a8000000-0000-4000-9000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select set_config('test.resume_candidate',(public.create_candidate_profile('a8000000-0000-4000-9000-000000000100','a8000000-0000-4000-9000-000000000200',null,
 '{"fullName":"Synthetic Zoë","email":"zoe@example.invalid","phone":"+1 202 555 0100","location":"Synthetic City","seniorityPreference":null,"professionalSummary":"Built synthetic tools.","privateNotes":"PRIVATE DO NOT COPY","status":"ready","links":[],"experiences":[],"educations":[],"certifications":[]}',gen_random_uuid())->>'id'),true);

select public.set_candidate_assignment('a8000000-0000-4000-9000-000000000100',current_setting('test.resume_candidate')::uuid,'a8000000-0000-4000-9000-000000000003',true,1,gen_random_uuid());
reset role;
select set_config('request.jwt.claims','{"sub":"a8000000-0000-4000-9000-000000000003","role":"authenticated"}',true);
set local role authenticated;

select set_config('test.bid_input',jsonb_build_object('candidateId',current_setting('test.resume_candidate'),'teamId','a8000000-0000-4000-9000-000000000200','ownerId','a8000000-0000-4000-9000-000000000003','companyName','Synthetic Opportunity One','jobTitle','Engineer','jobDescription','Synthetic job','jobUrl',null,'externalId',null,'jobLocation',null,'priority','normal','followUpAt',null,'lastContactAt',null,'notes','','outcome','','resumeDocumentId',null,'coverLetterDocumentId',null)::text,true);
select set_config('test.bid_op',gen_random_uuid()::text,true);
select set_config('test.bid',public.save_bid('a8000000-0000-4000-9000-000000000100',null,0,current_setting('test.bid_input')::jsonb,current_setting('test.bid_op')::uuid,gen_random_uuid())->>'id',true);
select is((select status from public.bids where id=current_setting('test.bid')::uuid),'draft','new independent bid remains a draft');
select is(public.save_bid('a8000000-0000-4000-9000-000000000100',null,0,current_setting('test.bid_input')::jsonb,current_setting('test.bid_op')::uuid,gen_random_uuid())->>'id',current_setting('test.bid'),'same actor/key/payload replays creation');
select throws_ok($$select public.save_bid('a8000000-0000-4000-9000-000000000100',null,0,current_setting('test.bid_input')::jsonb||'{"jobTitle":"Changed"}',current_setting('test.bid_op')::uuid,gen_random_uuid())$$,'22023','KEY_PAYLOAD_MISMATCH','changed payload cannot reuse create key');
select isnt(public.save_bid('a8000000-0000-4000-9000-000000000100',null,0,current_setting('test.bid_input')::jsonb||'{"companyName":"Synthetic Opportunity Two"}',gen_random_uuid(),gen_random_uuid())->>'id',current_setting('test.bid'),'same candidate has independent opportunities');
select throws_ok($$select public.transition_bid('a8000000-0000-4000-9000-000000000100',current_setting('test.bid')::uuid,1,'{"status":"submitted","reason":"Invalid shortcut","submittedAt":null,"confirmation":"","attested":false,"adminOverrideReason":"","reopen":false}',gen_random_uuid(),gen_random_uuid())$$,'22023','INVALID_BID_TRANSITION','draft cannot skip to submitted');
select lives_ok($$select public.transition_bid('a8000000-0000-4000-9000-000000000100',current_setting('test.bid')::uuid,1,'{"status":"resume_preparation","reason":"Prepare documents","submittedAt":null,"confirmation":"","attested":false,"adminOverrideReason":"","reopen":false}',gen_random_uuid(),gen_random_uuid())$$,'owner enters preparation');
select throws_ok($$select public.save_bid('a8000000-0000-4000-9000-000000000100',current_setting('test.bid')::uuid,1,current_setting('test.bid_input')::jsonb,gen_random_uuid(),gen_random_uuid())$$,'40001','VERSION_CONFLICT','stale whole-bid edit rejected');
select throws_ok($$update public.bids set status='submitted' where id=current_setting('test.bid')::uuid$$,'42501',null,'direct status writes denied');
select is((select count(*)::integer from public.bid_status_history where bid_id=current_setting('test.bid')::uuid),2,'append-only initial and transition events retained');
select is((select count(*)::integer from public.bid_submissions where bid_id=current_setting('test.bid')::uuid),0,'preparing or saving never records submission');
reset role;
select throws_ok($$update public.bid_status_history set reason='rewritten'$$,'42501','IMMUTABLE_PROFILE_REVISION','even owner cannot rewrite status history');
select ok(not has_table_privilege('authenticated','public.bid_submissions','INSERT'),'only protected command can insert submission');
select ok(not has_table_privilege('authenticated','public.bid_approvals','UPDATE'),'approvals cannot be overwritten');
select * from finish();rollback;
