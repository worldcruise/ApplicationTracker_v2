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
select set_config('test.assembly',public.assemble_resume_prompt('a8000000-0000-4000-9000-000000000100',current_setting('test.resume_candidate')::uuid,1,'{"company":"Target Co","title":"Engineer","description":"Reviewed synthetic job"}',gen_random_uuid())::text,true);
select ok((select prompt_text like '%PROTECTED RULES%' from public.prompt_assemblies),'protected prompt instructions included');
select ok((select prompt_text not like '%PRIVATE DO NOT COPY%' and prompt_text not like '%zoe@example.invalid%' from public.prompt_assemblies),'prompt excludes private notes and contact details');
select ok((select prompt_sha256=encode(sha256(convert_to(prompt_text,'UTF8')),'hex') from public.prompt_assemblies),'exact prompt text hash matches');
select set_config('test.payload',jsonb_build_object('operationId','a8000000-0000-4000-9000-000000000300','assemblyId',current_setting('test.assembly'),'schemaVersion',1,'rawJson',E'{\n "company":"Target Co","title":"Engineer","summary":"Built synthetic tools.","skills":[],"experience":[],"education":[],"unsupported":"retained"}',
 'review','{"experienceIds":[],"educationIds":[],"claims":{}}'::jsonb,'render',null)::text,true);
select lives_ok($$select public.save_resume_source('a8000000-0000-4000-9000-000000000100',current_setting('test.resume_candidate')::uuid,current_setting('test.payload')::jsonb,gen_random_uuid())$$,'source saves atomically');
select is((select count(*)::int from public.resume_versions),1,'one immutable source version');
select ok((select reviewed and provenance->>'reviewerId'='a8000000-0000-4000-9000-000000000001' from public.resume_versions),'database derives factual review and reviewer');
select ok((select raw_json like '%unsupported%' and not parsed_content ? 'unsupported' from public.resume_versions),'original unsupported JSON preserved outside rendered content');
select ok((public.save_resume_source('a8000000-0000-4000-9000-000000000100',current_setting('test.resume_candidate')::uuid,current_setting('test.payload')::jsonb,gen_random_uuid())->>'replayed')::boolean,'same actor/key/payload replays');
select throws_ok($$select public.save_resume_source('a8000000-0000-4000-9000-000000000100',current_setting('test.resume_candidate')::uuid,current_setting('test.payload')::jsonb||'{"rawJson":"{}"}',gen_random_uuid())$$,'22023','KEY_PAYLOAD_MISMATCH','changed payload cannot reuse key');
select throws_ok($$update public.resume_versions set raw_json='{}'$$,'42501',null,'clients cannot rewrite source versions');
select throws_ok($$delete from public.prompt_assemblies$$,'42501',null,'clients cannot remove frozen assemblies');
select throws_ok($$select public.publish_prompt_version('a8000000-0000-4000-9000-000000000100',null,0,'{"kind":"custom","scope":"candidate","teamId":null,"candidateId":"a8000000-0000-4000-9000-000000000999","name":"Bad scope","description":"","content":"x","enabled":true,"order":0}',gen_random_uuid())$$,'23503',null,'foreign candidate prompt scope rejected');
reset role;
select throws_ok($$select private.resume_structure('{"skills":[],"company":"x"}')$$,'22023','SCHEMA_INVALID','database rejects missing required v1 structure');
select throws_ok($$select private.resume_structure('{"__proto__":{},"company":"x"}')$$,'22023','SCHEMA_INVALID','database rejects prototype keys');
select is(private.resume_reviewed('{"company":"x","title":"","summary":"Invented 99% improvement","skills":[],"experience":[],"education":[]}',
 '{"status":"ready","professionalSummary":"Improved by 20%.","experiences":[],"educations":[],"certifications":[]}',
 '{"experienceIds":[],"educationIds":[],"claims":{"/summary":{"sources":["profile:summary"],"attested":true}}}'),false,'attestation cannot invent numerical evidence');
select is(private.resume_reviewed('{"company":"x","title":"","summary":"Improved by 20%.","skills":[],"experience":[],"education":[]}',
 '{"status":"ready","professionalSummary":"Improved by 20%.","experiences":[],"educations":[],"certifications":[]}',
 '{"experienceIds":[],"educationIds":[],"claims":{}}'),true,'exact source evidence can verify automatically');
select throws_ok($$update public.resume_versions set raw_json='{}'$$,'42501','IMMUTABLE_PROFILE_REVISION','owner rewrite is also blocked');
select set_config('request.jwt.claims','{"sub":"a8000000-0000-4000-9000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*)::int from public.resume_versions),0,'bidders receive no unrestricted source history');
select is((select count(*)::int from public.prompt_assemblies),0,'bidders receive no candidate prompt snapshots');
select throws_ok($$select public.assemble_resume_prompt('a8000000-0000-4000-9000-000000000100',current_setting('test.resume_candidate')::uuid,1,'{"company":"Target","title":"Role","description":"x"}',gen_random_uuid())$$,'42501','FORBIDDEN','bidder generation is denied');
select * from finish(); rollback;
