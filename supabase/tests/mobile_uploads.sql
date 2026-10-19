\set ON_ERROR_STOP on
set role authenticated;
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000001';
do $$
declare created jsonb; original jsonb; retry jsonb; payload jsonb;
begin
  created=public.marketplace_mutate('create_request',jsonb_build_object(
    'key','81000000-0000-0000-0000-000000000001','title','Mobile retry test','mode','pickup','urgency','standard',
    'zone_id','20000000-0000-0000-0000-000000000001','area','Campus',
    'settings','{"size":"A4","color":"bw","copies":1,"duplex":false,"duplex_edge":"long","finishing":"loose","scaling":"fit"}'::jsonb));
  payload=jsonb_build_object('id',created->>'id','name','phone.pdf','bytes',100,'kind','pdf','client_key','82000000-0000-0000-0000-000000000001');
  original=public.marketplace_mutate('register_file',payload);
  retry=public.marketplace_mutate('register_file',payload);
  if original->>'id'<>retry->>'id' then raise exception 'FAIL duplicate upload registration';end if;
  if jsonb_array_length(public.marketplace_read('request',(created->>'id')::uuid)->'files')<>1 then raise exception 'FAIL retry duplicated file';end if;
  begin
    perform public.marketplace_mutate('register_file',payload||'{"bytes":101}'::jsonb);
    raise exception 'FAIL changed retry accepted';
  exception when raise_exception then if sqlerrm<>'IDEMPOTENCY_CONFLICT' then raise;end if;end;
  perform public.marketplace_mutate('finalize_file',jsonb_build_object('id',original->>'id'));
  retry=public.marketplace_mutate('register_file',payload);
  if retry->>'already_finalized'<>'true' then raise exception 'FAIL lost finalization response';end if;
  begin
    perform public.marketplace_mutate_base('onboard','{}'::jsonb);
    raise exception 'FAIL base mutation bypass';
  exception when insufficient_privilege then null;end;
end$$;
reset role;
\echo 'PASS mobile upload retry identity, payload conflict, finalization recovery and internal RPC isolation'
