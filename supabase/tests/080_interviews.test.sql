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

select set_config('test.bid',public.save_bid('a8000000-0000-4000-9000-000000000100',null,0,current_setting('test.bid_input')::jsonb,gen_random_uuid(),gen_random_uuid())->>'id',true);
reset role;
-- Trusted fixture isolates interview commands; production transition authorization is tested in 070 and HTTP.
update public.bids set status='interview_invited' where id=current_setting('test.bid')::uuid;
set local role authenticated;
select set_config('test.interview_input',jsonb_build_object('bidId',current_setting('test.bid'),'ownerId','a8000000-0000-4000-9000-000000000003','type','Technical','interviewer','Synthetic Reviewer','localDateTime','2026-11-01T01:30','timezone','America/New_York','offset','-04:00','scheduledAt','2026-11-01T05:30:00Z','durationMinutes',60,'location','Synthetic office','meetingUrl',null,'lifecycle','scheduled','outcome','pending','nextAction','Record feedback','followUpAt',now()-interval '1 day')::text,true);
select set_config('test.interview',public.save_interview('a8000000-0000-4000-9000-000000000100',null,0,current_setting('test.interview_input')::jsonb,null,gen_random_uuid(),gen_random_uuid())->>'id',true);
select is((select round_number from public.interviews where id=current_setting('test.interview')::uuid),1,'round one belongs to this bid');
select throws_ok($$select public.save_interview('a8000000-0000-4000-9000-000000000100',current_setting('test.interview')::uuid,1,current_setting('test.interview_input')::jsonb||'{"scheduledAt":"2026-11-01T06:30:00Z"}',null,gen_random_uuid(),gen_random_uuid())$$,'22023','INVALID_SCHEDULE','database rejects mismatched DST occurrence');
select lives_ok($$select public.save_interview('a8000000-0000-4000-9000-000000000100',current_setting('test.interview')::uuid,1,current_setting('test.interview_input')::jsonb||'{"scheduledAt":"2026-11-01T06:30:00Z","offset":"-05:00"}',null,gen_random_uuid(),gen_random_uuid())$$,'explicit later DST occurrence reschedules');
select is((select count(*)::integer from public.interview_revisions where interview_id=current_setting('test.interview')::uuid),2,'reschedule preserves original schedule');
select throws_ok($$select public.save_interview('a8000000-0000-4000-9000-000000000100',current_setting('test.interview')::uuid,1,current_setting('test.interview_input')::jsonb,null,gen_random_uuid(),gen_random_uuid())$$,'40001','VERSION_CONFLICT','stale interview edit fails');
select public.save_interview('a8000000-0000-4000-9000-000000000100',current_setting('test.interview')::uuid,2,current_setting('test.interview_input')::jsonb||'{"lifecycle":"feedback_pending","outcome":"next_round"}',null,gen_random_uuid(),gen_random_uuid());
select is((select status from public.bids where id=current_setting('test.bid')::uuid),'interview_invited','round outcome never changes overall bid');
select public.record_interview_feedback('a8000000-0000-4000-9000-000000000100',current_setting('test.interview')::uuid,3,'Synthetic feedback revision one',gen_random_uuid(),gen_random_uuid());
select public.record_interview_feedback('a8000000-0000-4000-9000-000000000100',current_setting('test.interview')::uuid,4,'Synthetic feedback revision two',gen_random_uuid(),gen_random_uuid());
select is((select count(*)::integer from public.interview_feedback where interview_id=current_setting('test.interview')::uuid),2,'feedback revisions append');
select set_config('test.round2',public.save_interview('a8000000-0000-4000-9000-000000000100',null,0,current_setting('test.interview_input')::jsonb,current_setting('test.interview')::uuid,gen_random_uuid(),gen_random_uuid())->>'id',true);
select is((select round_number from public.interviews where id=current_setting('test.round2')::uuid),2,'next round creates new record');
select set_config('test.task',(select id::text from public.workflow_tasks where interview_id=current_setting('test.round2')::uuid and state='open'),true);
select lives_ok($$select public.complete_workflow_task('a8000000-0000-4000-9000-000000000100',current_setting('test.task')::uuid,1,gen_random_uuid(),gen_random_uuid())$$,'assignee completes typed follow-up');
select is((select state from public.workflow_tasks where id=current_setting('test.task')::uuid),'completed','task completion persists');
select set_config('request.jwt.claims','{"sub":"a8000000-0000-4000-9000-000000000004","role":"authenticated"}',true);
select is((select count(*)::integer from public.interviews),0,'bidder cannot read interviews');
select is((select count(*)::integer from public.interview_feedback),0,'bidder cannot read feedback');
select throws_ok($$select public.record_interview_feedback('a8000000-0000-4000-9000-000000000100',current_setting('test.interview')::uuid,5,'Denied',gen_random_uuid(),gen_random_uuid())$$,'42501','FORBIDDEN','bidder cannot bypass feedback API');
reset role;
select throws_ok($$update public.interview_feedback set feedback='rewrite'$$,'42501','IMMUTABLE_PROFILE_REVISION','feedback cannot be overwritten');
select throws_ok($$delete from public.interview_revisions$$,'42501','IMMUTABLE_PROFILE_REVISION','schedule history cannot be removed');
select * from finish();rollback;
