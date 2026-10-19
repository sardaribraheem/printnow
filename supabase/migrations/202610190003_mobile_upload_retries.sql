-- A stable client upload key prevents duplicate files when a phone loses a response.
alter table public.request_files add column client_upload_key uuid;
create unique index request_files_upload_retry on public.request_files(owner_id,request_id,client_upload_key)
  where client_upload_key is not null;

alter function public.marketplace_mutate(text,jsonb) rename to marketplace_mutate_base;
revoke all on function public.marketplace_mutate_base(text,jsonb) from public,anon,authenticated,service_role;

create function public.marketplace_mutate(p_action text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); upload_key uuid; existing public.request_files; request public.print_requests; result jsonb;
begin
  if p_action<>'register_file' or nullif(p_input->>'client_key','') is null then
    return public.marketplace_mutate_base(p_action,p_input);
  end if;
  if actor is null then raise exception 'AUTH_REQUIRED';end if;
  if not private.actor_active() then raise exception 'FORBIDDEN';end if;
  upload_key=(p_input->>'client_key')::uuid;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||':'||upload_key::text,0));
  select * into request from public.print_requests where id=(p_input->>'id')::uuid;
  if request.id is null or request.customer_id<>actor then raise exception 'FORBIDDEN';end if;
  if request.state<>'draft' then raise exception 'REQUEST_CLOSED';end if;
  select * into existing from public.request_files
    where owner_id=actor and request_id=request.id and client_upload_key=upload_key;
  if existing.id is not null then
    if existing.original_name is distinct from p_input->>'name'
      or existing.byte_count is distinct from (p_input->>'bytes')::bigint
      or existing.kind is distinct from p_input->>'kind' then raise exception 'IDEMPOTENCY_CONFLICT';end if;
    if existing.processing_state in('deleting','deleted') then raise exception 'FILE_NOT_READY';end if;
    return jsonb_build_object('id',existing.id,'already_finalized',exists(select 1 from public.file_jobs where file_id=existing.id));
  end if;
  result=public.marketplace_mutate_base(p_action,p_input);
  update public.request_files set client_upload_key=upload_key where id=(result->>'id')::uuid;
  return result||jsonb_build_object('already_finalized',false);
end$$;
revoke all on function public.marketplace_mutate(text,jsonb) from public,anon,authenticated;
grant execute on function public.marketplace_mutate(text,jsonb) to authenticated;
