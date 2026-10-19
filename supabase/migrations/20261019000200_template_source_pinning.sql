begin;
alter table public.prompt_assemblies add column template_snapshot jsonb;
alter table public.resume_versions add column template_snapshot jsonb;
create function private.freeze_render_template() returns trigger language plpgsql set search_path='' as $$
declare t public.template_versions;
begin
 select * into t from public.template_versions where id=new.template_version_id;
 if not found then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 new.template_snapshot:=jsonb_build_object('id',t.id,'name',t.name,'version',t.version,'layout',t.layout,'layoutHash',coalesce(t.layout_hash,encode(sha256(convert_to(t.layout::text,'UTF8')),'hex')),'assetHashes',t.asset_hashes,'rendererVersion',t.renderer_version);
 return new;
end $$;
revoke all on function private.freeze_render_template() from public;
create trigger freeze_template before insert on public.prompt_assemblies for each row execute function private.freeze_render_template();
create trigger freeze_template before insert on public.resume_versions for each row execute function private.freeze_render_template();

create or replace function public.save_resume_source(p_org uuid,p_candidate uuid,p_payload jsonb,p_request uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.candidates; a public.prompt_assemblies; old public.resume_versions; v public.resume_versions;
 v_hash text; v_content jsonb; v_reviewed boolean; v_op uuid:=(p_payload->>'operationId')::uuid;
begin
 if not private.reads_candidate(p_org,p_candidate) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if v_op is null or octet_length(p_payload::text)>2097152 or p_payload->>'schemaVersion'<>'1' or jsonb_typeof(p_payload->'rawJson')<>'string' then raise exception 'INVALID_SOURCE' using errcode='22023'; end if;
 v_hash:=encode(sha256(convert_to('resume.source.v1:'||p_payload::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||v_op::text,0));
 select * into old from public.resume_versions where organization_id=p_org and operation_id=v_op;
 if found then
  if old.created_by<>private.actor_id() or old.candidate_id<>p_candidate or old.request_hash<>v_hash then raise exception 'KEY_PAYLOAD_MISMATCH' using errcode='22023'; end if;
  return jsonb_build_object('id',old.id,'replayed',true);
 end if;
 select * into c from public.candidates where organization_id=p_org and id=p_candidate for update;
 if not found or not private.edits_candidate(p_org,p_candidate) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select * into a from public.prompt_assemblies where organization_id=p_org and candidate_id=p_candidate and id=(p_payload->>'assemblyId')::uuid;
 if not found then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if a.profile_revision<>c.row_version then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
 v_content:=private.resume_structure(p_payload->>'rawJson');
 v_reviewed:=private.resume_reviewed(v_content,a.candidate_snapshot,p_payload->'review');
 if private.resume_norm(a.job->>'company')<>'' and private.resume_norm(a.job->>'company')<>private.resume_norm(v_content->>'company') then v_reviewed:=false; end if;
 if p_payload->'render'<>'null'::jsonb and (jsonb_typeof(p_payload->'render')<>'object' or p_payload->'render'->>'sha256' !~ '^[0-9a-f]{64}$' or p_payload->'render'->>'rendererVersion' is distinct from (select renderer_version from public.template_versions where id=a.template_version_id) or (p_payload->'render'->>'pageCount')::integer not between 1 and 100 or (p_payload->'render'->>'renderedAt') is null) then raise exception 'INVALID_RENDER_RECEIPT' using errcode='22023'; end if;
 insert into public.resume_versions(organization_id,candidate_id,version,operation_id,request_hash,assembly_id,schema_version,raw_json,parsed_content,candidate_snapshot,provenance,reviewed,template_version_id,renderer_version,render_receipt,created_by)
 values(p_org,p_candidate,coalesce((select max(version)+1 from public.resume_versions where organization_id=p_org and candidate_id=p_candidate),1),v_op,v_hash,a.id,1,p_payload->>'rawJson',v_content,a.candidate_snapshot,
  jsonb_build_object('mapping',p_payload->'review','reviewerId',case when v_reviewed then private.actor_id() else null end,'reviewedAt',case when v_reviewed then now() else null end,'reviewed',v_reviewed),v_reviewed,a.template_version_id,(select renderer_version from public.template_versions where id=a.template_version_id),nullif(p_payload->'render','null'::jsonb),private.actor_id()) returning * into v;
 perform private.audit(p_org,'resume.source_saved',p_candidate,p_request,c.owning_team_id,jsonb_build_object('resumeVersionId',v.id,'reviewed',v_reviewed));
 return jsonb_build_object('id',v.id,'replayed',false);
end $$;

commit;
