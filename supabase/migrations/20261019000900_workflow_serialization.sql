begin;
-- Serialize factual verification with profile edits before taking a bid lock.
-- This private non-login role can lock a row but exposes neither profiles nor a mutation endpoint.
grant update(row_version) on public.candidates to app_workflow_verifier;
create policy workflow_fact_lock on public.candidates for update to app_workflow_verifier using(true) with check(true);
grant create on schema private to app_workflow_verifier;
create function private.lock_workflow_candidate(p_org uuid,p_candidate uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 perform 1 from public.candidates where organization_id=p_org and id=p_candidate for update;
 if not found then raise exception 'FORBIDDEN' using errcode='42501';end if;
end $$;
alter function private.lock_workflow_candidate(uuid,uuid) owner to app_workflow_verifier;
revoke create on schema private from app_workflow_verifier;
revoke all on function private.lock_workflow_candidate(uuid,uuid) from public;
grant execute on function private.lock_workflow_candidate(uuid,uuid) to app_command;
create or replace function public.transition_bid(p_org uuid,p_bid uuid,p_expected bigint,p_input jsonb,p_operation uuid,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.bids; a public.bid_approvals; pol jsonb; target text:=p_input->>'status'; old_status text; result jsonb; v_team uuid; v_approval uuid; v_submit uuid;
 payload jsonb:=jsonb_build_object('command','transition_bid','bidId',p_bid,'expected',p_expected,'input',p_input); reason text:=btrim(p_input->>'reason'); override_reason text:=btrim(p_input->>'adminOverrideReason'); v_held text;
begin
 if not private.reads_bid(p_org,p_bid) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 perform private.lock_workflow_candidate(p_org,(select candidate_id from public.bids where organization_id=p_org and id=p_bid));
 select team_id into v_team from public.bids where organization_id=p_org and id=p_bid;
 perform pg_advisory_xact_lock(hashtextextended('workflow-policy:'||p_org::text||v_team::text,0));
 result:=private.workflow_replay(p_org,p_operation,payload);if result is not null then return result;end if;
 if jsonb_typeof(p_input) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_input))<>7 or not p_input ?& array['status','reason','submittedAt','confirmation','attested','adminOverrideReason','reopen'] or octet_length(p_input::text)>32768 or exists(select 1 from jsonb_each(p_input) x where (x.key in ('status','reason','confirmation','adminOverrideReason') and jsonb_typeof(x.value)<>'string') or (x.key in ('attested','reopen') and jsonb_typeof(x.value)<>'boolean') or (x.key='submittedAt' and jsonb_typeof(x.value) not in ('string','null'))) then raise exception 'INVALID_TRANSITION_REQUEST' using errcode='22023';end if;
 select * into b from public.bids where organization_id=p_org and id=p_bid for update;
 if b.row_version is distinct from p_expected then raise exception 'VERSION_CONFLICT' using errcode='40001';end if;
 if not private.workflow_active(p_org,b.candidate_id) then raise exception 'CANDIDATE_ARCHIVED' using errcode='22023';end if;
 if not private.manages_team(p_org,b.team_id) and b.owner_id<>private.actor_id() and not (private.org_role(p_org)='bidder' and (exists(select 1 from private.bidder_grants(p_org,b.candidate_id,p_bid,'bid.prepare')) or (target='submitted' and exists(select 1 from private.bidder_grants(p_org,b.candidate_id,p_bid,'bid.submit'))))) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 old_status:=b.status;v_held:=b.held_from_status;v_approval:=b.current_approval_id;
 select approval_policy into pol from public.teams where organization_id=p_org and id=b.team_id;
 if pol is null then raise exception 'WORKFLOW_POLICY_REQUIRED' using errcode='22023';end if;
 if (p_input->>'reopen')::boolean then
 if private.org_role(p_org)<>'admin' or old_status not in ('closed','rejected','withdrawn','expired') or target<>'resume_preparation' or coalesce(length(reason),0)=0 then raise exception 'FORBIDDEN' using errcode='42501';end if;
 v_approval:=null;v_held:=null;
 elsif old_status='on_hold' and target=v_held then
 if target='approved' then select * into a from public.bid_approvals where organization_id=p_org and bid_id=p_bid and id=v_approval;
 if not found or a.content_hash<>b.content_hash or a.policy_snapshot<>pol then target:='resume_preparation';v_approval:=null;end if;end if;
 else
 if not (case old_status
 when 'draft' then target in ('resume_preparation','withdrawn','expired')
 when 'resume_preparation' then target in ('ready_for_review','submitted','on_hold','withdrawn')
 when 'ready_for_review' then target in ('approved','needs_changes','on_hold','withdrawn')
 when 'needs_changes' then target in ('resume_preparation','ready_for_review','withdrawn')
 when 'approved' then target in ('submitted','resume_preparation','on_hold','withdrawn')
 when 'submitted' then target in ('awaiting_response','shortlisted','interview_invited','rejected','offer','withdrawn','closed')
 when 'awaiting_response' then target in ('shortlisted','interview_invited','on_hold','rejected','expired','offer','withdrawn','closed')
 when 'shortlisted' then target in ('interview_invited','offer','on_hold','rejected','withdrawn','closed')
 when 'interview_invited' then target in ('offer','on_hold','rejected','withdrawn','closed')
 when 'offer' then target in ('closed','rejected','withdrawn') when 'on_hold' then target in ('withdrawn','expired','closed')
 when 'rejected' then target='closed' when 'withdrawn' then target='closed' when 'expired' then target='closed' else false end) then raise exception 'INVALID_BID_TRANSITION' using errcode='22023';end if;
 end if;
 if coalesce(length(reason),0)=0 or length(reason)>4000 then raise exception 'TRANSITION_REASON_REQUIRED' using errcode='22023';end if;
 if target in ('ready_for_review','approved','submitted') then perform private.require_bid_documents(b,pol);end if;
 if target in ('approved','needs_changes') then
 if not private.manages_team(p_org,b.team_id) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if target='approved' and private.actor_id()=any(private.package_authors(p_org,p_bid)) and not (private.org_role(p_org)='admin' and coalesce(length(override_reason),0)>0) then raise exception 'SELF_APPROVAL_FORBIDDEN' using errcode='42501';end if;
 if length(coalesce(override_reason,''))>4000 then raise exception 'INVALID_OVERRIDE_REASON' using errcode='22023';end if;
 insert into public.bid_approvals(organization_id,bid_id,candidate_id,decision,content_hash,job_snapshot,resume_document_id,cover_letter_document_id,resume_version_id,cover_letter_version_id,policy_snapshot,reviewer_id,override_reason,reason)
 values(p_org,p_bid,b.candidate_id,target,b.content_hash,private.bid_content(b),b.resume_document_id,b.cover_letter_document_id,b.resume_version_id,b.cover_letter_version_id,pol,private.actor_id(),nullif(override_reason,''),reason) returning id into v_approval;
 end if;
 if target='submitted' then
 if private.org_role(p_org)='bidder' and not exists(select 1 from private.bidder_grants(p_org,b.candidate_id,p_bid,'bid.submit')) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if (pol->>'required')::boolean then
 select * into a from public.bid_approvals where organization_id=p_org and bid_id=p_bid and id=v_approval and decision='approved';
 if not found or a.content_hash<>b.content_hash or a.policy_snapshot<>pol or a.resume_document_id is distinct from b.resume_document_id or a.cover_letter_document_id is distinct from b.cover_letter_document_id then raise exception 'APPROVAL_REQUIRED' using errcode='22023';end if;
 end if;
 if p_input->>'submittedAt' is null or (p_input->>'submittedAt')::timestamptz>now()+interval '5 minutes' or (coalesce(length(btrim(p_input->>'confirmation')),0)=0 and coalesce((p_input->>'attested')::boolean,false)=false) then raise exception 'SUBMISSION_ATTESTATION_REQUIRED' using errcode='22023';end if;
 insert into public.bid_submissions(organization_id,bid_id,candidate_id,operation_id,content_hash,job_snapshot,policy_snapshot,approval_id,resume_document_id,cover_letter_document_id,resume_version_id,cover_letter_version_id,submitted_at,confirmation,attested,actor_id)
 values(p_org,p_bid,b.candidate_id,p_operation,b.content_hash,private.bid_content(b),pol,case when (pol->>'required')::boolean then v_approval else null end,b.resume_document_id,b.cover_letter_document_id,b.resume_version_id,b.cover_letter_version_id,(p_input->>'submittedAt')::timestamptz,p_input->>'confirmation',(p_input->>'attested')::boolean,private.actor_id()) returning id into v_submit;
 elsif old_status in ('submitted','awaiting_response','shortlisted','interview_invited','offer') and not exists(select 1 from public.bid_submissions where organization_id=p_org and bid_id=p_bid) then raise exception 'SUBMISSION_REQUIRED' using errcode='22023';end if;
 if target in ('awaiting_response','shortlisted','interview_invited','offer') and not exists(select 1 from public.bid_submissions where organization_id=p_org and bid_id=p_bid) then raise exception 'SUBMISSION_REQUIRED' using errcode='22023';end if;
 if target='on_hold' then v_held:=old_status;elsif old_status='on_hold' then v_held:=null;end if;
 if target='resume_preparation' then v_approval:=null;end if;
 update public.bids set status=target,held_from_status=v_held,current_approval_id=v_approval,submitted_at=case when target='submitted' then (p_input->>'submittedAt')::timestamptz else submitted_at end,row_version=row_version+1,updated_at=now() where organization_id=p_org and id=p_bid;
 perform private.record_bid_change(p_org,p_bid,old_status,target,reason,p_request);
 perform private.audit(p_org,case when (p_input->>'reopen')::boolean then 'bid.reopened' when target='submitted' then 'bid.submitted' when target in ('approved','needs_changes') then 'bid.reviewed' else 'bid.transitioned' end,p_bid,p_request,b.team_id,jsonb_build_object('from',old_status,'to',target,'adminOverride',coalesce(length(override_reason),0)>0));
 return private.workflow_finish(p_org,p_bid,p_operation,payload,jsonb_build_object('id',p_bid,'rowVersion',b.row_version+1,'submissionId',v_submit,'approvalId',v_approval));
end $$;


create function public.record_workflow_failure(p_org uuid,p_bid uuid,p_interview uuid,p_operation uuid,p_code text) returns void language plpgsql security definer set search_path='' as $$ begin
 if not private.reads_bid(p_org,p_bid) or (p_interview is not null and not private.reads_interview(p_org,p_interview)) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_code not in ('VERSION_CONFLICT','SCHEMA_INVALID','KEY_PAYLOAD_MISMATCH','SERVICE_UNAVAILABLE') or p_operation is null then raise exception 'INVALID_EVENT' using errcode='22023';end if;
 insert into public.workflow_notifications(organization_id,bid_id,interview_id,recipient_id,event_key,title) values(p_org,p_bid,p_interview,private.actor_id(),'failure:'||p_operation,'Workflow operation failed: '||p_code) on conflict(organization_id,recipient_id,event_key) do nothing;
end $$;
grant create on schema public to app_command;
alter function public.record_workflow_failure(uuid,uuid,uuid,uuid,text) owner to app_command;
revoke create on schema public from app_command;
revoke all on function public.record_workflow_failure(uuid,uuid,uuid,uuid,text) from public,anon;
grant execute on function public.record_workflow_failure(uuid,uuid,uuid,uuid,text) to authenticated;
commit;
