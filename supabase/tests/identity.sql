begin;
insert into auth.users(id) values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
insert into public.customer_addresses(owner_id,recipient_name,phone,full_address) values
 ('00000000-0000-0000-0000-000000000002','Customer Two','03001234567','Private test address');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $$ begin
 if (select count(*) from public.profiles) <> 1 then raise exception 'FAIL: profile isolation'; end if;
 if (select count(*) from public.customer_addresses) <> 0 then raise exception 'FAIL: private address isolation'; end if;
 update public.profiles set display_name='Customer One' where user_id=auth.uid();
 if (select display_name from public.profiles where user_id=auth.uid()) <> 'Customer One' then raise exception 'FAIL: editable profile'; end if;
 begin
  update public.profiles set account_status='suspended' where user_id=auth.uid();
  raise exception 'FAIL: status write allowed';
 exception when insufficient_privilege then null; end;
 begin
  update public.profiles set phone_verified_at=now() where user_id=auth.uid();
  raise exception 'FAIL: self phone verification';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.admin_users(user_id) values(auth.uid());
  raise exception 'FAIL: self admin promotion';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.customer_addresses(owner_id,recipient_name,phone,full_address) values('00000000-0000-0000-0000-000000000002','Forged','03001234567','Forged test address');
  raise exception 'FAIL: forged address owner';
 exception when insufficient_privilege then null; end;
end $$;
select public.apply_as_provider('Test Print Shop','shop','Test Provider','03001234567','Test production address',true,true,true);
do $$ begin
 if (select count(*) from public.provider_members where user_id=auth.uid()) <> 1 then raise exception 'FAIL: provider ownership'; end if;
 if (select application_state from public.provider_private_profiles) <> 'pending' then raise exception 'FAIL: application not pending'; end if;
 begin
  update public.provider_private_profiles set application_state='active';
  raise exception 'FAIL: self provider approval';
 exception when insufficient_privilege then null; end;
 begin
  perform verification_notes from public.provider_private_profiles;
  raise exception 'FAIL: internal notes readable';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.provider_members(provider_id,user_id) select provider_id,'00000000-0000-0000-0000-000000000002'::uuid from public.provider_members;
  raise exception 'FAIL: forged provider membership';
 exception when insufficient_privilege then null; end;
 begin
  perform public.apply_as_provider('Duplicate Shop','shop','Test Provider','03001234567','Test address',true,true,true);
  raise exception 'FAIL: duplicate application';
 exception when raise_exception then
  if sqlerrm <> 'APPLICATION_ALREADY_EXISTS' then raise; end if;
 end;
end $$;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $$ begin
 if (select count(*) from public.provider_private_profiles) <> 0 then raise exception 'FAIL: private provider disclosure'; end if;
 if (select count(*) from public.provider_public_profiles) <> 0 then raise exception 'FAIL: pending provider visibility'; end if;
 if (select count(*) from public.customer_addresses) <> 1 then raise exception 'FAIL: owner address access'; end if;
 begin
  perform public.apply_as_provider('Home Printer','home','Test Provider','03001234567','Test home address',true,false,false);
  raise exception 'FAIL: pickup without consent';
 exception when raise_exception then
  if sqlerrm <> 'PICKUP_CONSENT_REQUIRED' then raise; end if;
 end;
end $$;
reset role;
update public.profiles set account_status='suspended' where user_id='00000000-0000-0000-0000-000000000002';
set local role authenticated;
do $$ begin
 begin
  perform public.apply_as_provider('Blocked Printer','home','Test Provider','03001234567','Test home address',false,true,false);
  raise exception 'FAIL: suspended user application';
 exception when raise_exception then
  if sqlerrm <> 'FORBIDDEN' then raise; end if;
 end;
end $$;
reset role;
update public.provider_private_profiles set application_state='active';
set local role authenticated;
do $$ begin
 if (select count(*) from public.provider_public_profiles) <> 1 then raise exception 'FAIL: active public provider visibility'; end if;
 if (select count(*) from public.provider_private_profiles) <> 0 then raise exception 'FAIL: active provider private disclosure'; end if;
end $$;
set local role anon;
do $$ begin
 begin
  perform * from public.customer_addresses;
  raise exception 'FAIL: anonymous address read';
 exception when insufficient_privilege then null; end;
 begin
  perform public.apply_as_provider('Anon Printer','shop','Test','03001234567','Test address',false,true,false);
  raise exception 'FAIL: anonymous provider application';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
\echo 'PASS: 22 identity/provider authorization checks (local PostgreSQL auth harness).'
