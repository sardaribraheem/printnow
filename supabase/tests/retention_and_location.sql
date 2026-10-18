-- Extend the marketplace fixture with location, retention and bounded history checks.
insert into public.print_requests(id,customer_id,client_key,title,mode,urgency,zone_id,area,settings,state,published_at,expires_at,total_sides,sheets)values('80000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000002','Radius fixture','pickup','standard','20000000-0000-0000-0000-000000000001','Coarse campus label','{"size":"A4","color":"bw","copies":1,"duplex":false,"duplex_edge":"long","finishing":"loose","scaling":"fit"}','open',now(),now()+interval '2 hours',1,1);
insert into public.request_private_destinations(request_id,lat,lng,radius_km)values('80000000-0000-0000-0000-000000000001',31.5204,74.3587,5);
update public.provider_public_profiles set pickup_lat=31.521,pickup_lng=74.359 where id='30000000-0000-0000-0000-000000000001';
update public.provider_public_profiles set pickup_lat=31.8,pickup_lng=74.6 where id='30000000-0000-0000-0000-000000000002';
set role authenticated;
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000002';
do $$declare feed jsonb;begin
 feed=public.marketplace_read('feed');
 if feed::text not like '%80000000-0000-0000-0000-000000000001%' then raise exception 'FAIL nearby pickup feed';end if;
 if feed::text like '%"lat":%' or feed::text like '%"lng":%' then raise exception 'FAIL precise location in feed';end if;
 begin perform private.eligible('30000000-0000-0000-0000-000000000002','80000000-0000-0000-0000-000000000001');raise exception 'FAIL direct eligibility probing';exception when insufficient_privilege then null;end;
end$$;
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000003';
do $$declare feed jsonb;begin
 feed=public.marketplace_read('feed');if feed::text like '%80000000-0000-0000-0000-000000000001%' then raise exception 'FAIL distant pickup eligibility';end if;
 begin perform public.marketplace_read('request','80000000-0000-0000-0000-000000000001');raise exception 'FAIL radius detail bypass';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
end$$;
reset role;
update public.request_files set delete_after=now()-interval '1 day' where id='50000000-0000-0000-0000-000000000001';
set role service_role;
do $$begin if public.marketplace_worker('retention') is not null then raise exception 'FAIL active order files purged';end if;end$$;
reset role;
update public.orders set status='completed',closed_at=now()-interval '8 days' where request_id='40000000-0000-0000-0000-000000000001';
insert into public.support_cases(id,order_id,reporter_id,category,description)select '90000000-0000-0000-0000-000000000001',id,customer_id,'wrong_output','Synthetic evidence hold' from public.orders where request_id='40000000-0000-0000-0000-000000000001';
insert into public.file_retention_holds(file_id,case_id,expires_at)values('50000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001',now()-interval '1 day');
set role service_role;
do $$begin if public.marketplace_worker('retention') is not null then raise exception 'FAIL unresolved evidence expired without review';end if;end$$;
reset role;
set role authenticated;
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000004';
set request.jwt.claims='{"aal":"aal2"}';
select public.marketplace_mutate('admin_resolve','{"id":"90000000-0000-0000-0000-000000000001","reason":"Synthetic evidence hold resolved after review"}');
reset role;
set role service_role;
do $$begin if public.marketplace_worker('retention')->>'id'<>'50000000-0000-0000-0000-000000000001' then raise exception 'FAIL closed file not eligible';end if;end$$;
select public.marketplace_worker('deleted','{"id":"50000000-0000-0000-0000-000000000001"}');
reset role;
insert into public.messages(order_id,sender_id,client_message_id,body,created_at)select o.id,o.customer_id,gen_random_uuid(),'Synthetic page '||n,clock_timestamp()+make_interval(secs=>n) from public.orders o cross join generate_series(1,150)n where request_id='40000000-0000-0000-0000-000000000001';
set role authenticated;
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000001';
do $$declare order_id uuid; latest jsonb; older jsonb; cursor jsonb;begin
 select id into order_id from public.orders where request_id='40000000-0000-0000-0000-000000000001';
 latest=public.marketplace_read('order',order_id)->'messages';if jsonb_array_length(latest)<>100 then raise exception 'FAIL bounded chat history';end if;
 cursor=latest->0;older=public.marketplace_read('messages|'||(cursor->>'created_at')||'|'||(cursor->>'id'),order_id);
 if jsonb_array_length(older)<>51 then raise exception 'FAIL chat cursor loses earlier messages';end if;
 perform public.marketplace_mutate('mark_order_read',jsonb_build_object('id',order_id));
 begin perform public.marketplace_worker('claim');raise exception 'FAIL client claims worker jobs';exception when insufficient_privilege then null;end;
end$$;
reset role;
\echo 'PASS: pickup-radius privacy, anti-probing grants, active-order retention, unresolved holds, deletion eligibility, message pagination and worker isolation.'
