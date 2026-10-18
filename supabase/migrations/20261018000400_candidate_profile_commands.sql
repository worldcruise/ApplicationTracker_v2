begin;
create function private.empty_profile() returns jsonb language sql immutable set search_path='' as $$
 select '{"fullName":null,"email":null,"phone":null,"location":null,"seniorityPreference":null,"professionalSummary":null,"privateNotes":null,"status":"draft","links":[],"experiences":[],"educations":[],"certifications":[]}'::jsonb
$$;
create function private.check_profile_object(p_value jsonb,p_keys text[],p_text text[]) returns void language plpgsql set search_path='' as $$
declare v_key text;
begin
 if jsonb_typeof(p_value) is distinct from 'object' then raise exception 'INVALID_PROFILE_OBJECT' using errcode='22023'; end if;
 if exists(select 1 from jsonb_object_keys(p_value) k where not(k=any(p_keys))) then raise exception 'UNKNOWN_PROFILE_FIELD' using errcode='22023'; end if;
 foreach v_key in array p_text loop
  if jsonb_typeof(p_value->v_key) not in ('string','null') or length(p_value->>v_key)>8000 then raise exception 'INVALID_PROFILE_TEXT' using errcode='22023'; end if;
 end loop;
end $$;
create function private.check_profile(p_profile jsonb) returns void language plpgsql set search_path='' as $$
declare v_key text; v_row jsonb; v_seen uuid[];
begin
 if octet_length(p_profile::text)>262144 then raise exception 'PROFILE_TOO_LARGE' using errcode='22023'; end if;
 perform private.check_profile_object(p_profile,array['fullName','email','phone','location','seniorityPreference','professionalSummary','privateNotes','status','links','experiences','educations','certifications'],array['fullName','email','phone','location','seniorityPreference','professionalSummary','privateNotes','status']);
 if not (p_profile ?& array['fullName','email','phone','location','seniorityPreference','professionalSummary','privateNotes','status','links','experiences','educations','certifications']) or p_profile->>'status' is null or p_profile->>'status' not in ('draft','ready') then raise exception 'INVALID_PROFILE_FIELDS' using errcode='22023'; end if;
 foreach v_key in array array['links','experiences','educations','certifications'] loop
  if jsonb_typeof(p_profile->v_key) is distinct from 'array' or jsonb_array_length(p_profile->v_key)>100 then raise exception 'INVALID_PROFILE_RECORDS' using errcode='22023'; end if;
 end loop;
 v_seen:='{}'::uuid[];
 for v_row in select value from jsonb_array_elements(p_profile->'links') loop
  perform private.check_profile_object(v_row,array['id','type','url'],array['type','url']);
  if not (v_row ?& array['id','type','url']) or (v_row->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'INVALID_RECORD' using errcode='22023'; end if;
  if (v_row->>'id')::uuid=any(v_seen) then raise exception 'DUPLICATE_RECORD' using errcode='22023'; end if;
  v_seen:=array_append(v_seen,(v_row->>'id')::uuid);
  
  if v_row->>'type' is null or v_row->>'type' not in ('linkedin','github','website','portfolio','other') or
   v_row->>'url' is null then raise exception 'INVALID_LINK' using errcode='22023'; end if;
  
  
 end loop;
v_seen:='{}'::uuid[];
 for v_row in select value from jsonb_array_elements(p_profile->'experiences') loop
  perform private.check_profile_object(v_row,array['id','company','officialTitle','proposedDisplayTitle','titlePolicy','startDate','endDate','current','location','sourceBullets','achievements','preferredBulletCount'],array['company','officialTitle','proposedDisplayTitle','titlePolicy','startDate','endDate','location']);
  if not (v_row ?& array['id','company','officialTitle','proposedDisplayTitle','titlePolicy','startDate','endDate','current','location','sourceBullets','achievements','preferredBulletCount']) or (v_row->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'INVALID_RECORD' using errcode='22023'; end if;
  if (v_row->>'id')::uuid=any(v_seen) then raise exception 'DUPLICATE_RECORD' using errcode='22023'; end if;
  v_seen:=array_append(v_seen,(v_row->>'id')::uuid);
  if jsonb_typeof(v_row->'current')<>'boolean' or jsonb_typeof(v_row->'titlePolicy')<>'string' or
    v_row->>'titlePolicy' not in ('fixed','tailorable','omit') then raise exception 'INVALID_TITLE_POLICY' using errcode='22023'; end if;
  foreach v_key in array array['sourceBullets','achievements'] loop
   if jsonb_typeof(v_row->v_key)<>'array' or jsonb_array_length(v_row->v_key)>100 then raise exception 'INVALID_BULLETS' using errcode='22023'; end if;
   if exists(select 1 from jsonb_array_elements(v_row->v_key) e where jsonb_typeof(e)<>'string' or length(e#>>'{}')>4000) then raise exception 'INVALID_BULLETS' using errcode='22023'; end if;
  end loop;
  if v_row->'preferredBulletCount'<>'null'::jsonb and (jsonb_typeof(v_row->'preferredBulletCount')<>'number' or
    v_row->>'preferredBulletCount' !~ '^[0-9]+$' or (v_row->>'preferredBulletCount')::numeric not between 1 and 30) then
    raise exception 'INVALID_BULLET_COUNT' using errcode='22023'; end if;
  
  
  
 end loop;
v_seen:='{}'::uuid[];
 for v_row in select value from jsonb_array_elements(p_profile->'educations') loop
  perform private.check_profile_object(v_row,array['id','institution','degree','fieldOfStudy','startDate','endDate','displayPolicy'],array['institution','degree','fieldOfStudy','startDate','endDate','displayPolicy']);
  if not (v_row ?& array['id','institution','degree','fieldOfStudy','startDate','endDate','displayPolicy']) or (v_row->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'INVALID_RECORD' using errcode='22023'; end if;
  if (v_row->>'id')::uuid=any(v_seen) then raise exception 'DUPLICATE_RECORD' using errcode='22023'; end if;
  v_seen:=array_append(v_seen,(v_row->>'id')::uuid);
  
  
  if v_row->>'displayPolicy' is null or v_row->>'displayPolicy' not in ('fixed','tailorable','omit') then raise exception 'INVALID_DISPLAY_POLICY' using errcode='22023'; end if;
  
 end loop;
v_seen:='{}'::uuid[];
 for v_row in select value from jsonb_array_elements(p_profile->'certifications') loop
  perform private.check_profile_object(v_row,array['id','name','issuer','issueDate','expiryDate','verificationStatus','credentialId'],array['name','issuer','issueDate','expiryDate','verificationStatus','credentialId']);
  if not (v_row ?& array['id','name','issuer','issueDate','expiryDate','verificationStatus','credentialId']) or (v_row->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'INVALID_RECORD' using errcode='22023'; end if;
  if (v_row->>'id')::uuid=any(v_seen) then raise exception 'DUPLICATE_RECORD' using errcode='22023'; end if;
  v_seen:=array_append(v_seen,(v_row->>'id')::uuid);
  
  
  
  if v_row->>'verificationStatus' is null or v_row->>'verificationStatus' not in ('unverified','verified','expired') then raise exception 'INVALID_CERTIFICATION_STATUS' using errcode='22023'; end if;
 end loop;
end $$;
create function private.profile_json(p_org uuid,p_candidate uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',c.id,'organizationId',c.organization_id,'owningTeamId',c.owning_team_id,'ownerId',c.owner_id,
 'fullName',c.full_name,'email',c.email,'phone',c.phone,'location',c.location,'seniorityPreference',c.seniority_preference,
 'professionalSummary',c.professional_summary,'privateNotes',c.private_notes,'status',c.status,'rowVersion',c.row_version,
 'createdAt',c.created_at,'updatedAt',c.updated_at,
 'links',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'type',r.link_type,'url',r.url) order by r.sort_order,r.id) from public.candidate_links r where r.organization_id=c.organization_id and r.candidate_id=c.id and r.removed_at is null),'[]'::jsonb),
'experiences',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'company',r.company,'officialTitle',r.official_title,'proposedDisplayTitle',r.proposed_display_title,'titlePolicy',r.title_policy,'startDate',r.start_date,'endDate',r.end_date,'current',r.is_current,'location',r.location,'sourceBullets',r.source_bullets,'achievements',r.achievements,'preferredBulletCount',r.preferred_bullet_count,'approvedDisplayTitle',r.approved_display_title,'titleApprovedBy',r.title_approved_by,'titleApprovedAt',r.title_approved_at) order by r.sort_order,r.id) from public.work_experiences r where r.organization_id=c.organization_id and r.candidate_id=c.id and r.removed_at is null),'[]'::jsonb),
'educations',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'institution',r.institution,'degree',r.degree,'fieldOfStudy',r.field_of_study,'startDate',r.start_date,'endDate',r.end_date,'displayPolicy',r.display_policy) order by r.sort_order,r.id) from public.educations r where r.organization_id=c.organization_id and r.candidate_id=c.id and r.removed_at is null),'[]'::jsonb),
'certifications',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'issuer',r.issuer,'issueDate',r.issue_date,'expiryDate',r.expiry_date,'verificationStatus',r.verification_status,'credentialId',r.credential_id) order by r.sort_order,r.id) from public.certifications r where r.organization_id=c.organization_id and r.candidate_id=c.id and r.removed_at is null),'[]'::jsonb),
 'assignments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'userId',a.user_id,'teamId',a.team_id,'activeFrom',a.active_from,'endedAt',a.ended_at) order by a.active_from,a.id)
  from public.candidate_assignments a where a.organization_id=c.organization_id and a.candidate_id=c.id),'[]'::jsonb))
 from public.candidates c where c.organization_id=p_org and c.id=p_candidate
$$;
create function private.append_profile_revision(p_org uuid,p_candidate uuid,p_request uuid) returns void language sql security invoker set search_path='' as $$
 insert into public.candidate_profile_revisions(organization_id,candidate_id,revision_number,verified_snapshot,changed_by,request_id)
 select p_org,p_candidate,c.row_version,private.profile_json(p_org,p_candidate),private.actor_id(),p_request
 from public.candidates c where c.organization_id=p_org and c.id=p_candidate
$$;
create function private.write_profile_children(p_org uuid,p_candidate uuid,p_profile jsonb) returns void language plpgsql set search_path='' as $$
declare v_row jsonb; v_order integer;
begin
 update public.candidate_links set removed_at=now(),updated_at=now() where organization_id=p_org and candidate_id=p_candidate and removed_at is null;
 v_order:=0;
 for v_row in select value from jsonb_array_elements(p_profile->'links') loop
 insert into public.candidate_links(id,organization_id,candidate_id,sort_order,link_type,url)
 values((v_row->>'id')::uuid,p_org,p_candidate,v_order,nullif(btrim(v_row->>'type'),''),nullif(btrim(v_row->>'url'),''))
 on conflict(id) do update set sort_order=excluded.sort_order,removed_at=null,updated_at=now(),
 link_type=excluded.link_type,url=excluded.url
 
 where public.candidate_links.organization_id=p_org and public.candidate_links.candidate_id=p_candidate;
 if not found then raise exception 'FOREIGN_RECORD' using errcode='42501'; end if;
 v_order:=v_order+1;
 end loop;
update public.work_experiences set removed_at=now(),updated_at=now() where organization_id=p_org and candidate_id=p_candidate and removed_at is null;
 v_order:=0;
 for v_row in select value from jsonb_array_elements(p_profile->'experiences') loop
 insert into public.work_experiences(id,organization_id,candidate_id,sort_order,company,official_title,proposed_display_title,title_policy,start_date,end_date,is_current,location,source_bullets,achievements,preferred_bullet_count)
 values((v_row->>'id')::uuid,p_org,p_candidate,v_order,nullif(btrim(v_row->>'company'),''),nullif(btrim(v_row->>'officialTitle'),''),nullif(btrim(v_row->>'proposedDisplayTitle'),''),nullif(btrim(v_row->>'titlePolicy'),''),nullif(btrim(v_row->>'startDate'),''),nullif(btrim(v_row->>'endDate'),''),(v_row->>'current')::boolean,nullif(btrim(v_row->>'location'),''),array(select jsonb_array_elements_text(v_row->'sourceBullets')),array(select jsonb_array_elements_text(v_row->'achievements')),(v_row->>'preferredBulletCount')::integer)
 on conflict(id) do update set sort_order=excluded.sort_order,removed_at=null,updated_at=now(),
 company=excluded.company,official_title=excluded.official_title,proposed_display_title=excluded.proposed_display_title,title_policy=excluded.title_policy,start_date=excluded.start_date,end_date=excluded.end_date,is_current=excluded.is_current,location=excluded.location,source_bullets=excluded.source_bullets,achievements=excluded.achievements,preferred_bullet_count=excluded.preferred_bullet_count
 ,approved_display_title=case when public.work_experiences.official_title is not distinct from excluded.official_title
  and public.work_experiences.proposed_display_title is not distinct from excluded.proposed_display_title
  and public.work_experiences.title_policy=excluded.title_policy then public.work_experiences.approved_display_title else null end,
 title_approved_by=case when public.work_experiences.official_title is not distinct from excluded.official_title
  and public.work_experiences.proposed_display_title is not distinct from excluded.proposed_display_title
  and public.work_experiences.title_policy=excluded.title_policy then public.work_experiences.title_approved_by else null end,
 title_approved_at=case when public.work_experiences.official_title is not distinct from excluded.official_title
  and public.work_experiences.proposed_display_title is not distinct from excluded.proposed_display_title
  and public.work_experiences.title_policy=excluded.title_policy then public.work_experiences.title_approved_at else null end
 where public.work_experiences.organization_id=p_org and public.work_experiences.candidate_id=p_candidate;
 if not found then raise exception 'FOREIGN_RECORD' using errcode='42501'; end if;
 v_order:=v_order+1;
 end loop;
update public.educations set removed_at=now(),updated_at=now() where organization_id=p_org and candidate_id=p_candidate and removed_at is null;
 v_order:=0;
 for v_row in select value from jsonb_array_elements(p_profile->'educations') loop
 insert into public.educations(id,organization_id,candidate_id,sort_order,institution,degree,field_of_study,start_date,end_date,display_policy)
 values((v_row->>'id')::uuid,p_org,p_candidate,v_order,nullif(btrim(v_row->>'institution'),''),nullif(btrim(v_row->>'degree'),''),nullif(btrim(v_row->>'fieldOfStudy'),''),nullif(btrim(v_row->>'startDate'),''),nullif(btrim(v_row->>'endDate'),''),nullif(btrim(v_row->>'displayPolicy'),''))
 on conflict(id) do update set sort_order=excluded.sort_order,removed_at=null,updated_at=now(),
 institution=excluded.institution,degree=excluded.degree,field_of_study=excluded.field_of_study,start_date=excluded.start_date,end_date=excluded.end_date,display_policy=excluded.display_policy
 
 where public.educations.organization_id=p_org and public.educations.candidate_id=p_candidate;
 if not found then raise exception 'FOREIGN_RECORD' using errcode='42501'; end if;
 v_order:=v_order+1;
 end loop;
update public.certifications set removed_at=now(),updated_at=now() where organization_id=p_org and candidate_id=p_candidate and removed_at is null;
 v_order:=0;
 for v_row in select value from jsonb_array_elements(p_profile->'certifications') loop
 insert into public.certifications(id,organization_id,candidate_id,sort_order,name,issuer,issue_date,expiry_date,verification_status,credential_id)
 values((v_row->>'id')::uuid,p_org,p_candidate,v_order,nullif(btrim(v_row->>'name'),''),nullif(btrim(v_row->>'issuer'),''),nullif(btrim(v_row->>'issueDate'),''),nullif(btrim(v_row->>'expiryDate'),''),nullif(btrim(v_row->>'verificationStatus'),''),nullif(btrim(v_row->>'credentialId'),''))
 on conflict(id) do update set sort_order=excluded.sort_order,removed_at=null,updated_at=now(),
 name=excluded.name,issuer=excluded.issuer,issue_date=excluded.issue_date,expiry_date=excluded.expiry_date,verification_status=excluded.verification_status,credential_id=excluded.credential_id
 
 where public.certifications.organization_id=p_org and public.certifications.candidate_id=p_candidate;
 if not found then raise exception 'FOREIGN_RECORD' using errcode='42501'; end if;
 v_order:=v_order+1;
 end loop;
end $$;
revoke all on function private.empty_profile() from public;
grant execute on function private.empty_profile() to app_command;
revoke all on function private.check_profile_object(jsonb,text[],text[]) from public;
grant execute on function private.check_profile_object(jsonb,text[],text[]) to app_command;
revoke all on function private.check_profile(jsonb) from public;
grant execute on function private.check_profile(jsonb) to app_command;
revoke all on function private.profile_json(uuid,uuid) from public;
grant execute on function private.profile_json(uuid,uuid) to app_command;
revoke all on function private.append_profile_revision(uuid,uuid,uuid) from public;
grant execute on function private.append_profile_revision(uuid,uuid,uuid) to app_command;
revoke all on function private.write_profile_children(uuid,uuid,jsonb) from public;
grant execute on function private.write_profile_children(uuid,uuid,jsonb) to app_command;
grant execute on function private.profile_json(uuid,uuid) to authenticated;
create function public.get_candidate_profile(p_org uuid,p_candidate uuid) returns jsonb language sql stable security invoker set search_path='' as $$ select private.profile_json(p_org,p_candidate) $$;
revoke all on function public.get_candidate_profile(uuid,uuid) from public,anon;
grant execute on function public.get_candidate_profile(uuid,uuid) to authenticated;

create function public.create_candidate_profile(p_org uuid,p_team uuid,p_owner uuid,p_profile jsonb,p_request uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not private.manages_team(p_org,p_team) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_owner is not null and not private.eligible_assignee(p_org,p_team,p_owner,false) then raise exception 'INVALID_OWNER' using errcode='22023'; end if;
 perform private.check_profile(p_profile);
 insert into public.candidates(organization_id,owning_team_id,owner_id,full_name,email,phone,location,seniority_preference,professional_summary,private_notes,status,created_by)
 values(p_org,p_team,p_owner,nullif(btrim(p_profile->>'fullName'),''),nullif(btrim(p_profile->>'email'),''),nullif(btrim(p_profile->>'phone'),''),nullif(btrim(p_profile->>'location'),''),nullif(btrim(p_profile->>'seniorityPreference'),''),nullif(btrim(p_profile->>'professionalSummary'),''),nullif(btrim(p_profile->>'privateNotes'),''),p_profile->>'status',private.actor_id()) returning id into v_id;
 perform private.write_profile_children(p_org,v_id,p_profile);
 perform private.append_profile_revision(p_org,v_id,p_request);
 perform private.audit(p_org,'candidate.created',v_id,p_request,p_team);
 return private.profile_json(p_org,v_id);
end $$;
create function public.save_candidate_profile(p_org uuid,p_candidate uuid,p_expected bigint,p_profile jsonb,p_request uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_row public.candidates;
begin
 select * into v_row from public.candidates where organization_id=p_org and id=p_candidate for update;
 if not found or not private.reads_candidate(p_org,p_candidate) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if v_row.row_version is distinct from p_expected then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
 if v_row.status='archived' then raise exception 'CANDIDATE_ARCHIVED' using errcode='22023'; end if;
 perform private.check_profile(p_profile);
 update public.candidates set full_name=nullif(btrim(p_profile->>'fullName'),''),email=nullif(btrim(p_profile->>'email'),''),phone=nullif(btrim(p_profile->>'phone'),''),location=nullif(btrim(p_profile->>'location'),''),seniority_preference=nullif(btrim(p_profile->>'seniorityPreference'),''),professional_summary=nullif(btrim(p_profile->>'professionalSummary'),''),private_notes=nullif(btrim(p_profile->>'privateNotes'),''),
 status=p_profile->>'status',row_version=row_version+1,updated_at=now() where organization_id=p_org and id=p_candidate and row_version=p_expected;
 perform private.write_profile_children(p_org,p_candidate,p_profile);
 perform private.append_profile_revision(p_org,p_candidate,p_request);
 perform private.audit(p_org,'candidate.profile_updated',p_candidate,p_request,v_row.owning_team_id);
 return private.profile_json(p_org,p_candidate);
end $$;
create function public.set_candidate_archived(p_org uuid,p_candidate uuid,p_expected bigint,p_archived boolean,p_request uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_row public.candidates;
begin
 select * into v_row from public.candidates where organization_id=p_org and id=p_candidate for update;
 if not found or not private.reads_candidate(p_org,p_candidate) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if v_row.row_version is distinct from p_expected then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
 if p_archived is null or (v_row.status='archived')=p_archived then raise exception 'INVALID_ARCHIVE_STATE' using errcode='22023'; end if;
 update public.candidates set status=case when p_archived then 'archived' else coalesce(archived_from_status,'draft') end,
 archived_from_status=case when p_archived then status else null end,row_version=row_version+1,updated_at=now()
 where organization_id=p_org and id=p_candidate and row_version=p_expected;
 perform private.append_profile_revision(p_org,p_candidate,p_request);
 perform private.audit(p_org,case when p_archived then 'candidate.archived' else 'candidate.restored' end,p_candidate,p_request,v_row.owning_team_id);
 return private.profile_json(p_org,p_candidate);
end $$;
create function public.approve_candidate_title(p_org uuid,p_candidate uuid,p_experience uuid,p_expected bigint,p_request uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_row public.candidates;
begin
 select * into v_row from public.candidates where organization_id=p_org and id=p_candidate for update;
 if not found or not private.manages_team(p_org,v_row.owning_team_id) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if v_row.row_version is distinct from p_expected then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
 if v_row.status='archived' then raise exception 'CANDIDATE_ARCHIVED' using errcode='22023'; end if;
 update public.work_experiences set approved_display_title=proposed_display_title,title_approved_by=private.actor_id(),title_approved_at=now()
 where organization_id=p_org and candidate_id=p_candidate and id=p_experience and removed_at is null and
 title_policy='tailorable' and proposed_display_title is not null and official_title is not null;
 if not found then raise exception 'INVALID_TITLE_APPROVAL' using errcode='22023'; end if;
 update public.candidates set row_version=row_version+1,updated_at=now() where id=p_candidate and organization_id=p_org;
 perform private.append_profile_revision(p_org,p_candidate,p_request);
 perform private.audit(p_org,'candidate.display_title_approved',p_candidate,p_request,v_row.owning_team_id,jsonb_build_object('experienceId',p_experience));
 return private.profile_json(p_org,p_candidate);
end $$;

-- Preserve the old creation contract while routing it through revision/audit logic.
create or replace function public.create_candidate(p_org uuid,p_team uuid,p_owner uuid,p_full_name text,p_request uuid) returns uuid
language plpgsql security definer set search_path='' as $$
begin
 return (public.create_candidate_profile(p_org,p_team,p_owner,private.empty_profile()||jsonb_build_object('fullName',p_full_name),p_request)->>'id')::uuid;
end $$;
grant create on schema public to app_command;
alter function public.create_candidate_profile(uuid,uuid,uuid,jsonb,uuid) owner to app_command;
revoke all on function public.create_candidate_profile(uuid,uuid,uuid,jsonb,uuid) from public,anon;
grant execute on function public.create_candidate_profile(uuid,uuid,uuid,jsonb,uuid) to authenticated;
grant create on schema public to app_command;
alter function public.save_candidate_profile(uuid,uuid,bigint,jsonb,uuid) owner to app_command;
revoke all on function public.save_candidate_profile(uuid,uuid,bigint,jsonb,uuid) from public,anon;
grant execute on function public.save_candidate_profile(uuid,uuid,bigint,jsonb,uuid) to authenticated;
grant create on schema public to app_command;
alter function public.set_candidate_archived(uuid,uuid,bigint,boolean,uuid) owner to app_command;
revoke all on function public.set_candidate_archived(uuid,uuid,bigint,boolean,uuid) from public,anon;
grant execute on function public.set_candidate_archived(uuid,uuid,bigint,boolean,uuid) to authenticated;
grant create on schema public to app_command;
alter function public.approve_candidate_title(uuid,uuid,uuid,bigint,uuid) owner to app_command;
revoke all on function public.approve_candidate_title(uuid,uuid,uuid,bigint,uuid) from public,anon;
grant execute on function public.approve_candidate_title(uuid,uuid,uuid,bigint,uuid) to authenticated;
revoke create on schema public from app_command;
create unique index candidate_links_order on public.candidate_links(organization_id,candidate_id,sort_order) where removed_at is null;
create unique index work_experiences_order on public.work_experiences(organization_id,candidate_id,sort_order) where removed_at is null;
create unique index educations_order on public.educations(organization_id,candidate_id,sort_order) where removed_at is null;
create unique index certifications_order on public.certifications(organization_id,candidate_id,sort_order) where removed_at is null;
-- Baseline only the current state of pre-existing foundation rows; no invented past revisions.
insert into public.candidate_profile_revisions(organization_id,candidate_id,revision_number,verified_snapshot,changed_by,request_id)
 select organization_id,id,row_version,private.profile_json(organization_id,id),null,gen_random_uuid() from public.candidates;
commit;

