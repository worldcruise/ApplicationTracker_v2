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

select set_config('test.assembly',public.assemble_resume_prompt('a8000000-0000-4000-9000-000000000100',current_setting('test.resume_candidate')::uuid,2,'{"company":"Synthetic Opportunity One","title":"Engineer","description":"Synthetic job"}',gen_random_uuid())::text,true);
select set_config('test.source_payload',jsonb_build_object('operationId',gen_random_uuid(),'assemblyId',current_setting('test.assembly'),'schemaVersion',1,'rawJson','{"company":"Synthetic Opportunity One","title":"Engineer","summary":"Built synthetic tools.","skills":[],"experience":[],"education":[]}','review','{"experienceIds":[],"educationIds":[],"claims":{}}'::jsonb,'render',jsonb_build_object('sha256',encode(sha256(convert_to('%PDF-Synthetic-1','UTF8')),'hex'),'pageCount',1,'rendererVersion','ats-classic/1.0.0','renderedAt','2026-10-19T14:00:00.000Z'))::text,true);
select set_config('test.source1',public.save_resume_source('a8000000-0000-4000-9000-000000000100',current_setting('test.resume_candidate')::uuid,current_setting('test.source_payload')::jsonb,gen_random_uuid())->>'id',true);
select set_config('test.source2',public.save_resume_source('a8000000-0000-4000-9000-000000000100',current_setting('test.resume_candidate')::uuid,current_setting('test.source_payload')::jsonb||jsonb_build_object('operationId',gen_random_uuid(),'render',jsonb_build_object('sha256',encode(sha256(convert_to('%PDF-Synthetic-2','UTF8')),'hex'),'pageCount',1,'rendererVersion','ats-classic/1.0.0','renderedAt','2026-10-19T14:00:00.000Z')),gen_random_uuid())->>'id',true);
reset role;
-- Trusted fixture metadata/placeholder bytes isolate workflow authorization.
-- Actual PDF rendering/attestation is covered separately by production HTTP tests.
insert into public.documents(id,organization_id,candidate_id,kind,resume_version_id,filename,pdf_sha256,byte_size,page_count,schema_version,template_version_id,renderer_version,asset_hashes,reviewed,created_by)
select ('a8000000-0000-4000-9000-00000000060'||n)::uuid,'a8000000-0000-4000-9000-000000000100',candidate_id,'resume',id,'Synthetic-'||n||'.pdf',render_receipt->>'sha256',octet_length('%PDF-Synthetic-'||n),1,1,template_version_id,renderer_version,template_snapshot->'assetHashes',reviewed,created_by from public.resume_versions cross join generate_series(1,2)n where id=(current_setting('test.source'||n))::uuid;
insert into public.document_blobs(document_id,pdf_bytes) select ('a8000000-0000-4000-9000-00000000060'||n)::uuid,convert_to('%PDF-Synthetic-'||n,'UTF8') from generate_series(1,2)n;
set local role authenticated;
select set_config('test.bid_input',(current_setting('test.bid_input')::jsonb||'{"resumeDocumentId":"a8000000-0000-4000-9000-000000000601"}')::text,true);
select set_config('test.bid',public.save_bid('a8000000-0000-4000-9000-000000000100',null,0,current_setting('test.bid_input')::jsonb,gen_random_uuid(),gen_random_uuid())->>'id',true);
select public.transition_bid('a8000000-0000-4000-9000-000000000100',current_setting('test.bid')::uuid,1,'{"status":"resume_preparation","reason":"Prepare","submittedAt":null,"confirmation":"","attested":false,"adminOverrideReason":"","reopen":false}',gen_random_uuid(),gen_random_uuid());
select public.transition_bid('a8000000-0000-4000-9000-000000000100',current_setting('test.bid')::uuid,2,'{"status":"ready_for_review","reason":"Review exact package","submittedAt":null,"confirmation":"","attested":false,"adminOverrideReason":"","reopen":false}',gen_random_uuid(),gen_random_uuid());
select throws_ok($$select public.transition_bid('a8000000-0000-4000-9000-000000000100',current_setting('test.bid')::uuid,3,'{"status":"approved","reason":"Self review","submittedAt":null,"confirmation":"","attested":false,"adminOverrideReason":"","reopen":false}',gen_random_uuid(),gen_random_uuid())$$,'42501','FORBIDDEN','member package owner cannot approve');
select set_config('request.jwt.claims','{"sub":"a8000000-0000-4000-9000-000000000002","role":"authenticated"}',true);
select lives_ok($$select public.transition_bid('a8000000-0000-4000-9000-000000000100',current_setting('test.bid')::uuid,3,'{"status":"approved","reason":"Independent review","submittedAt":null,"confirmation":"","attested":false,"adminOverrideReason":"","reopen":false}',gen_random_uuid(),gen_random_uuid())$$,'independent team leader approves exact package');
select set_config('test.approval',(select current_approval_id::text from public.bids where id=current_setting('test.bid')::uuid),true);
select is((select resume_document_id::text from public.bid_approvals where id=current_setting('test.approval')::uuid),'a8000000-0000-4000-9000-000000000601','approval pins document one');
select set_config('request.jwt.claims','{"sub":"a8000000-0000-4000-9000-000000000003","role":"authenticated"}',true);
select public.save_bid('a8000000-0000-4000-9000-000000000100',current_setting('test.bid')::uuid,4,current_setting('test.bid_input')::jsonb||'{"priority":"high"}',gen_random_uuid(),gen_random_uuid());
select is((select current_approval_id::text from public.bids where id=current_setting('test.bid')::uuid),current_setting('test.approval'),'irrelevant priority change retains exact approval');
select set_config('test.bid_input',(current_setting('test.bid_input')::jsonb||'{"resumeDocumentId":"a8000000-0000-4000-9000-000000000602"}')::text,true);
select public.save_bid('a8000000-0000-4000-9000-000000000100',current_setting('test.bid')::uuid,5,current_setting('test.bid_input')::jsonb,gen_random_uuid(),gen_random_uuid());
select is((select status from public.bids where id=current_setting('test.bid')::uuid),'resume_preparation','changed exact document invalidates Approved status');
select is((select current_approval_id from public.bids where id=current_setting('test.bid')::uuid),null::uuid,'changed document clears current approval');
select is((select count(*)::integer from public.bid_approval_invalidations where approval_id=current_setting('test.approval')::uuid),1,'invalidation is append-only evidence');
select is((select resume_document_id::text from public.bid_approvals where id=current_setting('test.approval')::uuid),'a8000000-0000-4000-9000-000000000601','earlier approval remains unchanged');
select public.transition_bid('a8000000-0000-4000-9000-000000000100',current_setting('test.bid')::uuid,6,'{"status":"ready_for_review","reason":"Review changed version","submittedAt":null,"confirmation":"","attested":false,"adminOverrideReason":"","reopen":false}',gen_random_uuid(),gen_random_uuid());
select set_config('request.jwt.claims','{"sub":"a8000000-0000-4000-9000-000000000002","role":"authenticated"}',true);
select public.transition_bid('a8000000-0000-4000-9000-000000000100',current_setting('test.bid')::uuid,7,'{"status":"approved","reason":"Reviewed document two","submittedAt":null,"confirmation":"","attested":false,"adminOverrideReason":"","reopen":false}',gen_random_uuid(),gen_random_uuid());
select set_config('request.jwt.claims','{"sub":"a8000000-0000-4000-9000-000000000003","role":"authenticated"}',true);
select throws_ok($$select public.transition_bid('a8000000-0000-4000-9000-000000000100',current_setting('test.bid')::uuid,8,'{"status":"submitted","reason":"Missing confirmation","submittedAt":null,"confirmation":"","attested":false,"adminOverrideReason":"","reopen":false}',gen_random_uuid(),gen_random_uuid())$$,'22023','SUBMISSION_ATTESTATION_REQUIRED','approval alone never implies actual submission');
select set_config('test.sub_op',gen_random_uuid()::text,true);
select set_config('test.sub_input',jsonb_build_object('status','submitted','reason','User explicitly records actual submission','submittedAt',now(),'confirmation','Synthetic confirmation','attested',true,'adminOverrideReason','','reopen',false)::text,true);
select lives_ok($$select public.transition_bid('a8000000-0000-4000-9000-000000000100',current_setting('test.bid')::uuid,8,current_setting('test.sub_input')::jsonb,current_setting('test.sub_op')::uuid,gen_random_uuid())$$,'explicit submission records exact frozen versions');
select lives_ok($$select public.transition_bid('a8000000-0000-4000-9000-000000000100',current_setting('test.bid')::uuid,8,current_setting('test.sub_input')::jsonb,current_setting('test.sub_op')::uuid,gen_random_uuid())$$,'lost-response retry reconciles the same submission');
select is((select count(*)::integer from public.bid_submissions where bid_id=current_setting('test.bid')::uuid),1,'retry cannot duplicate submission');
select is((select resume_document_id::text from public.bid_submissions where bid_id=current_setting('test.bid')::uuid),'a8000000-0000-4000-9000-000000000602','submission pins approved document two');
select throws_ok($$select public.save_bid('a8000000-0000-4000-9000-000000000100',current_setting('test.bid')::uuid,9,current_setting('test.bid_input')::jsonb||'{"jobTitle":"Different submitted job"}',gen_random_uuid(),gen_random_uuid())$$,'22023','BID_CONTENT_FROZEN','submitted job cannot silently change');
select lives_ok($$select public.save_bid('a8000000-0000-4000-9000-000000000100',current_setting('test.bid')::uuid,9,current_setting('test.bid_input')::jsonb||jsonb_build_object('followUpAt',now()+interval '2 days'),gen_random_uuid(),gen_random_uuid())$$,'operational follow-up can change after submission');
reset role;
select throws_ok($$update public.bid_submissions set confirmation='overwritten'$$,'42501','IMMUTABLE_PROFILE_REVISION','even owner cannot rewrite submission event');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a8000000-0000-4000-9000-000000000003","role":"authenticated"}',true);
select set_config('test.pending',public.save_bid('a8000000-0000-4000-9000-000000000100',null,0,current_setting('test.bid_input')::jsonb,gen_random_uuid(),gen_random_uuid())->>'id',true);
select public.transition_bid('a8000000-0000-4000-9000-000000000100',current_setting('test.pending')::uuid,1,'{"status":"resume_preparation","reason":"Prepare","submittedAt":null,"confirmation":"","attested":false,"adminOverrideReason":"","reopen":false}',gen_random_uuid(),gen_random_uuid());
select public.transition_bid('a8000000-0000-4000-9000-000000000100',current_setting('test.pending')::uuid,2,'{"status":"ready_for_review","reason":"Fresh facts","submittedAt":null,"confirmation":"","attested":false,"adminOverrideReason":"","reopen":false}',gen_random_uuid(),gen_random_uuid());
select set_config('request.jwt.claims','{"sub":"a8000000-0000-4000-9000-000000000002","role":"authenticated"}',true);
select public.transition_bid('a8000000-0000-4000-9000-000000000100',current_setting('test.pending')::uuid,3,'{"status":"approved","reason":"Reviewed","submittedAt":null,"confirmation":"","attested":false,"adminOverrideReason":"","reopen":false}',gen_random_uuid(),gen_random_uuid());
select set_config('request.jwt.claims','{"sub":"a8000000-0000-4000-9000-000000000003","role":"authenticated"}',true);
select public.save_candidate_profile('a8000000-0000-4000-9000-000000000100',current_setting('test.resume_candidate')::uuid,2,
 '{"fullName":"Synthetic Zoë","email":"zoe@example.invalid","phone":"+1 202 555 0100","location":"Synthetic City","seniorityPreference":null,"professionalSummary":"Changed verified facts.","privateNotes":"","status":"ready","links":[],"experiences":[],"educations":[],"certifications":[]}',gen_random_uuid());
select is((select status from public.bids where id=current_setting('test.pending')::uuid),'resume_preparation','changed facts invalidate pending approval');
select throws_ok($$select public.transition_bid('a8000000-0000-4000-9000-000000000100',current_setting('test.pending')::uuid,5,'{"status":"ready_for_review","reason":"Stale facts","submittedAt":null,"confirmation":"","attested":false,"adminOverrideReason":"","reopen":false}',gen_random_uuid(),gen_random_uuid())$$,'22023','PROFILE_FACTS_CHANGED','historical documents cannot be reapproved after facts change');
select is((select resume_document_id::text from public.bid_submissions where bid_id=current_setting('test.bid')::uuid),'a8000000-0000-4000-9000-000000000602','changed profile preserves prior submission');
select * from finish();rollback;
