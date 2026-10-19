begin;
create function private.resume_structure(p_raw text) returns jsonb language plpgsql immutable set search_path='' as $$
declare v jsonb; r jsonb; c record;
begin
 if p_raw is null or octet_length(p_raw)>1048576 then raise exception 'SCHEMA_INVALID' using errcode='22023'; end if;
 v:=p_raw::jsonb;
 if exists(with recursive walk(value,depth) as (
  select v,0 union all select child.value,w.depth+1 from walk w cross join lateral (
   select value from jsonb_each(case when jsonb_typeof(w.value)='object' then w.value else '{}'::jsonb end)
   union all select value from jsonb_array_elements(case when jsonb_typeof(w.value)='array' then w.value else '[]'::jsonb end)
  ) child where w.depth<=32)
  select 1 from walk where depth>32 or jsonb_array_length(case when jsonb_typeof(value)='array' then value else '[]'::jsonb end)>100
   or (jsonb_typeof(value)='object' and (value ? '__proto__' or value ? 'prototype' or value ? 'constructor')))
 then raise exception 'SCHEMA_INVALID' using errcode='22023'; end if;
 if jsonb_typeof(v)<>'object' or not v ?& array['company','title','summary','skills','experience','education'] then raise exception 'SCHEMA_INVALID' using errcode='22023'; end if;
 foreach r in array array[v->'company',v->'title',v->'summary'] loop if jsonb_typeof(r)<>'string' then raise exception 'SCHEMA_INVALID' using errcode='22023'; end if; end loop;
 foreach r in array array[v->'skills',v->'experience',v->'education'] loop if jsonb_typeof(r)<>'array' then raise exception 'SCHEMA_INVALID' using errcode='22023'; end if; end loop;
 for r in select value from jsonb_array_elements(v->'skills') loop
  if jsonb_typeof(r)<>'object' or r='{}' then raise exception 'SCHEMA_INVALID' using errcode='22023'; end if;
  for c in select * from jsonb_each(r) loop
   if jsonb_typeof(c.value)<>'array' then raise exception 'SCHEMA_INVALID' using errcode='22023'; end if;
   if exists(select 1 from jsonb_array_elements(c.value) x where jsonb_typeof(x)<>'string') then raise exception 'SCHEMA_INVALID' using errcode='22023'; end if;
  end loop;
 end loop;
 for r in select value from jsonb_array_elements(v->'experience') loop
  if jsonb_typeof(r)<>'object' or not r ?& array['title','company','sentences'] or jsonb_typeof(r->'title')<>'string' or jsonb_typeof(r->'company')<>'string' or jsonb_typeof(r->'sentences')<>'array' then raise exception 'SCHEMA_INVALID' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(r->'sentences') x where jsonb_typeof(x)<>'string') then raise exception 'SCHEMA_INVALID' using errcode='22023'; end if;
 end loop;
 for r in select value from jsonb_array_elements(v->'education') loop
  if jsonb_typeof(r)<>'object' or not r ? 'degree' or jsonb_typeof(r->'degree')<>'string' then raise exception 'SCHEMA_INVALID' using errcode='22023'; end if;
 end loop;
 return jsonb_build_object('company',v->'company','title',v->'title','summary',v->'summary','skills',v->'skills',
  'experience',coalesce((select jsonb_agg(jsonb_build_object('title',x->'title','company',x->'company','sentences',x->'sentences') order by n) from jsonb_array_elements(v->'experience') with ordinality t(x,n)),'[]'::jsonb),
  'education',coalesce((select jsonb_agg(jsonb_build_object('degree',x->'degree') order by n) from jsonb_array_elements(v->'education') with ordinality t(x,n)),'[]'::jsonb));
end $$;

create function private.resume_evidence(p_snapshot jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare v jsonb:='[]'; r jsonb; t record; txt text;
begin
 if nullif(p_snapshot->>'professionalSummary','') is not null then v:=v||jsonb_build_array(jsonb_build_object('id','profile:summary','text',p_snapshot->>'professionalSummary')); end if;
 for r in select value from jsonb_array_elements(p_snapshot->'experiences') loop
  txt:=concat_ws(' | ',r->>'company',r->>'officialTitle',r->>'approvedDisplayTitle',r->>'startDate',r->>'endDate',r->>'location');
  v:=v||jsonb_build_array(jsonb_build_object('id','work:'||(r->>'id')||':facts','text',txt));
  for t in select value #>> '{}' as text,(n-1)::text as n from jsonb_array_elements(r->'sourceBullets') with ordinality a(value,n) loop
   v:=v||jsonb_build_array(jsonb_build_object('id','work:'||(r->>'id')||':bullet:'||t.n,'text',t.text)); end loop;
  for t in select value #>> '{}' as text,(n-1)::text as n from jsonb_array_elements(r->'achievements') with ordinality a(value,n) loop
   v:=v||jsonb_build_array(jsonb_build_object('id','work:'||(r->>'id')||':achievement:'||t.n,'text',t.text)); end loop;
 end loop;
 for r in select value from jsonb_array_elements(p_snapshot->'educations') loop
  v:=v||jsonb_build_array(jsonb_build_object('id','education:'||(r->>'id'),'text',concat_ws(' | ',r->>'degree',r->>'fieldOfStudy',r->>'institution',r->>'startDate',r->>'endDate'))); end loop;
 for r in select value from jsonb_array_elements(p_snapshot->'certifications') where value->>'verificationStatus'='verified' loop
  v:=v||jsonb_build_array(jsonb_build_object('id','certification:'||(r->>'id'),'text',concat_ws(' | ',r->>'name',r->>'issuer','verified',r->>'issueDate',r->>'expiryDate'))); end loop;
 return v;
end $$;

create function private.resume_reviewed(p_content jsonb,p_snapshot jsonb,p_map jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare v_evidence jsonb:=private.resume_evidence(p_snapshot); v_claims jsonb:='[]'; r record; w jsonb; c record; s record;
 v_id text; v_seen text[]:='{}'; v_allowed jsonb; v_proof text; v_auto boolean; v_source jsonb; token text; v_selected jsonb;
begin
 if jsonb_typeof(p_map) is distinct from 'object' or not p_map ?& array['experienceIds','educationIds','claims'] or jsonb_typeof(p_map->'experienceIds') is distinct from 'array' or jsonb_typeof(p_map->'educationIds') is distinct from 'array' or jsonb_typeof(p_map->'claims') is distinct from 'object' then raise exception 'INVALID_REVIEW' using errcode='22023'; end if;
 if jsonb_array_length(p_map->'experienceIds')<>jsonb_array_length(p_content->'experience') or jsonb_array_length(p_map->'educationIds')<>jsonb_array_length(p_content->'education') then return false; end if;
 if p_snapshot->>'status'<>'ready' then return false; end if;
 v_claims:=jsonb_build_array(jsonb_build_object('path','/summary','text',p_content->>'summary','work',null));
 for r in select value,n-1 as i from jsonb_array_elements(p_content->'skills') with ordinality a(value,n) loop
  for c in select * from jsonb_each(r.value) loop
   for s in select value #>> '{}' as text,n-1 as i from jsonb_array_elements(c.value) with ordinality a(value,n) loop
    v_claims:=v_claims||jsonb_build_array(jsonb_build_object('path','/skills/'||r.i||'/'||replace(replace(c.key,'~','~0'),'/','~1')||'/'||s.i,'text',s.text,'work',null));
   end loop;
  end loop;
 end loop;
 for r in select value,n-1 as i from jsonb_array_elements(p_content->'experience') with ordinality a(value,n) loop
  v_id:=p_map->'experienceIds'->>r.i; select value into w from jsonb_array_elements(p_snapshot->'experiences') where value->>'id'=v_id;
  if w is null or v_id=any(v_seen) then return false; end if; v_seen:=array_append(v_seen,v_id);
  if private.resume_norm(r.value->>'company')='' or private.resume_norm(r.value->>'company')<>private.resume_norm(w->>'company') then return false; end if;
  if private.resume_norm(r.value->>'title')='' or not (private.resume_norm(r.value->>'title')=private.resume_norm(w->>'officialTitle') or (w->>'titlePolicy'='tailorable' and private.resume_norm(r.value->>'title')=private.resume_norm(w->>'approvedDisplayTitle'))) then return false; end if;
  for s in select value #>> '{}' as text,n-1 as i from jsonb_array_elements(r.value->'sentences') with ordinality a(value,n) loop
   v_claims:=v_claims||jsonb_build_array(jsonb_build_object('path','/experience/'||r.i||'/sentences/'||s.i,'text',s.text,'work',v_id)); end loop;
 end loop;
 v_seen:='{}';
 for r in select value,n-1 as i from jsonb_array_elements(p_content->'education') with ordinality a(value,n) loop
  v_id:=p_map->'educationIds'->>r.i; select value into w from jsonb_array_elements(p_snapshot->'educations') where value->>'id'=v_id;
  if w is null or v_id=any(v_seen) or private.resume_norm(w->>'degree')='' then return false; end if; v_seen:=array_append(v_seen,v_id);
  if private.resume_norm(r.value->>'degree') not in (private.resume_norm(w->>'degree'),private.resume_norm(concat_ws(' ',w->>'degree',w->>'fieldOfStudy')),private.resume_norm(concat_ws(' in ',w->>'degree',w->>'fieldOfStudy'))) then return false; end if;
 end loop;
 for r in select value from jsonb_array_elements(v_claims) where private.resume_norm(value->>'text')<>'' loop
  select coalesce(jsonb_agg(value),'[]'::jsonb) into v_allowed from jsonb_array_elements(v_evidence) where r.value->>'work' is null or starts_with(value->>'id','work:'||(r.value->>'work')||':');
  v_selected:=p_map->'claims'->(r.value->>'path');
  select exists(select 1 from jsonb_array_elements(v_allowed) where private.resume_norm(value->>'text')=private.resume_norm(r.value->>'text')) into v_auto;
  if not v_auto then
   if v_selected is null or v_selected->>'attested' is distinct from 'true' or jsonb_typeof(v_selected->'sources') is distinct from 'array' then return false; end if;
   if jsonb_array_length(v_selected->'sources')=0 or exists(select 1 from jsonb_array_elements_text(v_selected->'sources') id where not exists(select 1 from jsonb_array_elements(v_allowed) e where e->>'id'=id)) then return false; end if;
  end if;
  if v_selected is not null and exists(select 1 from jsonb_array_elements_text(v_selected->'sources') id where not exists(select 1 from jsonb_array_elements(v_allowed) e where e->>'id'=id)) then return false; end if;
  select coalesce(string_agg(value->>'text',' '),'') into v_proof from jsonb_array_elements(v_allowed) where
   (v_auto and private.resume_norm(value->>'text')=private.resume_norm(r.value->>'text')) or (not v_auto and (v_selected->'sources') ? (value->>'id'));
  for token in select m[1] from regexp_matches(r.value->>'text','[0-9]+(?:[.,][0-9]+)*(?:%|[+])?','g') m loop
   if not exists(select 1 from regexp_matches(v_proof,'[0-9]+(?:[.,][0-9]+)*(?:%|[+])?','g') m where m[1]=token) then return false; end if; end loop;
  for token in select m[1] from regexp_matches(private.resume_norm(r.value->>'text'),'\m(ph[.]?d[.]?|mba|msc|bsc|bachelor|master|doctorate|certified|certification)\M','g') m loop
   if strpos(private.resume_norm(v_proof),token)=0 then return false; end if; end loop;
 end loop;
 if exists(select 1 from jsonb_object_keys(p_map->'claims') k where not exists(select 1 from jsonb_array_elements(v_claims) c where c->>'path'=k and private.resume_norm(c->>'text')<>'')) then return false; end if;
 return true;
end $$;
revoke all on function private.resume_structure(text),private.resume_evidence(jsonb),private.resume_reviewed(jsonb,jsonb,jsonb) from public;
grant execute on function private.resume_structure(text),private.resume_evidence(jsonb),private.resume_reviewed(jsonb,jsonb,jsonb) to app_command;

create function public.save_resume_source(p_org uuid,p_candidate uuid,p_payload jsonb,p_request uuid) returns jsonb
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
 if p_payload->'render'<>'null'::jsonb and (jsonb_typeof(p_payload->'render')<>'object' or p_payload->'render'->>'sha256' !~ '^[0-9a-f]{64}$' or p_payload->'render'->>'rendererVersion'<>'ats-classic/1.0.0' or (p_payload->'render'->>'pageCount')::integer not between 1 and 100 or (p_payload->'render'->>'renderedAt') is null) then raise exception 'INVALID_RENDER_RECEIPT' using errcode='22023'; end if;
 insert into public.resume_versions(organization_id,candidate_id,version,operation_id,request_hash,assembly_id,schema_version,raw_json,parsed_content,candidate_snapshot,provenance,reviewed,template_version_id,renderer_version,render_receipt,created_by)
 values(p_org,p_candidate,coalesce((select max(version)+1 from public.resume_versions where organization_id=p_org and candidate_id=p_candidate),1),v_op,v_hash,a.id,1,p_payload->>'rawJson',v_content,a.candidate_snapshot,
  jsonb_build_object('mapping',p_payload->'review','reviewerId',case when v_reviewed then private.actor_id() else null end,'reviewedAt',case when v_reviewed then now() else null end,'reviewed',v_reviewed),v_reviewed,a.template_version_id,'ats-classic/1.0.0',nullif(p_payload->'render','null'::jsonb),private.actor_id()) returning * into v;
 perform private.audit(p_org,'resume.source_saved',p_candidate,p_request,c.owning_team_id,jsonb_build_object('resumeVersionId',v.id,'reviewed',v_reviewed));
 return jsonb_build_object('id',v.id,'replayed',false);
end $$;
grant create on schema public to app_command;
alter function public.save_resume_source(uuid,uuid,jsonb,uuid) owner to app_command;
revoke create on schema public from app_command;
revoke all on function public.save_resume_source(uuid,uuid,jsonb,uuid) from public,anon;
grant execute on function public.save_resume_source(uuid,uuid,jsonb,uuid) to authenticated;
commit;
