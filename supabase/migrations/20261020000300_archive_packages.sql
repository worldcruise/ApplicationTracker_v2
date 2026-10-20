begin;
-- Package export has its own non-login, forced-RLS reader. It cannot read profile snapshots.
create role app_archive_exporter nologin nobypassrls noinherit;
grant app_archive_exporter to postgres;
grant usage on schema public,private to app_archive_exporter;
grant execute on function private.actor_id(),private.org_role(uuid),private.document_access(uuid,uuid,boolean),private.reads_candidate(uuid,uuid) to app_archive_exporter;
grant select on public.documents,public.bid_document_links to app_archive_exporter;
create policy archive_export on public.documents for select to app_archive_exporter using(private.document_access(organization_id,id,true));
create policy archive_export on public.bid_document_links for select to app_archive_exporter using(private.document_access(organization_id,document_id,true));
grant select(id,organization_id,raw_json,parsed_content,template_snapshot,render_receipt,reviewed) on public.resume_versions to app_archive_exporter;
grant select(id,organization_id,body_text,template_snapshot,render_receipt,reviewed) on public.cover_letter_versions to app_archive_exporter;
create policy archive_export on public.resume_versions for select to app_archive_exporter using(exists(select 1 from public.documents d where d.organization_id=resume_versions.organization_id and d.resume_version_id=resume_versions.id and private.document_access(d.organization_id,d.id,true)));
create policy archive_export on public.cover_letter_versions for select to app_archive_exporter using(exists(select 1 from public.documents d where d.organization_id=cover_letter_versions.organization_id and d.cover_letter_version_id=cover_letter_versions.id and private.document_access(d.organization_id,d.id,true)));
grant create on schema public to app_archive_exporter;
create function public.export_archive_source(p_org uuid,p_document uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.documents; result jsonb;
begin
 if private.org_role(p_org) is null or not private.document_access(p_org,p_document,true) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select * into d from public.documents where organization_id=p_org and id=p_document;
 if not found or not d.reviewed then raise exception 'VERIFIED_DOCUMENTS_REQUIRED' using errcode='22023';end if;
 if d.kind='resume' then
  select jsonb_build_object('rawJson',r.raw_json,'template',r.template_snapshot,'render',r.render_receipt) into result from public.resume_versions r where r.id=d.resume_version_id and r.organization_id=p_org and r.reviewed
   -- A bidder must never receive hidden, unsupported raw JSON properties. Do not rewrite the original.
   and (private.org_role(p_org)<>'bidder' or r.raw_json::jsonb=r.parsed_content);
 else
  select jsonb_build_object('text',l.body_text,'template',l.template_snapshot,'render',l.render_receipt) into result from public.cover_letter_versions l where l.id=d.cover_letter_version_id and l.organization_id=p_org and l.reviewed;
 end if;
 if result is null then raise exception 'PACKAGE_SOURCE_UNSAFE' using errcode='42501';end if;
 return result||jsonb_build_object('documentId',d.id,'candidateId',d.candidate_id,'kind',d.kind,'sourceId',coalesce(d.resume_version_id,d.cover_letter_version_id),'pdfSha256',d.pdf_sha256,'pageCount',d.page_count,'schemaVersion',d.schema_version,
  'bidIds',coalesce((select jsonb_agg(distinct bid_id) from public.bid_document_links where organization_id=p_org and document_id=d.id),'[]'::jsonb));
end $$;
alter function public.export_archive_source(uuid,uuid) owner to app_archive_exporter;
revoke create on schema public from app_archive_exporter;
revoke all on function public.export_archive_source(uuid,uuid) from public,anon;
grant execute on function public.export_archive_source(uuid,uuid) to authenticated,app_command;

-- Explicit frozen export can be archived without granting edit or submission permission.
grant create on schema public to app_permission_reader;
create function public.archive_bid_job(p_org uuid,p_bid uuid,p_document uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('candidateId',b.candidate_id,'teamId',b.team_id,'company',b.company_name,'title',b.job_title,'url',coalesce(b.job_url,''),'description',b.job_description,'externalId',coalesce(b.external_id,''))
 from public.bids b where b.organization_id=p_org and b.id=p_bid and private.org_role(p_org) is not null and
 (private.reads_bid(p_org,p_bid) or exists(select 1 from public.bid_document_links l where l.organization_id=p_org and l.bid_id=p_bid and l.document_id=p_document and private.document_access(p_org,p_document,true)))
$$;
alter function public.archive_bid_job(uuid,uuid,uuid) owner to app_permission_reader;
revoke create on schema public from app_permission_reader;
revoke all on function public.archive_bid_job(uuid,uuid,uuid) from public,anon;
grant execute on function public.archive_bid_job(uuid,uuid,uuid) to authenticated,app_command;
grant execute on function private.document_access(uuid,uuid,boolean) to app_permission_reader;

-- Snapshot token covers all indexed current and frozen job observations in this company scope.
-- Over-limit history blocks automatic duplicate resolution rather than implying absence.
grant execute on function public.application_history_candidates(uuid,uuid,text) to app_command;
create function public.archive_history_snapshot(p_org uuid,p_candidate uuid,p_company text) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v jsonb;
begin
 v:=public.application_history_candidates(p_org,p_candidate,p_company);
 return v||jsonb_build_object('token',encode(sha256(convert_to((v-'checkedAt')::text,'UTF8')),'hex'));
end $$;
revoke all on function public.archive_history_snapshot(uuid,uuid,text) from public,anon;
grant execute on function public.archive_history_snapshot(uuid,uuid,text) to authenticated,app_command;

-- Every normal bid edit takes the same candidate lock before its bid row lock.
alter function public.save_bid(uuid,uuid,bigint,jsonb,uuid,uuid) set schema private;
alter function private.save_bid(uuid,uuid,bigint,jsonb,uuid,uuid) rename to save_bid_unlocked;
revoke all on function private.save_bid_unlocked(uuid,uuid,bigint,jsonb,uuid,uuid) from authenticated,public,anon;
grant create on schema public to app_command;
grant create on schema private to app_command;
create function public.save_bid(p_org uuid,p_bid uuid,p_expected bigint,p_input jsonb,p_operation uuid,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if (p_bid is null and private.candidate_team(p_org,(p_input->>'candidateId')::uuid) is null) or (p_bid is not null and not private.reads_bid(p_org,p_bid)) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 perform private.lock_workflow_candidate(p_org,(p_input->>'candidateId')::uuid);
 return private.save_bid_unlocked(p_org,p_bid,p_expected,p_input,p_operation,p_request);
end $$;
alter function public.save_bid(uuid,uuid,bigint,jsonb,uuid,uuid) owner to app_command;
revoke all on function public.save_bid(uuid,uuid,bigint,jsonb,uuid,uuid) from public,anon;
grant execute on function public.save_bid(uuid,uuid,bigint,jsonb,uuid,uuid) to authenticated;
-- Also serialize the older create-draft command's insert path.
create function private.archive_bid_insert_lock() returns trigger language plpgsql security definer set search_path='' as $$begin perform private.lock_workflow_candidate(new.organization_id,new.candidate_id);return new;end $$;
alter function private.archive_bid_insert_lock() owner to app_command;
revoke create on schema private from app_command;
revoke all on function private.archive_bid_insert_lock() from public;
create trigger archive_candidate_lock before insert on public.bids for each row execute function private.archive_bid_insert_lock();

create table public.archive_operations(
 organization_id uuid not null references public.organizations(id),operation_id uuid not null,actor_id uuid not null references public.users(id),
 candidate_id uuid not null, bid_id uuid not null,request_hash text not null check(request_hash ~ '^[0-9a-f]{64}$'),
 frozen_input jsonb not null,result jsonb not null,created_at timestamptz not null default now(),
 primary key(organization_id,operation_id),foreign key(organization_id,candidate_id) references public.candidates(organization_id,id),
 foreign key(organization_id,bid_id) references public.bids(organization_id,id),check(jsonb_typeof(frozen_input)='object' and jsonb_typeof(result)='object')
);
alter table public.archive_operations enable row level security;alter table public.archive_operations force row level security;
revoke all on public.archive_operations from public,anon,authenticated;
grant select,insert on public.archive_operations to app_command;
create policy command on public.archive_operations to app_command using(private.org_role(organization_id) is not null) with check(actor_id=private.actor_id() and private.org_role(organization_id) is not null);
create trigger immutable before update or delete on public.archive_operations for each row execute function private.immutable_revision();

create function public.archive_operation_result(p_org uuid,p_operation uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare op public.archive_operations;
begin
 if private.org_role(p_org) is null then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select * into op from public.archive_operations where organization_id=p_org and operation_id=p_operation;
 if not found then return null;end if;
 if op.actor_id<>private.actor_id() then raise exception 'KEY_PAYLOAD_MISMATCH';end if;
 if not private.document_access(p_org,(op.result->>'resumeDocumentId')::uuid,true) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if public.archive_bid_job(p_org,op.bid_id,(op.result->>'resumeDocumentId')::uuid) is null then raise exception 'FORBIDDEN' using errcode='42501';end if;
 return op.result;
end $$;
alter function public.archive_operation_result(uuid,uuid) owner to app_command;
revoke all on function public.archive_operation_result(uuid,uuid) from public,anon;
grant execute on function public.archive_operation_result(uuid,uuid) to authenticated;

-- The API signs its exact text after user-context validation of frozen bytes and matching.
-- This is a capability attestation, never a privileged database client or client-side secret.
create function public.save_archive_package(p_envelope text,p_key_id text,p_signature text,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare e jsonb:=p_envelope::jsonb; f jsonb:=e->'input'; org uuid:=(f->>'organizationId')::uuid; cand uuid:=(f->>'candidateId')::uuid; op uuid:=(f->>'operationId')::uuid;
 doc uuid:=(e->>'resumeDocumentId')::uuid; letter uuid:=(e->>'letterDocumentId')::uuid; r jsonb;l jsonb; old public.archive_operations; target uuid; team uuid; result jsonb; job jsonb; snap jsonb; ids jsonb:=e->'exactBidIds';
begin
 if octet_length(p_envelope)>2097152 or not private.valid_render_signature(p_key_id,'archive.v1|'||p_envelope,p_signature) then raise exception 'RENDER_ATTESTATION_REQUIRED';end if;
 if private.org_role(org) is null or (f->>'actorId')::uuid<>private.actor_id() then raise exception 'FORBIDDEN' using errcode='42501';end if;
 perform private.lock_workflow_candidate(org,cand);
 -- Serialize same organization/key as well as same candidate, including malicious cross-candidate reuse.
 perform pg_advisory_xact_lock(hashtextextended('archive:'||org::text||op::text,0));
 select * into old from public.archive_operations where organization_id=org and operation_id=op;
 if found then
  if old.actor_id<>private.actor_id() or old.request_hash<>e->>'requestHash' then raise exception 'KEY_PAYLOAD_MISMATCH';end if;
  return public.archive_operation_result(org,op);
 end if;
 r:=public.export_archive_source(org,doc);
 if r->>'candidateId'<>cand::text or r->>'kind'<>'resume' or r->>'rawJson' is distinct from f->'resume'->>'rawJson' or r->>'pdfSha256' is distinct from f->'resume'->>'pdfSha256' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if letter is not null then l:=public.export_archive_source(org,letter);if l->>'candidateId'<>cand::text or l->>'kind'<>'cover_letter' or l->>'text' is distinct from f->'coverLetter'->>'text' then raise exception 'FORBIDDEN' using errcode='42501';end if;end if;
 target:=(f->>'existingBidId')::uuid;
 if target is null then
  if private.candidate_team(org,cand) is null then raise exception 'FORBIDDEN' using errcode='42501';end if;
  snap:=public.archive_history_snapshot(org,cand,f->'context'->>'company');
  if (snap->>'truncated')::boolean or snap->>'token' is distinct from e->>'historyToken' then raise exception 'ARCHIVE_HISTORY_CHANGED' using errcode='40001';end if;
  if jsonb_array_length(ids)>1 then raise exception 'DUPLICATE_JOB';end if;
  if jsonb_array_length(ids)=1 then target:=(ids->>0)::uuid;end if;
 end if;
 if target is not null then
  job:=public.archive_bid_job(org,target,doc);if job is null or job->>'candidateId'<>cand::text then raise exception 'FORBIDDEN' using errcode='42501';end if;
 else
  team:=private.candidate_team(org,cand);
  result:=public.save_bid(org,null,0,jsonb_build_object('candidateId',cand,'teamId',team,'ownerId',private.actor_id(),'companyName',f->'context'->>'company','jobTitle',f->'context'->>'title','jobDescription',f->'context'->>'description','jobUrl',nullif(f->'context'->>'url',''),'externalId',nullif(f->'context'->>'externalId',''),'jobLocation',null,'priority','normal','followUpAt',null,'lastContactAt',null,'notes','','outcome','','resumeDocumentId',doc,'coverLetterDocumentId',letter),op,p_request);
  target:=(result->>'id')::uuid;
 end if;
 result:=jsonb_build_object('operationId',op,'bidId',target,'reusedBid',result is null,'resumeDocumentId',doc,'resumeVersionId',r->>'sourceId','coverLetterVersionId',l->>'sourceId','createdAt',now());
 insert into public.archive_operations(organization_id,operation_id,actor_id,candidate_id,bid_id,request_hash,frozen_input,result) values(org,op,private.actor_id(),cand,target,e->>'requestHash',f,result);
 perform private.audit(org,'archive.package_saved',target,p_request,null,jsonb_build_object('operationId',op,'submissionRecorded',false));
 return result;
end $$;
alter function public.save_archive_package(text,text,text,uuid) owner to app_command;
revoke create on schema public from app_command;
revoke all on function public.save_archive_package(text,text,text,uuid) from public,anon;
grant execute on function public.save_archive_package(text,text,text,uuid) to authenticated;
commit;
