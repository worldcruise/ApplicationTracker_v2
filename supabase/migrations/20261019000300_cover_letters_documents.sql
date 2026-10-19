begin;
create extension if not exists pgcrypto with schema extensions;
create role app_document_exporter nologin nobypassrls noinherit;
create role app_render_verifier nologin nobypassrls noinherit;
grant app_document_exporter,app_render_verifier to postgres;
grant usage on schema public,private to app_document_exporter,app_render_verifier;
grant usage on schema extensions to app_render_verifier;
grant execute on function private.actor_id(),private.actor_role() to app_document_exporter,app_render_verifier;
grant execute on function private.reads_candidate(uuid,uuid) to app_document_exporter;

create table private.document_render_keys(id text primary key check(id ~ '^[a-zA-Z0-9_-]{1,60}$'),secret bytea not null check(octet_length(secret)=32),created_at timestamptz not null default now());
alter table private.document_render_keys enable row level security; alter table private.document_render_keys force row level security;
revoke all on private.document_render_keys from public,anon,authenticated;
grant insert on private.document_render_keys to app_command; grant select on private.document_render_keys to app_render_verifier;
create policy key_reader on private.document_render_keys for select to app_render_verifier using(true);
create policy key_bootstrap on private.document_render_keys for insert to app_command with check(private.actor_role()='service_role');
grant create on schema private to app_render_verifier;
create function private.valid_render_signature(p_id text,p_message text,p_signature text) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select encode(extensions.hmac(convert_to(p_message,'UTF8'),secret,'sha256'),'hex')=p_signature from private.document_render_keys where id=p_id),false)
$$;
alter function private.valid_render_signature(text,text,text) owner to app_render_verifier;
revoke create on schema private from app_render_verifier;
revoke all on function private.valid_render_signature(text,text,text) from public;
grant execute on function private.valid_render_signature(text,text,text) to app_command;
create function public.configure_document_render_key(p_id text,p_key_hex text) returns void language plpgsql security definer set search_path='' as $$
begin
 if private.actor_role()<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_key_hex is null or p_key_hex !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_RENDER_KEY' using errcode='22023'; end if;
 insert into private.document_render_keys(id,secret) values(p_id,decode(p_key_hex,'hex')) on conflict do nothing;
 if not private.valid_render_signature(p_id,'configure:'||p_id,encode(extensions.hmac(convert_to('configure:'||p_id,'UTF8'),decode(p_key_hex,'hex'),'sha256'),'hex')) then raise exception 'RENDER_KEY_ID_ALREADY_USED' using errcode='22023'; end if;
end $$;
grant usage on schema extensions to app_command;

create table public.cover_letter_versions(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,candidate_id uuid not null,bid_id uuid,
 version integer not null,operation_id uuid not null,request_hash text not null,body_text text not null check(octet_length(body_text)<=204800),schema_version integer not null default 1 check(schema_version=1),
 profile_revision_id uuid not null,candidate_snapshot jsonb not null,template_version_id uuid not null references public.template_versions(id),template_snapshot jsonb,renderer_version text not null,
 provenance jsonb not null,reviewed boolean not null,render_receipt jsonb,created_by uuid not null references public.users(id),created_at timestamptz not null default now(),
 unique(organization_id,operation_id),unique(candidate_id,version),unique(organization_id,candidate_id,id),
 foreign key(organization_id,candidate_id,profile_revision_id) references public.candidate_profile_revisions(organization_id,candidate_id,id),
 foreign key(organization_id,candidate_id) references public.candidates(organization_id,id),foreign key(organization_id,bid_id) references public.bids(organization_id,id)
);
alter table public.cover_letter_versions enable row level security; alter table public.cover_letter_versions force row level security;
revoke all on public.cover_letter_versions from public,anon,authenticated;
grant select on public.cover_letter_versions to authenticated,app_command; grant insert on public.cover_letter_versions to app_command;
create policy visible on public.cover_letter_versions for select to authenticated,app_command using(private.reads_candidate(organization_id,candidate_id));
create policy command_insert on public.cover_letter_versions for insert to app_command with check(private.edits_candidate(organization_id,candidate_id) and created_by=private.actor_id());
create trigger immutable before update or delete on public.cover_letter_versions for each row execute function private.immutable_revision();
create trigger freeze_template before insert on public.cover_letter_versions for each row execute function private.freeze_render_template();
create function public.save_cover_letter(p_org uuid,p_candidate uuid,p_payload jsonb,p_request uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.candidates; r public.candidate_profile_revisions; t public.template_versions; old public.cover_letter_versions; v_id uuid; v_op uuid:=(p_payload->>'operationId')::uuid;
 v_hash text:=encode(sha256(convert_to('cover-letter.v1:'||p_payload::text,'UTF8')),'hex'); v_reviewed boolean; v_content jsonb;
begin
 if not private.reads_candidate(p_org,p_candidate) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if v_op is null or jsonb_typeof(p_payload->'bodyText') is distinct from 'string' or octet_length(p_payload->>'bodyText')>204800 or p_payload->>'schemaVersion' is distinct from '1' then raise exception 'INVALID_LETTER' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||v_op::text,0));
 select * into old from public.cover_letter_versions where organization_id=p_org and operation_id=v_op;
 if found then if old.created_by<>private.actor_id() or old.candidate_id<>p_candidate or old.request_hash<>v_hash then raise exception 'KEY_PAYLOAD_MISMATCH' using errcode='22023'; end if; return old.id; end if;
 select * into c from public.candidates where organization_id=p_org and id=p_candidate for update;
 if not found or not private.edits_candidate(p_org,p_candidate) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if c.row_version is distinct from (p_payload->>'profileRevision')::bigint then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
 select * into r from public.candidate_profile_revisions where organization_id=p_org and candidate_id=p_candidate and revision_number=c.row_version;
 select * into t from public.template_versions where id=(p_payload->>'templateVersionId')::uuid; if not found then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_payload->>'bidId' is not null and not exists(select 1 from public.bids where organization_id=p_org and id=(p_payload->>'bidId')::uuid and candidate_id=p_candidate) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 v_content:=private.resume_structure(jsonb_build_object('company','','title','','summary',p_payload->>'bodyText','skills','[]'::jsonb,'experience','[]'::jsonb,'education','[]'::jsonb)::text);
 v_reviewed:=private.resume_reviewed(v_content,r.verified_snapshot,p_payload->'review');
 if p_payload->'render' is distinct from 'null'::jsonb and (jsonb_typeof(p_payload->'render') is distinct from 'object' or p_payload->'render'->>'sha256' is null or p_payload->'render'->>'sha256' !~ '^[0-9a-f]{64}$' or p_payload->'render'->>'rendererVersion' is distinct from 'template-engine/2.0.0' or coalesce((p_payload->'render'->>'pageCount')::integer,0) not between 1 and 100 or p_payload->'render'->>'renderedAt' is null) then raise exception 'INVALID_RENDER_RECEIPT' using errcode='22023'; end if;
 insert into public.cover_letter_versions(organization_id,candidate_id,bid_id,version,operation_id,request_hash,body_text,profile_revision_id,candidate_snapshot,template_version_id,renderer_version,provenance,reviewed,render_receipt,created_by)
 values(p_org,p_candidate,(p_payload->>'bidId')::uuid,coalesce((select max(version)+1 from public.cover_letter_versions where candidate_id=p_candidate),1),v_op,v_hash,p_payload->>'bodyText',r.id,r.verified_snapshot,t.id,'template-engine/2.0.0',jsonb_build_object('mapping',p_payload->'review','reviewed',v_reviewed,'reviewerId',case when v_reviewed then private.actor_id() else null end,'reviewedAt',case when v_reviewed then now() else null end),v_reviewed,nullif(p_payload->'render','null'::jsonb),private.actor_id()) returning id into v_id;
 perform private.audit(p_org,'cover_letter.version_saved',p_candidate,p_request,c.owning_team_id,jsonb_build_object('versionId',v_id)); return v_id;
end $$;

create table public.documents(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,candidate_id uuid not null,kind text not null check(kind in ('resume','cover_letter')),resume_version_id uuid,cover_letter_version_id uuid,
 filename text not null check(length(filename) between 1 and 220 and filename !~ '[/\\[:cntrl:]]'),pdf_sha256 text not null check(pdf_sha256 ~ '^[0-9a-f]{64}$'),byte_size integer not null check(byte_size between 1 and 16777216),page_count integer not null check(page_count between 1 and 100),
 schema_version integer not null,template_version_id uuid not null references public.template_versions(id),renderer_version text not null,asset_hashes jsonb not null,reviewed boolean not null,created_by uuid not null references public.users(id),created_at timestamptz not null default now(),
 check((kind='resume' and resume_version_id is not null and cover_letter_version_id is null) or (kind='cover_letter' and cover_letter_version_id is not null and resume_version_id is null)),
 unique(organization_id,candidate_id,id),unique(resume_version_id,pdf_sha256),unique(cover_letter_version_id,pdf_sha256),
 foreign key(organization_id,candidate_id,resume_version_id) references public.resume_versions(organization_id,candidate_id,id),foreign key(organization_id,candidate_id,cover_letter_version_id) references public.cover_letter_versions(organization_id,candidate_id,id)
);
create table public.document_blobs(document_id uuid primary key references public.documents(id),pdf_bytes bytea not null check(octet_length(pdf_bytes)<=16777216));
create table public.bid_document_links(organization_id uuid not null,candidate_id uuid not null,bid_id uuid not null,document_id uuid not null,created_by uuid not null references public.users(id),created_at timestamptz not null default now(),
 primary key(bid_id,document_id),foreign key(organization_id,bid_id) references public.bids(organization_id,id),foreign key(organization_id,candidate_id,document_id) references public.documents(organization_id,candidate_id,id));
alter table public.documents enable row level security; alter table public.documents force row level security;
alter table public.document_blobs enable row level security; alter table public.document_blobs force row level security;
alter table public.bid_document_links enable row level security; alter table public.bid_document_links force row level security;
revoke all on public.documents,public.document_blobs,public.bid_document_links from public,anon,authenticated;
grant select on public.documents,public.bid_document_links to authenticated,app_command,app_permission_reader,app_document_exporter;
grant insert on public.documents,public.document_blobs,public.bid_document_links to app_command;
grant select on public.document_blobs to app_document_exporter;
create policy scope_reader on public.documents for select to app_permission_reader using(true);
create policy scope_reader on public.bid_document_links for select to app_permission_reader using(true);
grant create on schema private to app_permission_reader;
create function private.document_access(p_org uuid,p_document uuid,p_export boolean) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.documents d where d.organization_id=p_org and d.id=p_document and (private.reads_candidate(p_org,d.candidate_id) or (d.reviewed and exists(
 select 1 from public.bid_document_links l where l.organization_id=p_org and l.document_id=d.id and (
 exists(select 1 from private.bidder_grants(p_org,d.candidate_id,l.bid_id,'document.export')) or (not p_export and exists(select 1 from private.bidder_grants(p_org,d.candidate_id,l.bid_id,'document.read'))))))))
$$;
alter function private.document_access(uuid,uuid,boolean) owner to app_permission_reader; revoke create on schema private from app_permission_reader;
revoke all on function private.document_access(uuid,uuid,boolean) from public; grant execute on function private.document_access(uuid,uuid,boolean) to authenticated,app_command,app_document_exporter;
create policy visible on public.documents for select to authenticated,app_command,app_document_exporter using(private.document_access(organization_id,id,false) or (created_by=private.actor_id() and private.reads_candidate(organization_id,candidate_id)));
create policy command_insert on public.documents for insert to app_command with check(private.reads_candidate(organization_id,candidate_id) and created_by=private.actor_id());
create policy blob_insert on public.document_blobs for insert to app_command with check(exists(select 1 from public.documents d where d.id=document_id and private.reads_candidate(d.organization_id,d.candidate_id)));
create policy export_blob on public.document_blobs for select to app_document_exporter using(exists(select 1 from public.documents d where d.id=document_id and private.document_access(d.organization_id,d.id,true)));
create policy visible on public.bid_document_links for select to authenticated,app_command,app_document_exporter using(private.document_access(organization_id,document_id,false));
create policy command_insert on public.bid_document_links for insert to app_command with check(private.manages_team(organization_id,(select team_id from public.bids where id=bid_id and organization_id=bid_document_links.organization_id)) and created_by=private.actor_id());
create trigger immutable before update or delete on public.documents for each row execute function private.immutable_revision();
create trigger immutable before update or delete on public.document_blobs for each row execute function private.immutable_revision();
create trigger immutable before update or delete on public.bid_document_links for each row execute function private.immutable_revision();
grant insert on public.audit_logs to app_document_exporter;
grant execute on function private.audit(uuid,text,uuid,uuid,uuid,jsonb) to app_document_exporter;
create policy document_export_audit on public.audit_logs for insert to app_document_exporter with check(action='document.exported' and actor_id=private.actor_id() and private.document_access(organization_id,subject_id,true));

create function public.store_rendered_document(p_org uuid,p_kind text,p_source uuid,p_base64 text,p_filename text,p_key_id text,p_signature text,p_request uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare v_candidate uuid; v_hash text; v_bytes bytea:=decode(p_base64,'base64'); v_template uuid; v_renderer text; v_pages integer; v_reviewed boolean; v_schema integer; v_assets jsonb; v_receipt jsonb; v_id uuid;
begin
 if octet_length(v_bytes) not between 1 and 16777216 or encode(substring(v_bytes from 1 for 5),'escape')<>'%PDF-' then raise exception 'INVALID_PDF' using errcode='22023'; end if;
 if p_kind='resume' then
  select candidate_id,template_version_id,renderer_version,schema_version,reviewed,render_receipt,template_snapshot->'assetHashes' into v_candidate,v_template,v_renderer,v_schema,v_reviewed,v_receipt,v_assets from public.resume_versions where organization_id=p_org and id=p_source;
 elsif p_kind='cover_letter' then
  select candidate_id,template_version_id,renderer_version,schema_version,reviewed,render_receipt,template_snapshot->'assetHashes' into v_candidate,v_template,v_renderer,v_schema,v_reviewed,v_receipt,v_assets from public.cover_letter_versions where organization_id=p_org and id=p_source;
 else raise exception 'INVALID_DOCUMENT_KIND' using errcode='22023'; end if;
 if v_candidate is null or not private.reads_candidate(p_org,v_candidate) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 v_hash:=encode(sha256(v_bytes),'hex'); v_pages:=(v_receipt->>'pageCount')::integer;
 if v_receipt is null or v_hash is distinct from v_receipt->>'sha256' or v_renderer is distinct from v_receipt->>'rendererVersion' then raise exception 'PDF_HASH_MISMATCH' using errcode='22023'; end if;
 if not private.valid_render_signature(p_key_id,concat_ws('|','document.v1',p_org,p_kind,p_source,v_hash,v_template,v_renderer,v_pages,p_filename),p_signature) then raise exception 'RENDER_ATTESTATION_REQUIRED' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_kind||p_source::text||v_hash,0));
 select id into v_id from public.documents where organization_id=p_org and ((p_kind='resume' and resume_version_id=p_source) or (p_kind='cover_letter' and cover_letter_version_id=p_source)) and pdf_sha256=v_hash;
 if found then return v_id; end if;
 if v_assets is null then select asset_hashes into v_assets from public.template_versions where id=v_template; end if;
 insert into public.documents(organization_id,candidate_id,kind,resume_version_id,cover_letter_version_id,filename,pdf_sha256,byte_size,page_count,schema_version,template_version_id,renderer_version,asset_hashes,reviewed,created_by)
 values(p_org,v_candidate,p_kind,case when p_kind='resume' then p_source else null end,case when p_kind='cover_letter' then p_source else null end,p_filename,v_hash,octet_length(v_bytes),v_pages,v_schema,v_template,v_renderer,v_assets,v_reviewed,private.actor_id()) returning id into v_id;
 insert into public.document_blobs(document_id,pdf_bytes) values(v_id,v_bytes);
 perform private.audit(p_org,'document.bytes_stored',v_candidate,p_request,null,jsonb_build_object('documentId',v_id,'kind',p_kind)); return v_id;
end $$;
create function public.link_document_to_bid(p_org uuid,p_document uuid,p_bid uuid,p_request uuid) returns void language plpgsql security definer set search_path='' as $$
declare d public.documents; b public.bids;
begin
 select * into b from public.bids where organization_id=p_org and id=p_bid;
 if not found or not private.manages_team(p_org,b.team_id) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select * into d from public.documents where organization_id=p_org and id=p_document;
 if not found or d.candidate_id<>b.candidate_id or not d.reviewed then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 insert into public.bid_document_links(organization_id,candidate_id,bid_id,document_id,created_by) values(p_org,b.candidate_id,p_bid,d.id,private.actor_id()) on conflict do nothing;
 perform private.audit(p_org,'document.linked_to_bid',b.candidate_id,p_request,b.team_id,jsonb_build_object('documentId',d.id,'bidId',b.id));
end $$;
grant create on schema public to app_document_exporter;
create function public.export_frozen_document(p_org uuid,p_document uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.documents; v_bytes bytea;
begin
 if not private.document_access(p_org,p_document,true) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select * into d from public.documents where organization_id=p_org and id=p_document;
 select pdf_bytes into v_bytes from public.document_blobs where document_id=d.id;
 if v_bytes is null or encode(sha256(v_bytes),'hex')<>d.pdf_sha256 then raise exception 'PDF_HASH_MISMATCH' using errcode='22023'; end if;
 perform private.audit(p_org,'document.exported',d.id,gen_random_uuid(),null,jsonb_build_object('documentId',d.id));
 return jsonb_build_object('id',d.id,'filename',d.filename,'sha256',d.pdf_sha256,'pageCount',d.page_count,'rendererVersion',d.renderer_version,'schemaVersion',d.schema_version,'templateVersionId',d.template_version_id,'assetHashes',d.asset_hashes,'base64',encode(v_bytes,'base64'));
end $$;
alter function public.export_frozen_document(uuid,uuid) owner to app_document_exporter;
revoke create on schema public from app_document_exporter;
revoke all on function public.export_frozen_document(uuid,uuid) from public,anon; grant execute on function public.export_frozen_document(uuid,uuid) to authenticated;
grant create on schema public to app_command;
alter function public.configure_document_render_key(text,text) owner to app_command;
alter function public.save_cover_letter(uuid,uuid,jsonb,uuid) owner to app_command;
alter function public.store_rendered_document(uuid,text,uuid,text,text,text,text,uuid) owner to app_command;
alter function public.link_document_to_bid(uuid,uuid,uuid,uuid) owner to app_command;
revoke create on schema public from app_command;
revoke all on function public.configure_document_render_key(text,text) from public,anon,authenticated; grant execute on function public.configure_document_render_key(text,text) to service_role;
revoke all on function public.save_cover_letter(uuid,uuid,jsonb,uuid),public.store_rendered_document(uuid,text,uuid,text,text,text,text,uuid),public.link_document_to_bid(uuid,uuid,uuid,uuid) from public,anon;
grant execute on function public.save_cover_letter(uuid,uuid,jsonb,uuid),public.store_rendered_document(uuid,text,uuid,text,text,text,text,uuid),public.link_document_to_bid(uuid,uuid,uuid,uuid) to authenticated;
commit;
