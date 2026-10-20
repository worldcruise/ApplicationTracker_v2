begin;
-- This is an immutable device report at checked_at, never proof of present filesystem state.
create table public.archive_device_observations(
 organization_id uuid not null,operation_id uuid not null,device_id uuid not null,actor_id uuid not null references public.users(id),
 checked_at timestamptz not null,status text not null check(status='verified'),reported_by_device boolean not null default true check(reported_by_device),
 file_hashes jsonb not null check(jsonb_typeof(file_hashes)='object'),metadata_sha256 text not null check(metadata_sha256 ~ '^[0-9a-f]{64}$'),request_hash text not null,
 created_at timestamptz not null default now(),primary key(organization_id,operation_id,device_id),
 foreign key(organization_id,operation_id) references public.archive_operations(organization_id,operation_id)
);
alter table public.archive_device_observations enable row level security;alter table public.archive_device_observations force row level security;
revoke all on public.archive_device_observations from public,anon,authenticated;
grant select,insert on public.archive_device_observations to app_command;
create policy command on public.archive_device_observations to app_command using(private.org_role(organization_id) is not null) with check(actor_id=private.actor_id() and private.org_role(organization_id) is not null);
create trigger immutable before update or delete on public.archive_device_observations for each row execute function private.immutable_revision();
grant create on schema public to app_command;
create function public.record_archive_device(p_org uuid,p_operation uuid,p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; op public.archive_operations; old public.archive_device_observations; device uuid:=(p_input->>'deviceId')::uuid; hashes jsonb:=p_input->'fileHashes'; h text:=encode(sha256(convert_to(p_input::text,'UTF8')),'hex'); stamp timestamptz:=(p_input->>'checkedAt')::timestamptz;
begin
 result:=public.archive_operation_result(p_org,p_operation);if result is null then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select * into op from public.archive_operations where organization_id=p_org and operation_id=p_operation;
 if device is distinct from (op.frozen_input->>'deviceId')::uuid then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if jsonb_typeof(p_input)<>'object' or (select count(*) from jsonb_object_keys(p_input))<>4 or not p_input ?& array['deviceId','checkedAt','fileHashes','metadataSha256'] or stamp is null or stamp>now()+interval '5 minutes' or p_input->>'metadataSha256' !~ '^[0-9a-f]{64}$' or jsonb_typeof(hashes)<>'object'
 or not hashes ?& array['Resume.pdf','Resume.json','JobDetails.txt'] or (select count(*) from jsonb_object_keys(hashes))<>case when op.frozen_input->'coverLetter'='null'::jsonb then 3 else 4 end
 or exists(select 1 from jsonb_each(hashes) v where jsonb_typeof(v.value)<>'string')
 or exists(select 1 from jsonb_each_text(hashes) v where v.key not in ('Resume.pdf','Resume.json','JobDetails.txt','CoverLetter.txt') or v.value is null or v.value !~ '^[0-9a-f]{64}$')
 or hashes->>'Resume.pdf' is distinct from op.frozen_input->'resume'->>'pdfSha256' or hashes->>'Resume.json' is distinct from encode(sha256(convert_to(op.frozen_input->'resume'->>'rawJson','UTF8')),'hex') then raise exception 'SCHEMA_INVALID' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('archive-observation:'||p_org::text||p_operation::text||device::text,0));
 select * into old from public.archive_device_observations where organization_id=p_org and operation_id=p_operation and device_id=device;
 if found then if old.request_hash<>h then raise exception 'KEY_PAYLOAD_MISMATCH';end if;
 else insert into public.archive_device_observations(organization_id,operation_id,device_id,actor_id,checked_at,status,file_hashes,metadata_sha256,request_hash) values(p_org,p_operation,device,private.actor_id(),stamp,'verified',hashes,p_input->>'metadataSha256',h);end if;
 return jsonb_build_object('recorded',true,'checkedAt',stamp,'reportedByDevice',true);
end $$;
alter function public.record_archive_device(uuid,uuid,jsonb) owner to app_command;
revoke create on schema public from app_command;
revoke all on function public.record_archive_device(uuid,uuid,jsonb) from public,anon;
grant execute on function public.record_archive_device(uuid,uuid,jsonb) to authenticated;
commit;
