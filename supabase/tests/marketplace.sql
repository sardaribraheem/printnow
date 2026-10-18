-- Real PostgreSQL authorization and transaction tests; no hosted data.
\set ON_ERROR_STOP on
insert into public.print_requests(id,customer_id,client_key,title,mode,urgency,zone_id,area,settings) values
('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000011','Authorization test','pickup','standard','20000000-0000-0000-0000-000000000001','Campus','{"size":"A4","color":"bw","copies":2,"duplex":true,"duplex_edge":"long","finishing":"loose","scaling":"fit"}');
insert into public.request_private_destinations(request_id,address,phone) values('40000000-0000-0000-0000-000000000001','EXACT_ADDRESS_MUST_NOT_LEAK','03111111111');
insert into public.request_files(id,request_id,owner_id,original_name,kind,byte_count,page_count,object_key,processing_state,derivative_key) values
('50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','fixture.pdf','pdf',100,5,'test/fixture','ready','test/derivative');
set role authenticated;
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000002';
do $$begin
 begin perform public.marketplace_mutate('file_access','{"id":"50000000-0000-0000-0000-000000000001"}');raise exception 'FAIL draft access';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
end$$;
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000001';
select public.marketplace_mutate('publish','{"id":"40000000-0000-0000-0000-000000000001","revision":1,"consent":"file-sharing-v1"}');
do $$declare r jsonb;begin
 r=public.marketplace_read('request','40000000-0000-0000-0000-000000000001');
 if (r->>'total_sides')::int<>10 or (r->>'sheets')::int<>6 then raise exception 'FAIL F06 counts';end if;
end$$;
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000002';
do $$declare r jsonb;begin
 r=public.marketplace_read('feed');
 if r::text like '%EXACT_ADDRESS_MUST_NOT_LEAK%' or r::text like '%03111111111%' or r::text like '%customer_id%' then raise exception 'FAIL F03 feed privacy';end if;
 if (select count(*) from public.request_private_destinations)<>0 then raise exception 'FAIL F03 direct destination';end if;
 perform public.marketplace_mutate('file_access','{"id":"50000000-0000-0000-0000-000000000001"}');
 begin perform public.marketplace_mutate('offer','{"id":"40000000-0000-0000-0000-000000000001","revision":1,"key":"60000000-0000-0000-0000-000000000001","print_paisa":20000,"delivery_paisa":100,"duration_minutes":20,"payment_method":"cash"}');raise exception 'FAIL O01 pickup delivery fee';exception when raise_exception then if sqlerrm<>'INVALID_DELIVERY_PRICE' then raise;end if;end;
end$$;
select public.marketplace_mutate('offer','{"id":"40000000-0000-0000-0000-000000000001","revision":1,"key":"60000000-0000-0000-0000-000000000001","print_paisa":20000,"delivery_paisa":0,"duration_minutes":20,"payment_method":"cash"}') as offer_a \gset
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000003';
select public.marketplace_mutate('offer','{"id":"40000000-0000-0000-0000-000000000001","revision":1,"key":"60000000-0000-0000-0000-000000000002","print_paisa":18000,"delivery_paisa":0,"duration_minutes":30,"payment_method":"cash"}') as offer_b \gset
do $$begin if (select count(*) from public.offers)<>1 then raise exception 'FAIL competitor bids visible';end if;end$$;
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000001';
select public.marketplace_mutate('accept',jsonb_build_object('id',(:'offer_b'::jsonb)->>'id','revision',1,'key','60000000-0000-0000-0000-000000000003')) as order_result \gset
select public.marketplace_mutate('accept',jsonb_build_object('id',(:'offer_b'::jsonb)->>'id','revision',1,'key','60000000-0000-0000-0000-000000000003')) as order_retry \gset
select public.marketplace_read('order',((:'order_result'::jsonb)->>'id')::uuid)->>'mine' as customer_order_access;
select :'order_result'::jsonb=:'order_retry'::jsonb as retry_same_order \gset
\if :retry_same_order
\echo 'PASS acceptance retry returns same order'
\else
\quit 1
\endif
do $$declare o public.orders;begin
 select * into o from public.orders where request_id='40000000-0000-0000-0000-000000000001';
 if o.commission_bps_snapshot<>0 or o.platform_fee_paisa<>0 or (select count(*) from public.orders where request_id=o.request_id)<>1 then raise exception 'FAIL order uniqueness/launch fees';end if;
 begin perform public.marketplace_mutate('transition',jsonb_build_object('id',o.id,'version',1,'status','printing'));raise exception 'FAIL customer starts printer';exception when raise_exception then if sqlerrm<>'INVALID_TRANSITION' then raise;end if;end;
 perform public.marketplace_mutate('message',jsonb_build_object('id',o.id,'key','70000000-0000-0000-0000-000000000001','body','A test message'));
 perform public.marketplace_mutate('message',jsonb_build_object('id',o.id,'key','70000000-0000-0000-0000-000000000001','body','A test message'));
 if (select count(*) from public.messages where order_id=o.id)<>1 then raise exception 'FAIL duplicate message';end if;
end$$;
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000002';
do $$begin
 begin perform public.marketplace_mutate('file_access','{"id":"50000000-0000-0000-0000-000000000001"}');raise exception 'FAIL losing provider retains files';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
 if (select count(*) from public.orders)<>0 or (select count(*) from public.messages)<>0 then raise exception 'FAIL order/message RLS';end if;
end$$;
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000003';
select public.marketplace_mutate('file_access','{"id":"50000000-0000-0000-0000-000000000001"}');
select public.marketplace_mutate('transition',jsonb_build_object('id',(:'order_result'::jsonb)->>'id','version',1,'status','printing'));
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000001';
do $$declare o uuid;begin
 select id into o from public.orders where request_id='40000000-0000-0000-0000-000000000001';
 begin perform public.marketplace_mutate('transition',jsonb_build_object('id',o,'version',2,'status','cancelled','reason','Changed my mind'));raise exception 'FAIL cancel after printing';exception when raise_exception then if sqlerrm<>'CANCELLATION_REQUIRES_SUPPORT' then raise;end if;end;
 perform public.marketplace_mutate('payment',jsonb_build_object('id',o,'assertion','paid'));
end$$;
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000004';
set request.jwt.claims='{"aal":"aal1"}';
do $$begin begin perform public.marketplace_read('admin');raise exception 'FAIL admin without MFA';exception when raise_exception then if sqlerrm<>'MFA_REQUIRED' then raise;end if;end;end$$;
set request.jwt.claims='{"aal":"aal2"}';
select public.marketplace_read('admin') is not null as admin_available;
reset role;
do $$begin if exists(select 1 from public.offers where expires_at<>created_at+interval '5 minutes') then raise exception 'FAIL O02 TTL';end if;end$$;
\echo 'PASS: marketplace counts, privacy, offer visibility, single acceptance, retry, role transitions, file revocation, message deduplication, fees and MFA.'
