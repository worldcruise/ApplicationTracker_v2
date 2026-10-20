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


select is(public.history_company_key('  SYNTHETIC Labs Inc. '),'synthetic labs inc.','conservative company key retains punctuation/suffix');
select is(public.history_company_loose_key('  SYNTHETIC Labs Inc. '),'synthetic labs','loose key only suggests an alias');
select is(public.history_company_key(U&'SYNTHETIC\3000Labs'),'synthetic labs','Unicode NFKC spaces match client');
select set_config('test.history_input',jsonb_build_object('candidateId',current_setting('test.resume_candidate'),'teamId','a8000000-0000-4000-9000-000000000200','ownerId','a8000000-0000-4000-9000-000000000003','companyName','Synthetic Labs','jobTitle','Engineer','jobDescription','Synthetic tools','jobUrl','https://jobs.example.invalid/jobs/123','externalId','123','jobLocation',null,'priority','normal','followUpAt',null,'lastContactAt',null,'notes','PRIVATE HISTORY NOTE','outcome','','resumeDocumentId',null,'coverLetterDocumentId',null)::text,true);
select set_config('test.history_bid',public.save_bid('a8000000-0000-4000-9000-000000000100',null,0,current_setting('test.history_input')::jsonb,gen_random_uuid(),gen_random_uuid())->>'id',true);
select is(jsonb_array_length(public.application_history_candidates('a8000000-0000-4000-9000-000000000100',current_setting('test.resume_candidate')::uuid,'SYNTHETIC LABS')->'rows'),1,'authorized member sees matching history');
select is(public.application_history_candidates('a8000000-0000-4000-9000-000000000100',current_setting('test.resume_candidate')::uuid,'Synthetic Labs')->'rows'->0->>'status','draft','draft is reported without implying submission');
select ok(not (public.application_history_candidates('a8000000-0000-4000-9000-000000000100',current_setting('test.resume_candidate')::uuid,'Synthetic Labs')->'rows'->0 ? 'notes'),'history projection excludes private notes');
select is(jsonb_array_length(public.application_history_candidates('a8000000-0000-4000-9000-000000000100',current_setting('test.resume_candidate')::uuid,'Synthetic Unrelated')->'rows'),0,'successful authorized empty scope is empty');
select throws_ok($q$select public.application_history_candidates('a8000000-0000-4000-9000-000000000999',current_setting('test.resume_candidate')::uuid,'Synthetic Labs')$q$,'42501','FORBIDDEN','other organization is denied');
reset role;
select set_config('request.jwt.claims','{"sub":"a8000000-0000-4000-9000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($q$select public.application_history_candidates('a8000000-0000-4000-9000-000000000100',current_setting('test.resume_candidate')::uuid,'Synthetic Labs')$q$,'42501','FORBIDDEN','ungranted bidder cannot probe candidate history');
select ok(not has_function_privilege('anon','public.application_history_candidates(uuid,uuid,text)','EXECUTE'),'anonymous history is denied');
select ok(not has_column_privilege('authenticated','public.bids','history_company_key','UPDATE'),'matching indexes cannot be rewritten by clients');
reset role;
select ok(not p.prosecdef,'history function retains user RLS context') from pg_proc p where p.oid='public.application_history_candidates(uuid,uuid,text)'::regprocedure;
select * from finish();rollback;
