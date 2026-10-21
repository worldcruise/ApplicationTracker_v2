begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
-- Trusted rollback-only fixtures. Every assertion executes with a real runtime
-- role; no production transition is bypassed by the application search path.
insert into auth.users(id,email,email_confirmed_at) select ('15000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'synthetic-search-'||n||'@example.invalid',now() from generate_series(1,6) n;
insert into public.users(id,display_name) select ('15000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,case n when 3 then 'Synthetic Morgan Owner' else 'Synthetic Search User '||n end from generate_series(1,6) n;
insert into public.organizations(id,name) values('15000000-0000-4000-8000-000000000100','Synthetic Search'),('15000000-0000-4000-8000-000000000101','Synthetic Other');
insert into public.organization_memberships(organization_id,user_id,role,state) select case when n=6 then '15000000-0000-4000-8000-000000000101'::uuid else '15000000-0000-4000-8000-000000000100'::uuid end,('15000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,case n when 1 then 'admin' when 2 then 'team_leader' when 3 then 'team_member' when 4 then 'bidder' when 5 then 'team_leader' else 'admin' end,'active' from generate_series(1,6) n;
insert into public.teams(id,organization_id,name,created_by) select ('15000000-0000-4000-8000-'||lpad((200+n)::text,12,'0'))::uuid,'15000000-0000-4000-8000-000000000100','Synthetic Team '||n,'15000000-0000-4000-8000-000000000001' from generate_series(1,2) n;
insert into public.team_memberships(organization_id,team_id,user_id,role,created_by) select organization_id,case when user_id='15000000-0000-4000-8000-000000000005' then '15000000-0000-4000-8000-000000000202'::uuid else '15000000-0000-4000-8000-000000000201'::uuid end,user_id,role,'15000000-0000-4000-8000-000000000001' from public.organization_memberships where organization_id='15000000-0000-4000-8000-000000000100' and role<>'admin';
insert into public.candidates(id,organization_id,owning_team_id,full_name,private_notes,created_by) values
 ('15000000-0000-4000-8000-000000000301','15000000-0000-4000-8000-000000000100','15000000-0000-4000-8000-000000000201','Synthetic Avery O''Neil','ultrasecretprofiletoken','15000000-0000-4000-8000-000000000001'),
 ('15000000-0000-4000-8000-000000000302','15000000-0000-4000-8000-000000000100','15000000-0000-4000-8000-000000000202','Synthetic Hidden Candidate',null,'15000000-0000-4000-8000-000000000001');
insert into public.candidate_assignments(organization_id,candidate_id,team_id,user_id,created_by) values('15000000-0000-4000-8000-000000000100','15000000-0000-4000-8000-000000000301','15000000-0000-4000-8000-000000000201','15000000-0000-4000-8000-000000000003','15000000-0000-4000-8000-000000000001');
insert into public.bids(id,organization_id,candidate_id,team_id,owner_id,company_name,job_title,job_description,external_id,notes,priority,created_by,prepared_by,created_at,submitted_at,follow_up_at)
 select ('15000000-0000-4000-8000-'||lpad((400+n)::text,12,'0'))::uuid,'15000000-0000-4000-8000-000000000100','15000000-0000-4000-8000-000000000301','15000000-0000-4000-8000-000000000201','15000000-0000-4000-8000-000000000003',case when n=1 then 'Northstar' else 'Northstar Labs '||lpad(n::text,2,'0') end,'Platform Engineer','Build PostgreSQL infrastructure',case when n=1 then 'EX-NEIL-01' end,'Literal 100%_ value',case when n=1 then 'urgent' else 'normal' end,'15000000-0000-4000-8000-000000000001','15000000-0000-4000-8000-000000000001','2026-10-21T00:00:00Z'::timestamptz+(n-1)*interval '1 hour',case when n=1 then '2026-10-21T23:59:59Z'::timestamptz end,case when n=1 then now()-interval '1 hour' end from generate_series(1,27) n;
insert into public.bids(id,organization_id,candidate_id,team_id,owner_id,company_name,job_title,created_by,prepared_by) values('15000000-0000-4000-8000-000000000499','15000000-0000-4000-8000-000000000100','15000000-0000-4000-8000-000000000302','15000000-0000-4000-8000-000000000202','15000000-0000-4000-8000-000000000005','HiddenCompanyToken','Engineer','15000000-0000-4000-8000-000000000001','15000000-0000-4000-8000-000000000001');
insert into public.interviews(id,organization_id,bid_id,round_number,type,interviewer,owner_id,lifecycle_status,scheduled_at,timezone,created_by,next_action,follow_up_at) values
 ('15000000-0000-4000-8000-000000000501','15000000-0000-4000-8000-000000000100','15000000-0000-4000-8000-000000000401',1,'Technical','Synthetic Élodie Reviewer','15000000-0000-4000-8000-000000000003','completed','2026-10-21T23:59:59Z','UTC','15000000-0000-4000-8000-000000000001','Schedule debrief',now()-interval '1 hour'),
 ('15000000-0000-4000-8000-000000000502','15000000-0000-4000-8000-000000000100','15000000-0000-4000-8000-000000000402',1,'Screening','Synthetic Recruiter','15000000-0000-4000-8000-000000000003','scheduled',now()+interval '1 day','UTC','15000000-0000-4000-8000-000000000001','Collect feedback',null);
insert into public.interview_feedback(organization_id,interview_id,revision_number,feedback,created_by) values
 ('15000000-0000-4000-8000-000000000100','15000000-0000-4000-8000-000000000501',1,'supersededfeedbacktoken','15000000-0000-4000-8000-000000000003'),
 ('15000000-0000-4000-8000-000000000100','15000000-0000-4000-8000-000000000501',2,'currentfeedbacktoken strong systems reasoning','15000000-0000-4000-8000-000000000003');
insert into public.bid_access_grants(organization_id,bid_id,user_id,capability,created_by) values('15000000-0000-4000-8000-000000000100','15000000-0000-4000-8000-000000000401','15000000-0000-4000-8000-000000000004','bid.prepare','15000000-0000-4000-8000-000000000001');
-- More than the legacy agenda's 200 rows. This candidate is not assigned to the
-- Member, so it also exercises different authorized counts without changing the
-- Member's original 27 opportunities.
insert into public.candidates(id,organization_id,owning_team_id,full_name,created_by) values('15000000-0000-4000-8000-000000000303','15000000-0000-4000-8000-000000000100','15000000-0000-4000-8000-000000000201','Synthetic Pagination Sol','15000000-0000-4000-8000-000000000001');
insert into public.bids(id,organization_id,candidate_id,team_id,owner_id,company_name,job_title,created_by,prepared_by) values('15000000-0000-4000-8000-000000000498','15000000-0000-4000-8000-000000000100','15000000-0000-4000-8000-000000000303','15000000-0000-4000-8000-000000000201','15000000-0000-4000-8000-000000000001','Pagination Company','Researcher','15000000-0000-4000-8000-000000000001','15000000-0000-4000-8000-000000000001');
insert into public.interviews(id,organization_id,bid_id,round_number,type,owner_id,lifecycle_status,created_by) select ('15000000-0000-4000-8000-'||lpad((600+n)::text,12,'0'))::uuid,'15000000-0000-4000-8000-000000000100','15000000-0000-4000-8000-000000000498',n,'Pagination','15000000-0000-4000-8000-000000000001','not_scheduled','15000000-0000-4000-8000-000000000001' from generate_series(1,201) n;
create function pg_temp.search(p_kind text,p_filters jsonb default '{}') returns jsonb language sql as $$select public.search_workflow('15000000-0000-4000-8000-000000000100',p_kind,p_filters)$$;
select ok(not prosecdef,'search uses invoker RLS') from pg_proc where oid='public.search_workflow(uuid,text,jsonb)'::regprocedure;
select ok(not has_function_privilege('anon','public.search_workflow(uuid,text,jsonb)','EXECUTE'),'anonymous RPC denied');
select is((select count(*)::int from pg_indexes where indexname in ('bids_search_fts','bids_company_trgm','candidates_search_fts','candidates_name_trgm','interviews_search_fts','feedback_search_fts')),6,'FTS and trigram source indexes exist');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"15000000-0000-4000-8000-000000000001"}',true);
set local role authenticated;
select is(pg_temp.search('bids','{"q":"  NORTHSTAR  "}')->'items'->0->>'companyName','Northstar','exact company ranks above prefix matches');
select is((pg_temp.search('bids','{"q":"Aver"}')->>'total')::int,27,'partial related candidate matches all opportunities');
select is((pg_temp.search('bids','{"q":"  Avery   Northstar engineer "}')->>'total')::int,27,'multiword across related fields ignores whitespace');
select is((pg_temp.search('bids','{"q":"Nrothstar"}')->>'total')::int,27,'common transposition finds company');
select is((pg_temp.search('bids','{"q":"O''Neil"}')->>'total')::int,27,'apostrophes safe');
select is((pg_temp.search('bids','{"q":"EX-NEIL-01"}')->>'total')::int,1,'external identifier matches');
select is((pg_temp.search('bids','{"q":"Morgan"}')->>'total')::int,27,'authorized roster owner matches');
select is((pg_temp.search('bids','{"q":"PostgreSQL"}')->>'total')::int,27,'authorized job description matches');
select is((pg_temp.search('bids','{"q":"%_"}')->>'total')::int,27,'punctuation is literal, not wildcard');
select is((pg_temp.search('bids','{"q":"unmatchedzzzz"}')->>'total')::int,0,'unmatched input is empty');
select is((pg_temp.search('bids','{"q":"C++"}')->>'total')::int,0,'technical punctuation does not broaden to a letter search');
select is((pg_temp.search('bids','{"q":"Northstar","priority":"urgent","status":"draft","company":"NORTHSTAR","followup":"overdue"}')->>'total')::int,1,'combined exact filters and text');
select is((pg_temp.search('bids','{"q":"Northstar","createdFrom":"2026-10-21","createdTo":"2026-10-21"}')->>'total')::int,24,'UTC inclusive day excludes next midnight');
select is((pg_temp.search('bids','{"submittedFrom":"2026-10-21","submittedTo":"2026-10-21"}')->>'total')::int,1,'submission end date includes last second');
select is(jsonb_array_length(pg_temp.search('bids','{"q":"Northstar","page":2,"pageSize":25,"sort":"company_asc"}')->'items'),2,'second page has remaining rows');
select is((pg_temp.search('bids','{"q":"Northstar","page":2,"pageSize":25}')->>'total')::int,27,'count independent of page');
select is(jsonb_array_length(pg_temp.search('bids','{"page":999}')->'items'),0,'out of range page retains count without rows');
select is((pg_temp.search('interviews','{"q":"Northstar"}')->>'total')::int,2,'company joins find interviews');
select is((pg_temp.search('interviews','{"q":"Avery Élodie","type":"technical","round":1,"status":"completed","scheduledFrom":"2026-10-21","scheduledTo":"2026-10-21"}')->>'total')::int,1,'combined related interview search and UTC boundary');
select is((pg_temp.search('interviews','{"q":"currentfeedbacktoken"}')->>'total')::int,1,'authorized latest feedback matches');
select is((pg_temp.search('interviews','{"q":"supersededfeedbacktoken"}')->>'total')::int,0,'superseded feedback stays history, not current search');
select is((pg_temp.search('interviews','{"upcoming":true}')->>'total')::int,1,'upcoming excludes completed');
select is((pg_temp.search('interviews','{"followup":"overdue"}')->>'total')::int,1,'interview followup independent of outcome');
select is((pg_temp.search('interviews','{"company":"Pagination Company","page":3,"pageSize":100}')->>'total')::int,201,'interview count searches beyond the old 200-row agenda');
select is(jsonb_array_length(pg_temp.search('interviews','{"company":"Pagination Company","page":3,"pageSize":100}')->'items'),1,'interview pagination retrieves the 201st authorized round');
select throws_ok($$select pg_temp.search('bids','{"createdFrom":"2026-02-30"}')$$,'22008',null,'direct invalid date rejected');
select throws_ok($$select pg_temp.search('bids','{"pageSize":101}')$$,'22023','INVALID_SEARCH','direct oversized page rejected');
select throws_ok($$select pg_temp.search('interviews','{"status":"offer"}')$$,'22023','INVALID_SEARCH','outcome cannot masquerade as lifecycle');
reset role;
update public.candidates set full_name='Synthetic Renamed Harper' where id='15000000-0000-4000-8000-000000000301';
update public.bids set company_name='UpdatedCompanyToken' where id='15000000-0000-4000-8000-000000000401';
set local role authenticated;
select is((pg_temp.search('bids','{"q":"Harper"}')->>'total')::int,27,'candidate rename searchable immediately');
select is((pg_temp.search('interviews','{"q":"UpdatedCompanyToken"}')->>'total')::int,1,'changed bid company immediately updates interview search');
reset role;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"15000000-0000-4000-8000-000000000003"}',true);
set local role authenticated;
select is((pg_temp.search('bids')->>'total')::int,27,'member assignment scopes count');
-- Similar authorized names can be fuzzy matches. Check the actual denied ID,
-- plus the exact company filter, instead of equating every fuzzy hit with a leak.
select ok(not exists(select 1 from jsonb_array_elements(pg_temp.search('bids','{"q":"HiddenCompanyToken"}')->'items') r where r->'record'->>'id'='15000000-0000-4000-8000-000000000499'),'cross-team record never appears in text results');
select is((pg_temp.search('bids','{"q":"HiddenCompanyToken","company":"HiddenCompanyToken"}')->>'total')::int,0,'exact inaccessible company filter has zero authorized results');
select is(jsonb_array_length(pg_temp.search('bids')->'options'->'teams'),1,'options use same authorized record scope');
reset role;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"15000000-0000-4000-8000-000000000004"}',true);
set local role authenticated;
select is((pg_temp.search('bids','{"q":"Harper"}')->>'total')::int,1,'bidder name search uses exact safe prepare grant');
select is((pg_temp.search('bids','{"q":"ultrasecretprofiletoken"}')->>'total')::int,0,'private profile text never participates in bidder matching');
select is((pg_temp.search('bids','{"q":"currentfeedbacktoken"}')->>'total')::int,0,'feedback cannot leak through bid matching');
select throws_ok($$select pg_temp.search('interviews')$$,'42501','FORBIDDEN','bidder interview RPC denied');
select is((pg_temp.search('bids','{"q":"Morgan"}')->>'total')::int,0,'owner names outside roster scope do not participate');
select is((pg_temp.search('bids','{"q":"15000000-0000-4000-8000-000000000003"}')->>'total')::int,1,'readable owner IDs searchable without widening roster access');
reset role;
update public.bid_access_grants set revoked_at=now() where user_id='15000000-0000-4000-8000-000000000004';
insert into public.bid_access_grants(organization_id,bid_id,user_id,capability,created_by) values('15000000-0000-4000-8000-000000000100','15000000-0000-4000-8000-000000000401','15000000-0000-4000-8000-000000000004','bid.submit','15000000-0000-4000-8000-000000000001');
set local role authenticated;
select is((pg_temp.search('bids')->>'total')::int,1,'submit-only bid remains accessible');
select is((pg_temp.search('bids','{"q":"Harper"}')->>'total')::int,0,'submit-only grant does not gain candidate-name matching');
select is(jsonb_array_length(pg_temp.search('bids')->'options'->'candidates'),0,'submit-only filter options do not reveal candidate name');
reset role;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"15000000-0000-4000-8000-000000000005"}',true);
set local role authenticated;
select is((pg_temp.search('bids')->>'total')::int,1,'other team leader sees only own team');
select is((pg_temp.search('bids','{"q":"Harper"}')->>'total')::int,0,'related candidate cannot bypass team scope');
reset role;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"15000000-0000-4000-8000-000000000006"}',true);
set local role authenticated;
select throws_ok($$select pg_temp.search('bids')$$,'42501','FORBIDDEN','other organization denied');
reset role;
select * from finish();
rollback;
