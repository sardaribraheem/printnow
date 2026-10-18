-- Initial identity boundary. Run through Supabase migrations, never through browser clients.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 100),
  contact_phone text check (char_length(contact_phone) between 7 and 25),
  phone_verified_at timestamptz,
  account_status text not null default 'active' check (account_status in ('active','restricted','suspended')),
  created_at timestamptz not null default now()
);
create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(user_id) on delete cascade default auth.uid(),
  label text not null default 'Default' check (char_length(label) between 1 and 60),
  recipient_name text not null check (char_length(recipient_name) between 1 and 100),
  phone text not null check (char_length(phone) between 7 and 25),
  full_address text not null check (char_length(full_address) between 5 and 1000),
  landmark text check (char_length(landmark) <= 300),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  is_default boolean not null default true,
  created_at timestamptz not null default now(),
  check ((lat is null) = (lng is null))
);
create unique index one_default_address_per_customer on public.customer_addresses(owner_id) where is_default;
create index addresses_owner on public.customer_addresses(owner_id);
create table public.service_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 100),
  active boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.provider_public_profiles (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (char_length(display_name) between 2 and 100),
  business_type text not null check (business_type in ('shop','home')),
  public_pickup_address text check (char_length(public_pickup_address) <= 1000),
  created_at timestamptz not null default now()
);
create table public.provider_private_profiles (
  provider_id uuid primary key references public.provider_public_profiles(id) on delete cascade,
  responsible_contact text not null check (char_length(responsible_contact) between 2 and 100),
  contact_phone text not null check (char_length(contact_phone) between 7 and 25),
  production_address text not null check (char_length(production_address) between 5 and 1000),
  application_state text not null default 'pending' check (application_state in ('pending','active','restricted','suspended','rejected')),
  pickup_enabled boolean not null default false,
  delivery_enabled boolean not null default false,
  pickup_address_consent_at timestamptz,
  zone_id uuid references public.service_zones(id),
  verification_notes text,
  created_at timestamptz not null default now(),
  check (pickup_enabled or delivery_enabled),
  check (not pickup_enabled or pickup_address_consent_at is not null)
);
create table public.provider_members (
  provider_id uuid not null references public.provider_public_profiles(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  membership_role text not null default 'owner' check (membership_role in ('owner','staff')),
  primary key(provider_id,user_id),
  unique(user_id)
);
create index provider_applications_state on public.provider_private_profiles(application_state);

create function private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.admin_users where user_id = auth.uid());
$$;
create function private.is_provider_member(target uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.provider_members where provider_id = target and user_id = auth.uid());
$$;
create function private.provider_is_active(target uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.provider_private_profiles where provider_id = target and application_state = 'active');
$$;
revoke all on function private.is_admin(), private.is_provider_member(uuid), private.provider_is_active(uuid) from public;
grant execute on function private.is_admin(), private.is_provider_member(uuid), private.provider_is_active(uuid) to authenticated;

create function private.bootstrap_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(user_id) values (new.id);
  return new;
end;
$$;
revoke all on function private.bootstrap_profile() from public;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.bootstrap_profile();
-- Existing users are preserved when this migration is applied to an initialized project.
insert into public.profiles(user_id) select id from auth.users on conflict do nothing;

alter table public.profiles enable row level security;
alter table public.admin_users enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.service_zones enable row level security;
alter table public.provider_public_profiles enable row level security;
alter table public.provider_private_profiles enable row level security;
alter table public.provider_members enable row level security;
revoke all on public.profiles, public.admin_users, public.customer_addresses, public.service_zones,
 public.provider_public_profiles, public.provider_private_profiles, public.provider_members from anon, authenticated;
grant select on public.profiles to authenticated;
grant update(display_name,contact_phone) on public.profiles to authenticated;
grant select on public.admin_users to authenticated;
grant select,insert,update,delete on public.customer_addresses to authenticated;
grant select on public.service_zones, public.provider_public_profiles, public.provider_members to authenticated;
-- verification_notes are not exposed to applicants, even through SELECT *.
grant select(provider_id,responsible_contact,contact_phone,production_address,application_state,
 pickup_enabled,delivery_enabled,pickup_address_consent_at,zone_id,created_at) on public.provider_private_profiles to authenticated;
create policy profiles_read on public.profiles for select to authenticated using(user_id=auth.uid());
create policy profiles_edit on public.profiles for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy admins_own_membership on public.admin_users for select to authenticated using(user_id=auth.uid());
create policy addresses_own on public.customer_addresses for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy zones_active on public.service_zones for select to authenticated using(active or private.is_admin());
create policy provider_public_read on public.provider_public_profiles for select to authenticated using(private.is_provider_member(id) or private.is_admin() or private.provider_is_active(id));
create policy provider_private_read on public.provider_private_profiles for select to authenticated using(private.is_provider_member(provider_id) or private.is_admin());
create policy members_own on public.provider_members for select to authenticated using(user_id=auth.uid() or private.is_admin());

create function public.apply_as_provider(
 p_display_name text, p_business_type text, p_responsible_contact text,
 p_contact_phone text, p_production_address text, p_pickup_enabled boolean,
 p_delivery_enabled boolean, p_pickup_consent boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); provider uuid; actor_status text;
begin
 if actor is null then raise exception 'AUTH_REQUIRED'; end if;
 select account_status into actor_status from public.profiles where user_id=actor for update;
 if actor_status is distinct from 'active' then raise exception 'FORBIDDEN'; end if;
 if exists(select 1 from public.provider_members where user_id=actor) then raise exception 'APPLICATION_ALREADY_EXISTS'; end if;
 if p_display_name is null or p_business_type is null or p_responsible_contact is null or p_contact_phone is null or p_production_address is null
   or p_pickup_enabled is null or p_delivery_enabled is null or p_pickup_consent is null then raise exception 'INVALID_APPLICATION'; end if;
 if p_pickup_enabled and not p_pickup_consent then raise exception 'PICKUP_CONSENT_REQUIRED'; end if;
 insert into public.provider_public_profiles(display_name,business_type,public_pickup_address)
 values(btrim(p_display_name),p_business_type,case when p_pickup_enabled then btrim(p_production_address) else null end) returning id into provider;
 insert into public.provider_private_profiles(provider_id,responsible_contact,contact_phone,production_address,pickup_enabled,delivery_enabled,pickup_address_consent_at)
 values(provider,btrim(p_responsible_contact),btrim(p_contact_phone),btrim(p_production_address),p_pickup_enabled,p_delivery_enabled,case when p_pickup_enabled then clock_timestamp() else null end);
 insert into public.provider_members(provider_id,user_id) values(provider,actor);
 return provider;
end;
$$;
revoke all on function public.apply_as_provider(text,text,text,text,text,boolean,boolean,boolean) from public,anon;
grant execute on function public.apply_as_provider(text,text,text,text,text,boolean,boolean,boolean) to authenticated;
comment on function public.apply_as_provider(text,text,text,text,text,boolean,boolean,boolean) is 'Creates a pending application only. Approval/capabilities/service zone are separate admin-controlled steps.';
