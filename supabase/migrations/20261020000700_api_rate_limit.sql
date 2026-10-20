begin;
grant create on schema public to app_command;
-- Shared database counter, not per-process memory. Defensive API ceiling, not a
-- product throughput promise or a substitute for provider/edge abuse controls.
create table private.api_request_windows(actor_id uuid not null,window_start timestamptz not null,requests integer not null check(requests between 1 and 1000),primary key(actor_id,window_start));
alter table private.api_request_windows enable row level security;
alter table private.api_request_windows force row level security;
revoke all on private.api_request_windows from public,anon,authenticated;
grant select,insert,update,delete on private.api_request_windows to app_command;
create policy own_window on private.api_request_windows to app_command using(actor_id=private.actor_id()) with check(actor_id=private.actor_id());
create function public.consume_api_request() returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.actor_id();v_window timestamptz:=date_trunc('minute',now());v_count integer;
begin
 if actor is null then raise exception 'FORBIDDEN' using errcode='42501';end if;
 delete from private.api_request_windows where actor_id=actor and window_start<v_window-interval '2 minutes';
 insert into private.api_request_windows(actor_id,window_start,requests) values(actor,v_window,1)
 on conflict(actor_id,window_start) do update set requests=private.api_request_windows.requests+1 where private.api_request_windows.requests<1000 returning requests into v_count;
 return v_count is not null;
end $$;
alter function public.consume_api_request() owner to app_command;
revoke all on function public.consume_api_request() from public,anon;
grant execute on function public.consume_api_request() to authenticated;
revoke create on schema public from app_command;
commit;
