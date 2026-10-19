begin;
create function public.get_bid_workflow_access(p_org uuid,p_bid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare b public.bids;manager boolean;self_review boolean;begin
 if not private.reads_bid(p_org,p_bid) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select * into b from public.bids where organization_id=p_org and id=p_bid;
 manager:=private.manages_team(p_org,b.team_id);self_review:=coalesce(private.actor_id()=any(private.package_authors(p_org,b.id)),false);
 return jsonb_build_object('canEdit',private.org_role(p_org)<>'bidder' or exists(select 1 from private.bidder_grants(p_org,b.candidate_id,b.id,'bid.prepare')),
 'canTransition',case when private.org_role(p_org)='bidder' then exists(select 1 from private.bidder_grants(p_org,b.candidate_id,b.id,'bid.prepare')) else manager or b.owner_id=private.actor_id() end,
 'canSubmit',case when private.org_role(p_org)='bidder' then exists(select 1 from private.bidder_grants(p_org,b.candidate_id,b.id,'bid.submit')) else manager or b.owner_id=private.actor_id() end,
 'canReview',manager and not self_review,'selfReview',self_review,'canOverride',private.org_role(p_org)='admin','canAssign',manager,
 'canInterview',private.org_role(p_org)<>'bidder',
 'factsCurrent',private.document_facts_current(p_org,b.resume_document_id) and (b.cover_letter_document_id is null or private.document_facts_current(p_org,b.cover_letter_document_id)),
 'policy',(select approval_policy from public.teams where organization_id=p_org and id=b.team_id));
end $$;
grant create on schema public to app_command;
alter function public.get_bid_workflow_access(uuid,uuid) owner to app_command;
revoke create on schema public from app_command;
revoke all on function public.get_bid_workflow_access(uuid,uuid) from public,anon;
grant execute on function public.get_bid_workflow_access(uuid,uuid) to authenticated;
-- A letter created for one bid must never be used for another opportunity.
grant select(bid_id) on public.cover_letter_versions to app_workflow_verifier;
create function private.validate_bid_letter() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if new.cover_letter_version_id is not null and exists(select 1 from public.cover_letter_versions l where l.organization_id=new.organization_id and l.id=new.cover_letter_version_id and l.bid_id is not null and l.bid_id<>new.id) then raise exception 'LETTER_BID_MISMATCH' using errcode='22023';end if;
 return new;end $$;
grant create on schema private to app_workflow_verifier;
alter function private.validate_bid_letter() owner to app_workflow_verifier;
revoke create on schema private from app_workflow_verifier;
revoke all on function private.validate_bid_letter() from public;
create trigger validate_letter before insert or update on public.bids for each row execute function private.validate_bid_letter();
commit;
