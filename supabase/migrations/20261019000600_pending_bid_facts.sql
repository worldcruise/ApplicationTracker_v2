begin;
-- User-selected D09 refinement: changed candidate facts require fresh versions
-- for pending packages. Historical submissions and export remain unchanged.
create role app_workflow_verifier nologin nobypassrls noinherit;
grant app_workflow_verifier to postgres;
grant usage on schema public,private to app_workflow_verifier;
grant select(id,organization_id,candidate_id,kind,resume_version_id,cover_letter_version_id) on public.documents to app_workflow_verifier;
grant select(id,organization_id,candidate_id,assembly_id) on public.resume_versions to app_workflow_verifier;
grant select(id,organization_id,candidate_id,profile_revision_id) on public.cover_letter_versions,public.prompt_assemblies to app_workflow_verifier;
grant select(organization_id,candidate_id,id,revision_number,verified_snapshot) on public.candidate_profile_revisions to app_workflow_verifier;
grant select(id,organization_id,row_version,status) on public.candidates to app_workflow_verifier;
create policy workflow_facts on public.documents for select to app_workflow_verifier using(true);
create policy workflow_facts on public.resume_versions for select to app_workflow_verifier using(true);
create policy workflow_facts on public.cover_letter_versions for select to app_workflow_verifier using(true);
create policy workflow_facts on public.prompt_assemblies for select to app_workflow_verifier using(true);
create policy workflow_facts on public.candidate_profile_revisions for select to app_workflow_verifier using(true);
create policy workflow_facts on public.candidates for select to app_workflow_verifier using(true);
grant create on schema private to app_workflow_verifier;
create function private.document_facts_match(p_org uuid,p_document uuid,p_snapshot jsonb) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select (r.verified_snapshot-array['rowVersion','createdAt','updatedAt','assignments','ownerId','owningTeamId','privateNotes'])=(p_snapshot-array['rowVersion','createdAt','updatedAt','assignments','ownerId','owningTeamId','privateNotes'])
 from public.documents d
 left join public.resume_versions v on v.organization_id=d.organization_id and v.candidate_id=d.candidate_id and v.id=d.resume_version_id
 left join public.prompt_assemblies a on a.organization_id=d.organization_id and a.candidate_id=d.candidate_id and a.id=v.assembly_id
 left join public.cover_letter_versions l on l.organization_id=d.organization_id and l.candidate_id=d.candidate_id and l.id=d.cover_letter_version_id
 join public.candidate_profile_revisions r on r.organization_id=d.organization_id and r.candidate_id=d.candidate_id and r.id=coalesce(a.profile_revision_id,l.profile_revision_id)
 where d.organization_id=p_org and d.id=p_document),false)
$$;
alter function private.document_facts_match(uuid,uuid,jsonb) owner to app_workflow_verifier;
create function private.document_facts_current(p_org uuid,p_document uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select private.document_facts_match(p_org,p_document,r.verified_snapshot) from public.documents d join public.candidates c on c.organization_id=d.organization_id and c.id=d.candidate_id and c.status='ready'
 join public.candidate_profile_revisions r on r.organization_id=c.organization_id and r.candidate_id=c.id and r.revision_number=c.row_version where d.organization_id=p_org and d.id=p_document),false)
$$;
alter function private.document_facts_current(uuid,uuid) owner to app_workflow_verifier;
revoke create on schema private from app_workflow_verifier;
revoke all on function private.document_facts_match(uuid,uuid,jsonb),private.document_facts_current(uuid,uuid) from public;
grant execute on function private.document_facts_match(uuid,uuid,jsonb),private.document_facts_current(uuid,uuid) to app_command;
create function private.invalidate_pending_profile_packages() returns trigger language plpgsql set search_path='' as $$
declare b public.bids;next_status text;begin
 for b in select * from public.bids where organization_id=new.organization_id and candidate_id=new.candidate_id and current_approval_id is not null and status in ('draft','resume_preparation','ready_for_review','needs_changes','approved','on_hold') for update loop
 if not private.document_facts_match(new.organization_id,b.resume_document_id,new.verified_snapshot) or (b.cover_letter_document_id is not null and not private.document_facts_match(new.organization_id,b.cover_letter_document_id,new.verified_snapshot)) then
 insert into public.bid_approval_invalidations(organization_id,bid_id,approval_id,reason,actor_id) values(new.organization_id,b.id,b.current_approval_id,'Candidate facts changed; fresh reviewed document versions required',private.actor_id());
 next_status:=case when b.status in ('approved','ready_for_review') then 'resume_preparation' else b.status end;
 update public.bids set current_approval_id=null,status=next_status,row_version=row_version+1,updated_at=now() where organization_id=new.organization_id and id=b.id;
 perform private.record_bid_change(new.organization_id,b.id,b.status,next_status,'Candidate facts changed; fresh reviewed versions required',new.request_id);
 perform private.audit(new.organization_id,'bid.approval_invalidated_by_profile',b.id,new.request_id,b.team_id);
 end if;end loop;return new;
end $$;
revoke all on function private.invalidate_pending_profile_packages() from public;
create trigger invalidate_pending_packages after insert on public.candidate_profile_revisions for each row execute function private.invalidate_pending_profile_packages();
create or replace function private.require_bid_documents(b public.bids,p_policy jsonb) returns void language plpgsql set search_path='' as $$ declare d public.documents;begin
 if b.resume_document_id is null then raise exception 'VERIFIED_DOCUMENTS_REQUIRED' using errcode='22023';end if;
 select * into d from public.documents where organization_id=b.organization_id and candidate_id=b.candidate_id and id=b.resume_document_id and kind='resume' and reviewed;
 if not found or d.resume_version_id is distinct from b.resume_version_id then raise exception 'VERIFIED_DOCUMENTS_REQUIRED' using errcode='22023';end if;
 if not private.document_facts_current(b.organization_id,d.id) then raise exception 'PROFILE_FACTS_CHANGED' using errcode='22023';end if;
 if private.org_role(b.organization_id)='bidder' and not private.document_access(b.organization_id,d.id,true) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if (p_policy->>'coverLetterRequired')::boolean and b.cover_letter_document_id is null then raise exception 'VERIFIED_DOCUMENTS_REQUIRED' using errcode='22023';end if;
 if b.cover_letter_document_id is not null then
 select * into d from public.documents where organization_id=b.organization_id and candidate_id=b.candidate_id and id=b.cover_letter_document_id and kind='cover_letter' and reviewed;
 if not found or d.cover_letter_version_id is distinct from b.cover_letter_version_id then raise exception 'VERIFIED_DOCUMENTS_REQUIRED' using errcode='22023';end if;
 if not private.document_facts_current(b.organization_id,d.id) then raise exception 'PROFILE_FACTS_CHANGED' using errcode='22023';end if;
 if private.org_role(b.organization_id)='bidder' and not private.document_access(b.organization_id,d.id,true) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 end if;
end $$;
commit;
