-- Local PostgreSQL test harness only. Supabase provides these objects in real projects.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
grant usage on schema auth, public to authenticated,anon;
grant execute on function auth.uid() to authenticated,anon;
