-- Marketplace writes are transactional RPCs. Exact destinations never appear in feed rows.
alter table public.profiles add column preferred_fulfillment text not null default 'pickup' check(preferred_fulfillment in('pickup','delivery'));
alter table public.provider_private_profiles add column capabilities jsonb not null default '{"sizes":["A4"],"colors":["bw"],"duplex":false,"finishing":["loose"]}';
alter table public.provider_private_profiles add column operating_hours text not null default '';
alter table public.provider_private_profiles add column accepting_jobs boolean not null default true;
grant select(capabilities,operating_hours,accepting_jobs) on public.provider_private_profiles to authenticated;
create table public.print_requests (
 id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.profiles(user_id),
 client_key uuid not null, revision integer not null default 1, state text not null default 'draft' check(state in ('draft','open','matched','cancelled','expired')),
 title text not null check(char_length(title) between 2 and 100), mode text not null check(mode in ('pickup','delivery')),
 urgency text not null check(urgency in ('standard','urgent')), zone_id uuid not null references public.service_zones(id),
 area text not null check(char_length(area) between 2 and 100), settings jsonb not null,
 instructions text not null default '' check(char_length(instructions)<=1000), latest_needed_at timestamptz,
 published_at timestamptz, expires_at timestamptz, consent_at timestamptz, total_sides integer not null default 0,
 sheets integer not null default 0, created_at timestamptz not null default now(), unique(customer_id,client_key)
);
create index requests_feed on public.print_requests(zone_id,state,expires_at);
create index requests_customer on public.print_requests(customer_id,created_at desc);
create table public.request_private_destinations (
 request_id uuid primary key references public.print_requests(id) on delete cascade,
 recipient_name text not null default '', phone text not null default '', address text not null default '', landmark text not null default ''
);
create table public.request_files (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references public.print_requests(id) on delete cascade,
 owner_id uuid not null references public.profiles(user_id), original_name text not null check(char_length(original_name)<=255),
 kind text not null check(kind in ('pdf','png','jpeg')), byte_count integer not null check(byte_count between 1 and 26214400),
 page_count integer check(page_count between 1 and 1000), object_key text not null unique, derivative_key text, preview_key text,
 checksum text, processing_state text not null default 'pending' check(processing_state in ('pending','processing','ready','failed','deleted')),
 error text, delete_after timestamptz not null default now()+interval '24 hours', created_at timestamptz not null default now()
);
create index files_retention on public.request_files(delete_after);
alter table public.request_files add column pixel_width integer,add column pixel_height integer;
create table public.file_jobs (
 id uuid primary key default gen_random_uuid(), file_id uuid not null unique references public.request_files(id),
 state text not null default 'queued' check(state in('queued','running','done','failed')), attempts integer not null default 0,
 locked_until timestamptz, last_error text, created_at timestamptz not null default now()
);
create table public.offers (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references public.print_requests(id), revision integer not null,
 provider_id uuid not null references public.provider_public_profiles(id), client_key uuid not null,
 print_paisa integer not null check(print_paisa>0 and print_paisa<=100000000), delivery_paisa integer not null check(delivery_paisa between 0 and 100000000),
 total_paisa integer generated always as(print_paisa+delivery_paisa) stored,
 duration_minutes integer not null check(duration_minutes between 1 and 10080), payment_method text not null check(payment_method in('cash','transfer')),
 note text not null default '' check(char_length(note)<=500), status text not null default 'active' check(status in('active','accepted','declined','withdrawn','expired','not_selected','invalidated')),
 created_at timestamptz not null, expires_at timestamptz not null, unique(provider_id,client_key), check(expires_at=created_at+interval '5 minutes')
);
create unique index one_live_offer on public.offers(provider_id,request_id) where status='active';
create unique index one_accepted_offer on public.offers(request_id) where status='accepted';
create index offers_request on public.offers(request_id,status,expires_at);
create table public.orders (
 id uuid primary key default gen_random_uuid(), request_id uuid not null unique references public.print_requests(id), accepted_offer_id uuid not null unique references public.offers(id),
 customer_id uuid not null references public.profiles(user_id), provider_id uuid not null references public.provider_public_profiles(id),
 status text not null default 'confirmed' check(status in('confirmed','printing','ready','out_for_delivery','handover_reported','completed','cancelled')),
 issue_status text not null default 'none' check(issue_status in('none','open','resolved')),
 mode text not null, spec_snapshot jsonb not null, price_snapshot jsonb not null,
 commission_bps_snapshot integer not null default 0 check(commission_bps_snapshot=0), platform_fee_paisa integer not null default 0 check(platform_fee_paisa=0),
 accepted_at timestamptz not null, due_at timestamptz not null, row_version integer not null default 1, closed_at timestamptz,
 customer_payment text check(customer_payment in('paid','not_paid')), provider_payment text check(provider_payment in('received','not_received')),
 unique(customer_id,accepted_offer_id)
);
create index orders_provider on public.orders(provider_id,status);
create table public.order_contact_snapshots(order_id uuid primary key references public.orders(id), contacts jsonb not null);
create table public.messages (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id), sender_id uuid not null references public.profiles(user_id),
 client_message_id uuid not null, body text not null check(char_length(btrim(body)) between 1 and 2000), created_at timestamptz not null default now(), unique(sender_id,client_message_id)
);
create index messages_order on public.messages(order_id,created_at,id);
create table public.order_events(id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id),actor_id uuid not null references public.profiles(user_id),event_type text not null, safe_payload jsonb not null default '{}',created_at timestamptz not null default now());
create table public.document_access_events(id uuid primary key default gen_random_uuid(),file_id uuid not null references public.request_files(id),actor_id uuid not null references public.profiles(user_id),purpose text not null,created_at timestamptz not null default now());
create table public.support_cases(id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id),reporter_id uuid not null references public.profiles(user_id),category text not null,description text not null check(char_length(description) between 5 and 3000),state text not null default 'open' check(state in('open','resolved')),resolution text,created_at timestamptz not null default now(),resolved_at timestamptz);
create table public.file_retention_holds(file_id uuid not null references public.request_files(id),case_id uuid not null references public.support_cases(id),expires_at timestamptz not null,primary key(file_id,case_id));
create table public.notifications(id uuid primary key default gen_random_uuid(),recipient_id uuid not null references public.profiles(user_id),kind text not null,entity_id uuid not null,read_at timestamptz,created_at timestamptz not null default now());
create index notifications_recipient on public.notifications(recipient_id,created_at desc);
create table public.admin_audit(id uuid primary key default gen_random_uuid(),actor_id uuid not null references public.profiles(user_id),action text not null,target_id uuid not null,reason text not null,created_at timestamptz not null default now());

create table public.request_clarifications(id uuid primary key default gen_random_uuid(),request_id uuid not null references public.print_requests(id),provider_id uuid not null references public.provider_public_profiles(id),revision integer not null,category text not null check(category in('page_selection','print_settings','fulfillment_details')),created_at timestamptz not null default now(),unique(request_id,provider_id,revision,category));
alter table public.request_clarifications enable row level security;
revoke all on public.request_clarifications from anon,authenticated;
create function private.actor_active() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.profiles where user_id=auth.uid() and account_status='active')$$;
create function private.my_provider() returns uuid language sql stable security definer set search_path='' as $$select provider_id from public.provider_members where user_id=auth.uid()$$;
create function private.eligible(p uuid,r uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.provider_private_profiles pp join public.print_requests pr on pr.id=r join public.service_zones z on z.id=pr.zone_id
 where pp.provider_id=p and pp.application_state='active' and pp.accepting_jobs and z.active and pp.zone_id=pr.zone_id
 and (case when pr.mode='pickup' then pp.pickup_enabled else pp.delivery_enabled end)
 and pp.capabilities->'sizes' ? (pr.settings->>'size') and pp.capabilities->'colors' ? (pr.settings->>'color')
 and (not (pr.settings->>'duplex')::boolean or (pp.capabilities->>'duplex')::boolean)
 and pp.capabilities->'finishing' ? (pr.settings->>'finishing')
 and exists(select 1 from public.provider_members m join public.profiles u on u.user_id=m.user_id where m.provider_id=p and u.account_status='active'))
$$;
create function private.order_participant(o uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.orders where id=o and (customer_id=auth.uid() or private.is_provider_member(provider_id)))$$;
create function private.require_admin() returns void language plpgsql stable security definer set search_path='' as $$begin
 if not private.is_admin() or not private.actor_active() then raise exception 'FORBIDDEN'; end if;
 if coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'aal','aal1')<>'aal2' then raise exception 'MFA_REQUIRED'; end if;
end$$;
revoke all on function private.actor_active(),private.my_provider(),private.eligible(uuid,uuid),private.order_participant(uuid),private.require_admin() from public;
grant execute on function private.actor_active(),private.my_provider(),private.eligible(uuid,uuid),private.order_participant(uuid),private.require_admin() to authenticated;

do $$declare t text;begin foreach t in array array['print_requests','request_private_destinations','request_files','file_jobs','offers','orders','order_contact_snapshots','messages','order_events','document_access_events','support_cases','file_retention_holds','notifications','admin_audit'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);end loop;end$$;
-- No direct writes. Sensitive projections are returned only from authorized RPCs.
grant select on public.print_requests,public.request_private_destinations,public.offers,public.orders,public.order_contact_snapshots,public.messages,public.order_events,public.notifications,public.support_cases to authenticated;
create policy own_requests on public.print_requests for select to authenticated using(customer_id=auth.uid());
create policy own_destination on public.request_private_destinations for select to authenticated using(exists(select 1 from public.print_requests where id=request_id and customer_id=auth.uid()));
create policy own_offers on public.offers for select to authenticated using(private.is_provider_member(provider_id) or exists(select 1 from public.print_requests where id=request_id and customer_id=auth.uid()));
create policy participant_orders on public.orders for select to authenticated using(customer_id=auth.uid() or private.is_provider_member(provider_id));
create policy participant_contacts on public.order_contact_snapshots for select to authenticated using(private.order_participant(order_id));
create policy participant_messages on public.messages for select to authenticated using(private.order_participant(order_id));
create policy participant_events on public.order_events for select to authenticated using(private.order_participant(order_id));
create policy own_notifications on public.notifications for select to authenticated using(recipient_id=auth.uid());
create policy own_support on public.support_cases for select to authenticated using(reporter_id=auth.uid());


create table public.request_revisions(request_id uuid not null references public.print_requests(id),revision integer not null,snapshot jsonb not null,created_at timestamptz not null default now(),primary key(request_id,revision));
alter table public.request_revisions enable row level security;
revoke all on public.request_revisions from anon,authenticated;
create function private.page_count(selection text,pages integer) returns integer language plpgsql immutable set search_path='' as $$
declare part text; first_page integer; last_page integer; selected integer[]:='{}';begin
 if coalesce(btrim(selection),'')='' then return pages;end if;
 foreach part in array string_to_array(selection,',') loop
  if btrim(part)!~'^[0-9]+(\s*-\s*[0-9]+)?$' then raise exception 'INVALID_PAGES';end if;
  first_page=btrim(split_part(part,'-',1))::integer;
  last_page=case when position('-' in part)>0 then btrim(split_part(part,'-',2))::integer else first_page end;
  if first_page<1 or last_page<first_page or last_page>pages then raise exception 'INVALID_PAGES';end if;
  selected=selected||array(select generate_series(first_page,last_page));
 end loop;
 return (select count(distinct n) from unnest(selected)n);
end$$;
revoke all on function private.page_count(text,integer) from public;


alter table public.provider_public_profiles add column pickup_lat double precision check(pickup_lat between -90 and 90),add column pickup_lng double precision check(pickup_lng between -180 and 180),add check((pickup_lat is null)=(pickup_lng is null));
alter table public.request_private_destinations add column lat double precision check(lat between -90 and 90),add column lng double precision check(lng between -180 and 180),add column radius_km integer check(radius_km between 1 and 100),add check((lat is null)=(lng is null)),add check(radius_km is null or lat is not null);
create function private.within_pickup_radius(p uuid,r uuid) returns boolean language sql stable security definer set search_path='' as $$
select not exists(select 1 from public.request_private_destinations where request_id=r and radius_km is not null) or exists(select 1 from public.request_private_destinations d join public.provider_public_profiles pp on pp.id=p where d.request_id=r and pp.pickup_lat is not null and pp.pickup_lng is not null and 6371*acos(least(1.0,greatest(-1.0,sin(radians(d.lat))*sin(radians(pp.pickup_lat))+cos(radians(d.lat))*cos(radians(pp.pickup_lat))*cos(radians(pp.pickup_lng-d.lng)))))<=d.radius_km)
$$;
revoke all on function private.within_pickup_radius(uuid,uuid) from public;


-- Hardening and expanded owner editing. Schema changes remain separate from application releases.
create function private.valid_settings(s jsonb) returns boolean language sql immutable set search_path='' as $$
select coalesce(jsonb_typeof(s)='object' and s->>'size' in('A4','A3') and s->>'color' in('bw','color') and s->>'finishing' in('loose','stapled') and s->>'scaling' in('fit','actual') and s->>'duplex_edge' in('long','short') and jsonb_typeof(s->'copies')='number' and (s->>'copies')::numeric between 1 and 200 and (s->>'copies')::numeric=trunc((s->>'copies')::numeric) and jsonb_typeof(s->'duplex')='boolean',false)
$$;
create function private.supports_settings(s jsonb,c jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare item jsonb; combined jsonb;begin
 for item in select value from jsonb_each(coalesce(s->'files','{}'::jsonb)) union all select '{}'::jsonb loop
 combined=s||item;
 if not coalesce(c->'sizes' ? (combined->>'size') and c->'colors' ? (combined->>'color') and c->'finishing' ? (combined->>'finishing') and (not (combined->>'duplex')::boolean or (c->>'duplex')::boolean),false) then return false;end if;
 end loop;return true;
end$$;
create or replace function private.eligible(p uuid,r uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.provider_private_profiles pp join public.print_requests pr on pr.id=r join public.service_zones z on z.id=pr.zone_id
 where pp.provider_id=p and pp.application_state='active' and pp.accepting_jobs and z.active and pp.zone_id=pr.zone_id
 and (case when pr.mode='pickup' then pp.pickup_enabled else pp.delivery_enabled end)
 and private.supports_settings(pr.settings,pp.capabilities)
 and exists(select 1 from public.provider_members m join public.profiles u on u.user_id=m.user_id where m.provider_id=p and u.account_status='active'))
$$;
create function private.may_upload(k text) returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from public.request_files f join public.print_requests r on r.id=f.request_id where f.object_key=k and f.owner_id=auth.uid() and r.state='draft' and f.processing_state='pending')
$$;
revoke all on function private.valid_settings(jsonb),private.supports_settings(jsonb,jsonb),private.may_upload(text) from public;
grant execute on function private.may_upload(text) to authenticated;
grant select on public.request_files to service_role;
do $$begin
 if to_regclass('storage.objects') is not null then
 execute 'drop policy if exists print_owner_upload on storage.objects';
 execute $policy$create policy print_owner_upload on storage.objects for insert to authenticated with check(bucket_id='print-originals' and private.may_upload(name))$policy$;
 end if;
end$$;


create or replace function private.eligible(p uuid,r uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.provider_private_profiles pp join public.print_requests pr on pr.id=r join public.service_zones z on z.id=pr.zone_id
 where pp.provider_id=p and pp.application_state='active' and pp.accepting_jobs and z.active and pp.zone_id=pr.zone_id
 and (case when pr.mode='pickup' then pp.pickup_enabled else pp.delivery_enabled end)
 and private.supports_settings(pr.settings,pp.capabilities) and private.within_pickup_radius(p,r)
 and exists(select 1 from public.provider_members m join public.profiles u on u.user_id=m.user_id where m.provider_id=p and u.account_status='active'))
$$;
alter table public.request_files add column purge_error text;
create table public.conversation_reads(order_id uuid not null references public.orders(id),user_id uuid not null references public.profiles(user_id),last_read_at timestamptz not null,primary key(order_id,user_id));
alter table public.conversation_reads enable row level security;
revoke all on public.conversation_reads from anon,authenticated;
grant select on public.conversation_reads to authenticated;
create policy participant_read_receipts on public.conversation_reads for select to authenticated using(private.order_participant(order_id));


create or replace function public.marketplace_read(p_kind text,p_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); provider uuid:=private.my_provider(); r public.print_requests; o public.orders; result jsonb;
begin
 if actor is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_kind='session' then
 return jsonb_build_object('user',(select to_jsonb(u) from public.profiles u where user_id=actor),'provider',(select jsonb_build_object('id',pp.id,'display_name',pp.display_name,'state',pr.application_state,'capabilities',pr.capabilities,'hours',pr.operating_hours,'accepting',pr.accepting_jobs,'zone_id',pr.zone_id,'pickup_lat',pp.pickup_lat,'pickup_lng',pp.pickup_lng) from public.provider_public_profiles pp join public.provider_private_profiles pr on pr.provider_id=pp.id where pp.id=provider),'admin',private.is_admin(),'zones',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name)) from public.service_zones where active),'[]'::jsonb),'address',(select to_jsonb(d)-'owner_id' from public.customer_addresses d where owner_id=actor and is_default limit 1),'server_now',clock_timestamp());
 elsif p_kind='history' then
 return jsonb_build_object('offers',coalesce((select jsonb_agg(jsonb_build_object('id',my_offer.id,'request_id',my_offer.request_id,'title',pr.title,'status',case when my_offer.status='active' and my_offer.expires_at<=clock_timestamp() then 'expired' else my_offer.status end,'total_paisa',my_offer.total_paisa,'duration_minutes',my_offer.duration_minutes,'order_id',(select id from public.orders where accepted_offer_id=my_offer.id)) order by my_offer.created_at desc) from public.offers my_offer join public.print_requests pr on pr.id=my_offer.request_id where my_offer.provider_id=provider),'[]'),'requests',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc) from(select id,title,state,mode,urgency,total_sides,created_at,expires_at from public.print_requests where customer_id=actor order by created_at desc limit 100)t),'[]'),'orders',coalesce((select jsonb_agg(to_jsonb(t) order by t.accepted_at desc) from(select id,status,mode,price_snapshot,due_at,accepted_at,spec_snapshot->>'title' title from public.orders where customer_id=actor or provider_id=provider order by accepted_at desc limit 100)t),'[]'));
 elsif p_kind='feed' then
 if not private.actor_active() or not exists(select 1 from public.provider_private_profiles where provider_id=provider and application_state='active') then raise exception 'PROVIDER_PENDING';end if;
 return jsonb_build_object('requests',coalesce((select jsonb_agg(jsonb_build_object('id',pr.id,'title',pr.title,'mode',pr.mode,'urgency',pr.urgency,'area',pr.area,'total_sides',pr.total_sides,'settings',pr.settings,'expires_at',pr.expires_at,'created_at',pr.created_at)) from public.print_requests pr where state='open' and expires_at>clock_timestamp() and customer_id<>actor and private.eligible(provider,pr.id)),'[]'),'server_now',clock_timestamp());
 elsif p_kind='request' then
 select * into r from public.print_requests where id=p_id;
 if r.id is null then raise exception 'NOT_FOUND';end if;
 if r.customer_id<>actor and not exists(select 1 from public.orders where request_id=r.id and provider_id=provider) and not(r.state='open' and r.expires_at>clock_timestamp() and private.actor_active() and private.eligible(provider,r.id)) then raise exception 'FORBIDDEN';end if;
 result=jsonb_build_object('id',r.id,'title',r.title,'state',r.state,'revision',r.revision,'mine',r.customer_id=actor,'mode',r.mode,'urgency',r.urgency,'area',r.area,'settings',r.settings,'instructions',r.instructions,'total_sides',r.total_sides,'sheets',r.sheets,'latest_needed_at',r.latest_needed_at,'expires_at',r.expires_at,'server_now',clock_timestamp(),
 'files',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',original_name,'kind',kind,'pages',page_count,'bytes',byte_count,'state',processing_state,'error',error,'pixel_width',pixel_width,'pixel_height',pixel_height) order by created_at) from public.request_files where request_id=r.id and processing_state not in('deleted','deleting')),'[]'),
 'offers',coalesce((select jsonb_agg(jsonb_build_object('id',ofr.id,'provider_id',ofr.provider_id,'provider_name',pp.display_name,'pickup_address',case when r.mode='pickup' then pp.public_pickup_address else null end,'print_paisa',print_paisa,'delivery_paisa',delivery_paisa,'total_paisa',total_paisa,'duration_minutes',duration_minutes,'payment_method',payment_method,'status',case when status='active' and ofr.expires_at<=clock_timestamp() then 'expired' else status end,'expires_at',ofr.expires_at,'note',note,'created_at',ofr.created_at) order by ofr.created_at desc) from public.offers ofr join public.provider_public_profiles pp on pp.id=ofr.provider_id where ofr.request_id=r.id and (r.customer_id=actor or ofr.provider_id=provider)),'[]'),
 'clarifications',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'category',c.category,'provider_name',pp.display_name)) from public.request_clarifications c join public.provider_public_profiles pp on pp.id=c.provider_id where c.request_id=r.id and c.revision=r.revision and (r.customer_id=actor or c.provider_id=provider)),'[]'),'order_id',(select id from public.orders where request_id=r.id));
 if r.customer_id=actor then result=result||jsonb_build_object('destination',(select to_jsonb(d)-'request_id' from public.request_private_destinations d where request_id=r.id));end if;
 return result;
 elsif p_kind='order' then
 select * into o from public.orders where id=p_id;
 if o.id is null then raise exception 'NOT_FOUND';end if;
 if not private.order_participant(o.id) then raise exception 'FORBIDDEN';end if;
 return to_jsonb(o)-'customer_id'||jsonb_build_object('mine',o.customer_id=actor,'provider_name',(select display_name from public.provider_public_profiles where id=o.provider_id),'contacts',(select contacts from public.order_contact_snapshots where order_id=o.id),'messages',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'mine',sender_id=actor,'body',body,'created_at',m.created_at,'sender_name',u.display_name) order by m.created_at,m.id) from (select * from public.messages where order_id=o.id order by created_at desc,id desc limit 100)m join public.profiles u on u.user_id=m.sender_id where order_id=o.id),'[]'),'other_read_at',(select max(last_read_at) from public.conversation_reads where order_id=o.id and user_id<>actor),'events',coalesce((select jsonb_agg(jsonb_build_object('id',id,'kind',event_type,'created_at',created_at,'details',safe_payload) order by created_at) from public.order_events where order_id=o.id),'[]'),'issues',coalesce((select jsonb_agg(jsonb_build_object('id',id,'category',category,'description',description,'state',state,'resolution',resolution)) from public.support_cases where order_id=o.id),'[]'),'server_now',clock_timestamp());
 elsif p_kind like 'messages|%' then
 if not private.order_participant(p_id) then raise exception 'FORBIDDEN';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'mine',m.sender_id=actor,'body',m.body,'created_at',m.created_at,'sender_name',u.display_name) order by m.created_at,m.id) from (select * from public.messages where order_id=p_id and (created_at,id)<(split_part(p_kind,'|',2)::timestamptz,split_part(p_kind,'|',3)::uuid) order by created_at desc,id desc limit 100)m join public.profiles u on u.user_id=m.sender_id),'[]');
 elsif p_kind='notifications' then
 return coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc) from(select id,kind,entity_id,read_at,created_at from public.notifications where recipient_id=actor order by created_at desc limit 100)t),'[]');
 elsif p_kind='case' then
 perform private.require_admin();
 select * into o from public.orders where id=(select order_id from public.support_cases where id=p_id);
 if o.id is null then raise exception 'NOT_FOUND';end if;
 insert into public.admin_audit(actor_id,action,target_id,reason) values(actor,'support_review',p_id,'Case-scoped support review');
 return jsonb_build_object('case',(select to_jsonb(c) from public.support_cases c where id=p_id),'order',to_jsonb(o)-'customer_id','contacts',(select contacts from public.order_contact_snapshots where order_id=o.id),'files',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',original_name,'state',processing_state)) from public.request_files where request_id=o.request_id),'[]'),'messages',coalesce((select jsonb_agg(jsonb_build_object('body',body,'created_at',created_at)) from(select body,created_at from public.messages where order_id=o.id order by created_at desc limit 100)m),'[]'));
 elsif p_kind='admin' then
 perform private.require_admin();
 return jsonb_build_object('providers',coalesce((select jsonb_agg(jsonb_build_object('id',pp.id,'name',pp.display_name,'type',pp.business_type,'state',pr.application_state,'contact',pr.responsible_contact,'phone',pr.contact_phone,'address',pr.production_address,'zone_id',pr.zone_id,'capabilities',pr.capabilities,'hours',pr.operating_hours)) from public.provider_public_profiles pp join public.provider_private_profiles pr on pr.provider_id=pp.id),'[]'),'issues',coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at desc) from public.support_cases s),'[]'),'cleanup',coalesce((select jsonb_agg(jsonb_build_object('id',id,'error',purge_error)) from public.request_files where purge_error is not null),'[]'),'jobs',coalesce((select jsonb_agg(jsonb_build_object('id',id,'state',state,'attempts',attempts,'error',last_error)) from public.file_jobs where state='failed'),'[]'),'audit',coalesce((select jsonb_agg(to_jsonb(a)) from(select * from public.admin_audit order by created_at desc limit 100)a),'[]'));
 end if;
 raise exception 'INVALID_OPERATION';
end$$;

create or replace function public.marketplace_mutate(p_action text,p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); provider uuid:=private.my_provider(); provider_lock uuid; target uuid; r public.print_requests; ofr public.offers; ord public.orders;
 f public.request_files; now_at timestamptz; result_id uuid; mode_value text; allowed boolean; spec jsonb; copies integer; pages integer; sides integer:=0; sheet_total integer:=0; status_value text; details jsonb; destination jsonb;
begin
 if actor is null then raise exception 'AUTH_REQUIRED';end if;
 if p_action in('create_request','register_file','finalize_file','publish','edit_request','offer','clarify','provider_settings','onboard') and not private.actor_active() then raise exception 'FORBIDDEN';end if;
 if p_action in('create_request','onboard','provider_settings') then
  if (nullif(coalesce(p_input->'coordinates'->>'lat',p_input->>'lat'),'') is null)<>(nullif(coalesce(p_input->'coordinates'->>'lng',p_input->>'lng'),'') is null) then raise exception 'INVALID_LOCATION';end if;
 end if;
 if p_action='mark_order_read' then
  if not private.order_participant((p_input->>'id')::uuid) then raise exception 'FORBIDDEN';end if;
  insert into public.conversation_reads(order_id,user_id,last_read_at) values((p_input->>'id')::uuid,actor,clock_timestamp()) on conflict(order_id,user_id) do update set last_read_at=excluded.last_read_at;return jsonb_build_object('ok',true);
 elsif p_action='forget_address' then delete from public.customer_addresses where owner_id=actor;return jsonb_build_object('ok',true);
 elsif p_action='apply_provider' then
  result_id=public.apply_as_provider(p_input->>'name',p_input->>'type',p_input->>'contact',p_input->>'phone',p_input->>'address',(p_input->>'pickup')::boolean,(p_input->>'delivery')::boolean,(p_input->>'consent')::boolean);
  return jsonb_build_object('id',result_id);
 elsif p_action='notification_read' then
  update public.notifications set read_at=clock_timestamp() where recipient_id=actor and (p_input->>'id' is null or id=(p_input->>'id')::uuid);return jsonb_build_object('ok',true);
 elsif p_action='onboard' then
  if char_length(btrim(p_input->>'name')) not between 2 and 100 or char_length(p_input->>'phone') not between 7 and 25 then raise exception 'INVALID_PROFILE';end if;
  update public.profiles set display_name=btrim(p_input->>'name'),contact_phone=p_input->>'phone',preferred_fulfillment=p_input->>'mode' where user_id=actor;
  if p_input->>'mode'='delivery' then
   update public.customer_addresses set is_default=false where owner_id=actor;
   insert into public.customer_addresses(owner_id,recipient_name,phone,full_address,landmark,lat,lng) values(actor,p_input->>'name',p_input->>'phone',p_input->>'address',coalesce(p_input->>'landmark',''),nullif(p_input->>'lat','')::double precision,nullif(p_input->>'lng','')::double precision);
  end if;
  return jsonb_build_object('ok',true);
 elsif p_action='provider_settings' then
  if provider is null then raise exception 'FORBIDDEN';end if;
  perform 1 from public.provider_private_profiles where provider_id=provider for update;
  if not coalesce(jsonb_typeof(p_input->'capabilities'->'sizes')='array' and jsonb_typeof(p_input->'capabilities'->'colors')='array' and jsonb_typeof(p_input->'capabilities'->'finishing')='array' and jsonb_typeof(p_input->'capabilities'->'duplex')='boolean' and char_length(p_input->>'hours') between 2 and 300,false) then raise exception 'INVALID_SETTINGS';end if;
  if not (p_input->'capabilities'->'sizes' <@ '["A4","A3"]'::jsonb) or not (p_input->'capabilities'->'colors' <@ '["bw","color"]'::jsonb) or not (p_input->'capabilities'->'finishing' <@ '["loose","stapled"]'::jsonb) then raise exception 'INVALID_SETTINGS';end if;
  update public.provider_private_profiles set capabilities=p_input->'capabilities',operating_hours=p_input->>'hours',accepting_jobs=coalesce((p_input->>'accepting')::boolean,true) where provider_id=provider;
  if nullif(p_input->'coordinates'->>'lat','') is not null and exists(select 1 from public.provider_public_profiles where id=provider and (pickup_lat is distinct from (p_input->'coordinates'->>'lat')::double precision or pickup_lng is distinct from (p_input->'coordinates'->>'lng')::double precision)) then
   update public.provider_private_profiles set application_state=case when application_state='active' then 'pending' else application_state end where provider_id=provider;
  end if;
  update public.provider_public_profiles set pickup_lat=coalesce(nullif(p_input->'coordinates'->>'lat','')::double precision,pickup_lat),pickup_lng=coalesce(nullif(p_input->'coordinates'->>'lng','')::double precision,pickup_lng) where id=provider;
  return jsonb_build_object('ok',true);
 elsif p_action='create_request' then
  if exists(select 1 from public.profiles where user_id=actor and (display_name='' or contact_phone is null)) then raise exception 'PROFILE_REQUIRED';end if;
  select id into result_id from public.print_requests where customer_id=actor and client_key=(p_input->>'key')::uuid;
  if result_id is not null then return jsonb_build_object('id',result_id);end if;
  if (select count(*) from public.print_requests where customer_id=actor and created_at>clock_timestamp()-interval '1 hour')>=10 then raise exception 'RATE_LIMITED';end if;
  if not private.valid_settings(p_input->'settings') then raise exception 'INVALID_SETTINGS';end if;
  if not exists(select 1 from public.service_zones where id=(p_input->>'zone_id')::uuid and active) then raise exception 'INVALID_ZONE';end if;
  if p_input->'settings'->>'size' not in('A4','A3') or p_input->'settings'->>'color' not in('bw','color') or p_input->'settings'->>'finishing' not in('loose','stapled') or (p_input->'settings'->>'copies')::integer not between 1 and 200 or jsonb_typeof(p_input->'settings'->'duplex')<>'boolean' then raise exception 'INVALID_SETTINGS';end if;
  if p_input->>'mode'='delivery' and (coalesce(char_length(p_input->'destination'->>'address'),0)<5 or coalesce(char_length(p_input->'destination'->>'phone'),0)<7) then raise exception 'ADDRESS_REQUIRED';end if;
  insert into public.print_requests(customer_id,client_key,title,mode,urgency,zone_id,area,settings,instructions,latest_needed_at) values(actor,(p_input->>'key')::uuid,p_input->>'title',p_input->>'mode',p_input->>'urgency',(p_input->>'zone_id')::uuid,p_input->>'area',p_input->'settings',coalesce(p_input->>'instructions',''),nullif(p_input->>'latest_needed_at','')::timestamptz) returning id into result_id;
  if p_input->>'mode'='delivery' then insert into public.request_private_destinations(request_id,recipient_name,phone,address,landmark) values(result_id,p_input->'destination'->>'name',p_input->'destination'->>'phone',p_input->'destination'->>'address',coalesce(p_input->'destination'->>'landmark',''));end if;
  if p_input->>'mode'='pickup' then insert into public.request_private_destinations(request_id) values(result_id);end if;
  update public.request_private_destinations set lat=nullif(p_input->'coordinates'->>'lat','')::double precision,lng=nullif(p_input->'coordinates'->>'lng','')::double precision,radius_km=case when p_input->>'mode'='pickup' then (p_input->>'radius_km')::integer else null end where request_id=result_id;
  return jsonb_build_object('id',result_id);
 end if;
 if p_action in('admin_provider','admin_resolve','admin_zone') then
  perform private.require_admin();
  if char_length(btrim(coalesce(p_input->>'reason',''))) <5 then raise exception 'REASON_REQUIRED';end if;
  if p_action='admin_zone' then
   insert into public.service_zones(name,active) values(p_input->>'name',true) on conflict(name) do update set active=true returning id into result_id;
   insert into public.admin_audit(actor_id,action,target_id,reason) values(actor,p_action,result_id,p_input->>'reason');return jsonb_build_object('id',result_id);
  elsif p_action='admin_provider' then
   provider_lock=(p_input->>'id')::uuid;
   perform 1 from public.provider_private_profiles where provider_id=provider_lock for update;
   if not found then raise exception 'NOT_FOUND';end if;
   if p_input->>'state' not in('active','restricted','suspended','rejected') then raise exception 'INVALID_STATE';end if;
   if p_input->>'state'='active' and (not exists(select 1 from public.service_zones where id=(p_input->>'zone_id')::uuid and active) or exists(select 1 from public.provider_private_profiles where provider_id=provider_lock and (operating_hours='' or jsonb_array_length(capabilities->'sizes')=0 or jsonb_array_length(capabilities->'colors')=0))) then raise exception 'PROVIDER_SETUP_REQUIRED';end if;
   update public.provider_private_profiles set application_state=p_input->>'state',zone_id=coalesce((p_input->>'zone_id')::uuid,zone_id),verification_notes=p_input->>'reason' where provider_id=provider_lock;
   insert into public.admin_audit(actor_id,action,target_id,reason) values(actor,p_action,provider_lock,p_input->>'reason');return jsonb_build_object('ok',true);
  end if;
 end if;
 if p_action='file_access' then
  select * into f from public.request_files where id=(p_input->>'id')::uuid;
  if f.id is null or f.processing_state<>'ready' then raise exception 'FILE_NOT_READY';end if;
  select * into r from public.print_requests where id=f.request_id;
  allowed=false;
  if private.is_admin() and p_input->>'case_id' is not null then
   perform private.require_admin();
   allowed=exists(select 1 from public.support_cases c join public.orders case_order on case_order.id=c.order_id where c.id=(p_input->>'case_id')::uuid and c.state='open' and case_order.request_id=r.id);
  end if;
  if not(allowed or r.customer_id=actor or (r.state='open' and r.expires_at>clock_timestamp() and private.actor_active() and private.eligible(provider,r.id)) or exists(select 1 from public.orders where request_id=r.id and (customer_id=actor or provider_id=provider))) then raise exception 'FORBIDDEN';end if;
  insert into public.document_access_events(file_id,actor_id,purpose) values(f.id,actor,case when allowed then 'support' when r.customer_id=actor then 'owner' when r.state='open' then 'quotation' else 'fulfillment' end);
  return jsonb_build_object('id',f.id,'name',f.original_name,'kind',f.kind);
 end if;
 -- Resolve immutable IDs before taking locks. Provider -> request -> offer/order everywhere.
 if p_action in('publish','edit_request','offer','accept') and p_input->>'revision' is null then raise exception 'REVISION_CHANGED';end if;
 if p_action='transition' and p_input->>'version' is null then raise exception 'REVISION_CHANGED';end if;
 if p_action in('accept','withdraw','decline') then select * into ofr from public.offers where id=(p_input->>'id')::uuid;target=ofr.request_id;provider_lock=ofr.provider_id;
 elsif p_action in('transition','message','payment','issue') then select * into ord from public.orders where id=(p_input->>'id')::uuid;target=ord.request_id;provider_lock=ord.provider_id;
 elsif p_action='admin_resolve' then select * into ord from public.orders where id=(select order_id from public.support_cases where id=(p_input->>'id')::uuid);target=ord.request_id;provider_lock=ord.provider_id;
 elsif p_action in('finalize_file','remove_file') then select * into f from public.request_files where id=(p_input->>'id')::uuid;target=f.request_id;
 else target=(p_input->>'id')::uuid;if p_action in('offer','clarify') then provider_lock=provider;end if;
 end if;
 if provider_lock is not null then perform 1 from public.provider_private_profiles where provider_id=provider_lock for update;end if;
 select * into r from public.print_requests where id=target for update;
 if r.id is null then raise exception 'NOT_FOUND';end if;
 now_at=clock_timestamp();
 if p_action in('register_file','finalize_file','remove_file','publish','edit_request','cancel_request') and r.customer_id<>actor then raise exception 'FORBIDDEN';end if;
 if p_action='register_file' then
  if r.state<>'draft' then raise exception 'REQUEST_CLOSED';end if;
  if (select count(*) from public.request_files where request_id=r.id and processing_state<>'deleted')>=3 then raise exception 'LIMIT_EXCEEDED';end if;
  if coalesce((select sum(byte_count) from public.request_files where request_id=r.id and processing_state<>'deleted'),0)+(p_input->>'bytes')::integer>78643200 then raise exception 'LIMIT_EXCEEDED';end if;
  result_id=gen_random_uuid();
  insert into public.request_files(id,request_id,owner_id,original_name,kind,byte_count,object_key) values(result_id,r.id,actor,p_input->>'name',p_input->>'kind',(p_input->>'bytes')::integer,actor::text||'/'||r.id::text||'/'||result_id::text||'.original');
  return jsonb_build_object('id',result_id);
 elsif p_action='remove_file' then
  if r.state<>'draft' then raise exception 'REQUEST_CLOSED';end if;
  if f.processing_state='processing' then raise exception 'FILE_PROCESSING';end if;
  update public.request_files set processing_state='deleting',delete_after=now_at where id=f.id;
  update public.print_requests set settings=jsonb_set(settings,'{files}',coalesce(settings->'files','{}'::jsonb)-(f.id::text)) where id=r.id;return jsonb_build_object('ok',true);
 elsif p_action='finalize_file' then
  if r.state<>'draft' then raise exception 'REQUEST_CLOSED';end if;
  insert into public.file_jobs(file_id) values(f.id) on conflict(file_id) do nothing;return jsonb_build_object('id',f.id);
 elsif p_action='edit_request' then
  if r.state not in('draft','open') then raise exception 'REQUEST_CLOSED';end if;
  if r.revision<>(p_input->>'revision')::integer then raise exception 'REVISION_CHANGED';end if;
  if p_input?'settings' and not private.valid_settings(p_input->'settings') then raise exception 'INVALID_SETTINGS';end if;
  update public.offers set status='invalidated' where request_id=r.id and status='active';
  update public.print_requests set state='draft',revision=revision+1,settings=coalesce(p_input->'settings',settings),title=coalesce(p_input->>'title',title),instructions=coalesce(p_input->>'instructions',instructions),expires_at=null,consent_at=null where id=r.id;
  return jsonb_build_object('id',r.id);
 elsif p_action='cancel_request' then
  if r.state not in('draft','open') then raise exception 'REQUEST_CLOSED';end if;
  update public.print_requests set state='cancelled' where id=r.id;update public.offers set status='invalidated' where request_id=r.id and status='active';
  update public.request_files set delete_after=now_at+interval '24 hours' where request_id=r.id;
  return jsonb_build_object('ok',true);
 elsif p_action='publish' then
  if r.state='open' and r.revision=(p_input->>'revision')::integer then return jsonb_build_object('id',r.id);end if;
  if r.state<>'draft' or r.revision<>(p_input->>'revision')::integer then raise exception 'REVISION_CHANGED';end if;
  if p_input->>'consent'<>'file-sharing-v1' then raise exception 'CONSENT_REQUIRED';end if;
  if not exists(select 1 from public.request_files where request_id=r.id and processing_state not in('deleted','deleting')) or exists(select 1 from public.request_files where request_id=r.id and processing_state not in('ready','deleted','deleting')) then raise exception 'FILE_NOT_READY';end if;
  for f in select * from public.request_files where request_id=r.id and processing_state='ready' loop
   spec=r.settings||coalesce(r.settings->'files'->(f.id::text),'{}');
   copies=(spec->>'copies')::integer;
   if copies is null or copies not between 1 and 200 or spec->>'size' not in('A4','A3') or spec->>'color' not in('bw','color') or spec->>'finishing' not in('loose','stapled') or jsonb_typeof(spec->'duplex')<>'boolean' then raise exception 'INVALID_SETTINGS';end if;
   if not private.valid_settings(spec) then raise exception 'INVALID_SETTINGS';end if;
   pages=private.page_count(spec->>'pages',f.page_count);sides=sides+pages*copies;sheet_total=sheet_total+(case when (spec->>'duplex')::boolean then (pages+1)/2 else pages end)*copies;
  end loop;
  if sides not between 1 and 200 then raise exception 'LIMIT_EXCEEDED';end if;
  if r.latest_needed_at is not null and r.latest_needed_at<=now_at+interval '5 minutes' then raise exception 'DEADLINE_UNACHIEVABLE';end if;
  insert into public.request_revisions(request_id,revision,snapshot) values(r.id,r.revision,jsonb_build_object('settings',r.settings,'instructions',r.instructions,'sides',sides,'sheets',sheet_total));
  update public.print_requests set state='open',published_at=now_at,consent_at=now_at,total_sides=sides,sheets=sheet_total,expires_at=least(now_at+case when urgency='urgent' then interval '30 minutes' else interval '2 hours' end,coalesce(latest_needed_at,'infinity'::timestamptz)) where id=r.id;
  insert into public.notifications(recipient_id,kind,entity_id) select m.user_id,'new_request',r.id from public.provider_members m where m.user_id<>actor and private.eligible(m.provider_id,r.id);
  return jsonb_build_object('id',r.id);
 elsif p_action='clarify' then
  if provider is null or not private.actor_active() or not private.eligible(provider,r.id) or r.customer_id=actor then raise exception 'FORBIDDEN';end if;
  if r.state<>'open' or r.expires_at<=now_at then raise exception 'REQUEST_CLOSED';end if;
  insert into public.request_clarifications(request_id,provider_id,revision,category) values(r.id,provider,r.revision,p_input->>'category') on conflict(request_id,provider_id,revision,category) do update set category=excluded.category returning id into result_id;
  insert into public.notifications(recipient_id,kind,entity_id) values(r.customer_id,'clarification_requested',r.id);return jsonb_build_object('id',result_id);
 elsif p_action='offer' then
  if provider is null or not private.eligible(provider,r.id) or r.customer_id=actor then raise exception 'FORBIDDEN';end if;
  if r.state<>'open' or r.expires_at<=now_at then raise exception 'REQUEST_CLOSED';end if;
  if r.revision<>(p_input->>'revision')::integer then raise exception 'REVISION_CHANGED';end if;
  select * into ofr from public.offers where provider_id=provider and client_key=(p_input->>'key')::uuid;
  if ofr.id is not null then
   if ofr.request_id<>r.id or ofr.print_paisa<>(p_input->>'print_paisa')::integer or ofr.delivery_paisa<>(p_input->>'delivery_paisa')::integer or ofr.duration_minutes<>(p_input->>'duration_minutes')::integer or ofr.payment_method<>p_input->>'payment_method' or ofr.note<>coalesce(p_input->>'note','') then raise exception 'IDEMPOTENCY_CONFLICT';end if;
   return jsonb_build_object('id',ofr.id);end if;
  if r.expires_at<now_at+interval '5 minutes' then raise exception 'OFFER_WINDOW_TOO_SHORT';end if;
  if r.mode='pickup' and (p_input->>'delivery_paisa')::integer<>0 then raise exception 'INVALID_DELIVERY_PRICE';end if;
  if r.latest_needed_at is not null and now_at+make_interval(mins=>(p_input->>'duration_minutes')::integer)>r.latest_needed_at then raise exception 'DEADLINE_UNACHIEVABLE';end if;
  if (select count(*) from public.offers where provider_id=provider and created_at>now_at-interval '1 hour')>=60 then raise exception 'RATE_LIMITED';end if;
  update public.offers set status=case when expires_at<=now_at then 'expired' else 'withdrawn' end where request_id=r.id and provider_id=provider and status='active';
  insert into public.offers(request_id,revision,provider_id,client_key,print_paisa,delivery_paisa,duration_minutes,payment_method,note,created_at,expires_at) values(r.id,r.revision,provider,(p_input->>'key')::uuid,(p_input->>'print_paisa')::integer,(p_input->>'delivery_paisa')::integer,(p_input->>'duration_minutes')::integer,p_input->>'payment_method',coalesce(p_input->>'note',''),now_at,now_at+interval '5 minutes') returning id into result_id;
  insert into public.notifications(recipient_id,kind,entity_id) values(r.customer_id,'new_offer',r.id);return jsonb_build_object('id',result_id);
 elsif p_action in('accept','withdraw','decline') then
  select * into ofr from public.offers where id=ofr.id for update;
  now_at=clock_timestamp();
  if p_action='withdraw' then
   if ofr.provider_id<>provider then raise exception 'FORBIDDEN';end if;
   if ofr.status<>'active' then raise exception 'OFFER_WITHDRAWN';end if;
   update public.offers set status='withdrawn' where id=ofr.id;return jsonb_build_object('ok',true);
  end if;
  if r.customer_id<>actor then raise exception 'FORBIDDEN';end if;
  if p_action='decline' then update public.offers set status='declined' where id=ofr.id and status='active';return jsonb_build_object('ok',true);end if;
  select * into ord from public.orders where accepted_offer_id=ofr.id and customer_id=actor;
  if ord.id is not null then return jsonb_build_object('id',ord.id);end if;
  if r.state='matched' then raise exception 'REQUEST_ALREADY_MATCHED';end if;
  if r.state<>'open' or r.expires_at<=now_at then raise exception 'REQUEST_CLOSED';end if;
  if not private.actor_active() or not private.eligible(ofr.provider_id,r.id) or private.is_provider_member(ofr.provider_id) then raise exception 'FORBIDDEN';end if;
  if r.revision<>(p_input->>'revision')::integer or ofr.revision<>r.revision then raise exception 'REVISION_CHANGED';end if;
  if ofr.status<>'active' then raise exception 'OFFER_WITHDRAWN';end if;
  if ofr.expires_at<=now_at then raise exception 'OFFER_EXPIRED';end if;
  if r.latest_needed_at is not null and now_at+make_interval(mins=>ofr.duration_minutes)>r.latest_needed_at then raise exception 'DEADLINE_UNACHIEVABLE';end if;
  details=jsonb_build_object('print_paisa',ofr.print_paisa,'delivery_paisa',ofr.delivery_paisa,'total_paisa',ofr.total_paisa,'payment_method',ofr.payment_method,'commission_bps',0,'platform_fee_paisa',0);
  insert into public.orders(request_id,accepted_offer_id,customer_id,provider_id,mode,spec_snapshot,price_snapshot,accepted_at,due_at) values(r.id,ofr.id,actor,ofr.provider_id,r.mode,jsonb_build_object('title',r.title,'settings',r.settings,'instructions',r.instructions,'sides',r.total_sides,'sheets',r.sheets,'revision',r.revision),details,now_at,now_at+make_interval(mins=>ofr.duration_minutes)) returning id into result_id;
  select jsonb_build_object('provider_name',pp.display_name,'provider_phone',pv.contact_phone,'pickup_address',pp.public_pickup_address,'hours',pv.operating_hours,'customer_name',u.display_name,'customer_phone',u.contact_phone) into destination from public.provider_public_profiles pp join public.provider_private_profiles pv on pv.provider_id=pp.id join public.profiles u on u.user_id=actor where pp.id=ofr.provider_id;
  if r.mode='delivery' then destination=destination||jsonb_build_object('delivery',(select to_jsonb(d)-'request_id' from public.request_private_destinations d where request_id=r.id));end if;
  insert into public.order_contact_snapshots(order_id,contacts) values(result_id,destination);
  update public.offers set status=case when id=ofr.id then 'accepted' else 'not_selected' end where request_id=r.id and status='active';
  update public.print_requests set state='matched' where id=r.id;
  update public.request_files set delete_after='infinity'::timestamptz where request_id=r.id;
  insert into public.order_events(order_id,actor_id,event_type) values(result_id,actor,'confirmed');
  insert into public.notifications(recipient_id,kind,entity_id) select user_id,'order_confirmed',result_id from public.provider_members where provider_id=ofr.provider_id;
  return jsonb_build_object('id',result_id);
 end if;
 if p_action in('transition','message','payment','issue','admin_resolve') then
  select * into ord from public.orders where id=ord.id for update;
  if p_action<>'admin_resolve' and not private.order_participant(ord.id) then raise exception 'FORBIDDEN';end if;
  if p_action='message' then
   if (select count(*) from public.messages where sender_id=actor and created_at>clock_timestamp()-interval '1 minute')>=60 then raise exception 'RATE_LIMITED';end if;
   select id into result_id from public.messages where sender_id=actor and client_message_id=(p_input->>'key')::uuid;
   if result_id is not null then
    if not exists(select 1 from public.messages where id=result_id and order_id=ord.id and body=btrim(p_input->>'body')) then raise exception 'IDEMPOTENCY_CONFLICT';end if;
    return jsonb_build_object('id',result_id);end if;
   insert into public.messages(order_id,sender_id,client_message_id,body) values(ord.id,actor,(p_input->>'key')::uuid,btrim(p_input->>'body')) returning id into result_id;
   insert into public.notifications(recipient_id,kind,entity_id) select user_id,'new_message',ord.id from public.profiles where user_id<>actor and (user_id=ord.customer_id or user_id in(select user_id from public.provider_members where provider_id=ord.provider_id));
   return jsonb_build_object('id',result_id);
  elsif p_action='payment' then
   if actor=ord.customer_id then
    if p_input->>'assertion' not in('paid','not_paid') then raise exception 'INVALID_PAYMENT_REPORT';end if;
    update public.orders set customer_payment=p_input->>'assertion' where id=ord.id;
   else
    if p_input->>'assertion' not in('received','not_received') then raise exception 'INVALID_PAYMENT_REPORT';end if;
    update public.orders set provider_payment=p_input->>'assertion' where id=ord.id;
   end if;
   insert into public.order_events(order_id,actor_id,event_type,safe_payload) values(ord.id,actor,'payment_reported',jsonb_build_object('assertion',p_input->>'assertion'));return jsonb_build_object('ok',true);
  elsif p_action='issue' then
   if p_input->>'category' not in('wrong_output','damaged_delivery','missed_deadline','nonpayment','cancellation','other') then raise exception 'INVALID_ISSUE';end if;
   insert into public.support_cases(order_id,reporter_id,category,description) values(ord.id,actor,p_input->>'category',p_input->>'description') returning id into result_id;
   insert into public.file_retention_holds(file_id,case_id,expires_at) select id,result_id,now_at+interval '7 days' from public.request_files where request_id=r.id and processing_state not in('deleting','deleted');
   update public.orders set issue_status='open' where id=ord.id;
   insert into public.order_events(order_id,actor_id,event_type) values(ord.id,actor,'issue_reported');return jsonb_build_object('id',result_id);
  elsif p_action='admin_resolve' then
   update public.support_cases set state='resolved',resolution=p_input->>'reason',resolved_at=now_at where id=(p_input->>'id')::uuid;
   delete from public.file_retention_holds where case_id=(p_input->>'id')::uuid;
   if p_input->>'order_status' in('completed','cancelled') then
    update public.orders set status=p_input->>'order_status',closed_at=now_at,row_version=row_version+1 where id=ord.id;
    update public.request_files set delete_after=now_at+interval '7 days' where request_id=r.id;
    insert into public.order_events(order_id,actor_id,event_type,safe_payload) values(ord.id,actor,'admin_resolution',jsonb_build_object('status',p_input->>'order_status','reason',p_input->>'reason'));
   end if;
   update public.orders set issue_status=case when exists(select 1 from public.support_cases where order_id=ord.id and state='open') then 'open' else 'resolved' end where id=ord.id;
   insert into public.admin_audit(actor_id,action,target_id,reason) values(actor,p_action,ord.id,p_input->>'reason');return jsonb_build_object('ok',true);
  end if;
  if ord.row_version<>(p_input->>'version')::integer then raise exception 'REVISION_CHANGED';end if;
  status_value=p_input->>'status';
  allowed=false;
  if status_value='cancelled' then
   if ord.status<>'confirmed' then raise exception 'CANCELLATION_REQUIRES_SUPPORT';end if;
   if char_length(btrim(coalesce(p_input->>'reason','')))<5 then raise exception 'REASON_REQUIRED';end if;
   allowed=true;
  elsif status_value='completed' then allowed=ord.customer_id=actor and ord.status not in('cancelled','completed');
  elsif ord.provider_id=provider then
   if not private.actor_active() or not exists(select 1 from public.provider_private_profiles where provider_id=provider and application_state='active') then raise exception 'PROVIDER_RESTRICTED';end if;
   allowed=(ord.status='confirmed' and status_value='printing') or (ord.status='printing' and status_value='ready') or (ord.status='ready' and ord.mode='delivery' and status_value='out_for_delivery') or (status_value='handover_reported' and ((ord.mode='pickup' and ord.status='ready') or (ord.mode='delivery' and ord.status='out_for_delivery')));
  end if;
  if not allowed then raise exception 'INVALID_TRANSITION';end if;
  update public.orders set status=status_value,row_version=row_version+1,closed_at=case when status_value in('cancelled','completed') then now_at else null end where id=ord.id;
  if status_value in('cancelled','completed') then update public.request_files set delete_after=now_at+interval '7 days' where request_id=r.id;end if;
  insert into public.order_events(order_id,actor_id,event_type,safe_payload) values(ord.id,actor,status_value,jsonb_build_object('reason',p_input->>'reason'));
  insert into public.notifications(recipient_id,kind,entity_id) select u.user_id,'order_updated',ord.id from public.profiles u where u.user_id=ord.customer_id or u.user_id in(select user_id from public.provider_members where provider_id=ord.provider_id);
  return jsonb_build_object('ok',true);
 end if;
 raise exception 'INVALID_OPERATION';
end$$;
alter table public.request_files drop constraint request_files_processing_state_check;
alter table public.request_files add check(processing_state in('pending','processing','ready','failed','deleting','deleted'));

create or replace function public.marketplace_worker(p_action text,p_input jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.file_jobs; f public.request_files; r public.print_requests; expired_offer record;
begin
 if current_setting('role',true)<>'service_role' then raise exception 'FORBIDDEN';end if;
 if p_action='claim' then
  select * into j from public.file_jobs where (state='queued' or (state='running' and locked_until<clock_timestamp())) and attempts<3 order by created_at for update skip locked limit 1;
  if j.id is null then return null;end if;
  update public.file_jobs set state='running',attempts=attempts+1,locked_until=clock_timestamp()+interval '2 minutes' where id=j.id;
  update public.request_files set processing_state='processing' where id=j.file_id and processing_state in('pending','processing') returning * into f;
  if not found then update public.file_jobs set state='failed',last_error='File removed before processing' where id=j.id;return null;end if;
  return to_jsonb(f)||jsonb_build_object('job_id',j.id);
 elsif p_action='ready' then
  update public.request_files set processing_state='ready',page_count=(p_input->>'pages')::integer,checksum=p_input->>'checksum',pixel_width=(p_input->>'width')::integer,pixel_height=(p_input->>'height')::integer,derivative_key=p_input->>'derivative_key',preview_key=p_input->>'preview_key',error=null where id=(p_input->>'id')::uuid and processing_state='processing';
  update public.file_jobs set state='done',locked_until=null where file_id=(p_input->>'id')::uuid;return jsonb_build_object('ok',true);
 elsif p_action='failed' then
  update public.request_files set processing_state='failed',error='This file could not be safely processed. Try exporting a fresh PDF or image.' where id=(p_input->>'id')::uuid;
  update public.file_jobs set state='failed',last_error=left(p_input->>'error',500),locked_until=null where file_id=(p_input->>'id')::uuid;return jsonb_build_object('ok',true);
 elsif p_action='sweep' then
  for expired_offer in select id,provider_id,request_id from public.offers where status='active' and expires_at<=clock_timestamp() order by provider_id,request_id loop
   perform 1 from public.provider_private_profiles where provider_id=expired_offer.provider_id for update skip locked;
   if not found then continue;end if;
   perform 1 from public.print_requests where id=expired_offer.request_id for update skip locked;
   if not found then continue;end if;
   update public.offers set status='expired' where id=expired_offer.id and status='active';
  end loop;
  with exhausted as(update public.file_jobs set state='failed',last_error='Processing retry limit reached' where state='running' and locked_until<clock_timestamp() and attempts>=3 returning file_id)
  update public.request_files set processing_state='failed',error='Processing could not finish. Try a fresh export.' where id in(select file_id from exhausted);
  insert into public.notifications(recipient_id,kind,entity_id) select a.user_id,'order_stale',o.id from public.orders o cross join public.admin_users a where o.status not in('completed','cancelled') and o.accepted_at<clock_timestamp()-interval '7 days' and not exists(select 1 from public.notifications n where n.recipient_id=a.user_id and n.kind='order_stale' and n.entity_id=o.id);
  insert into public.notifications(recipient_id,kind,entity_id) select a.user_id,'order_review_due',o.id from public.orders o cross join public.admin_users a where o.status not in('completed','cancelled') and o.accepted_at<clock_timestamp()-interval '30 days' and not exists(select 1 from public.notifications n where n.recipient_id=a.user_id and n.kind='order_review_due' and n.entity_id=o.id);
  with expired as(update public.print_requests set state='expired' where state='open' and expires_at<=clock_timestamp() returning id,expires_at)
  update public.request_files target_file set delete_after=expired.expires_at+interval '24 hours' from expired where target_file.request_id=expired.id;
  return jsonb_build_object('ok',true);
 elsif p_action='retention' then
  for f in select * from public.request_files where (delete_after<=clock_timestamp() or processing_state='deleting') and processing_state not in('deleted','processing') order by delete_after limit 20 loop
   select * into r from public.print_requests where id=f.request_id for update skip locked;
   if r.id is null then continue;end if;
   if exists(select 1 from public.orders where request_id=r.id and status not in('completed','cancelled')) or exists(select 1 from public.file_retention_holds where file_id=f.id and (expires_at>clock_timestamp() or exists(select 1 from public.support_cases where id=case_id and state='open'))) then continue;end if;
   update public.request_files set processing_state='deleting' where id=f.id;
   return to_jsonb(f);
  end loop;
  return null;
 elsif p_action='retention_failed' then
  update public.request_files set purge_error='Storage deletion failed; retry scheduled.' where id=(p_input->>'id')::uuid;return jsonb_build_object('ok',true);
 elsif p_action='deleted' then
  update public.request_files set processing_state='deleted',purge_error=null where id=(p_input->>'id')::uuid and processing_state='deleting';return jsonb_build_object('ok',true);
 end if;
 raise exception 'INVALID_OPERATION';
end$$;

-- Only draft owners may upload originals. Providers cannot use Storage directly.
do $$begin
 if to_regclass('storage.buckets') is not null then
  insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('print-originals','print-originals',false,26214400,array['application/pdf','image/png','image/jpeg']),('print-previews','print-previews',false,104857600,array['application/pdf','image/png']) on conflict(id) do nothing;
 end if;
end$$;
do $$declare t text;begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
 foreach t in array array['messages','orders','offers','print_requests','notifications'] loop
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t);end if;
 end loop;end if;
end$$;

revoke all on function public.marketplace_read(text,uuid),public.marketplace_mutate(text,jsonb),public.marketplace_worker(text,jsonb) from public,anon,authenticated;
grant execute on function public.marketplace_read(text,uuid),public.marketplace_mutate(text,jsonb) to authenticated;
grant execute on function public.marketplace_worker(text,jsonb) to service_role;
revoke execute on function private.eligible(uuid,uuid) from authenticated;
