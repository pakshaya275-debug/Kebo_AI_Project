-- OPTIONAL but recommended before a public demo.
-- The original demo policies use `using (true)`, so anyone holding the (public) anon key
-- could read or delete EVERY device's memories. This restricts each request to rows whose
-- device_id equals the `x-device-id` header the app now sends.
-- Run in the Supabase SQL editor. Not a replacement for real authentication, but it stops
-- casual enumeration of other users' memories.

drop policy if exists "Kebo demo memories are readable by device id" on public.kebo_memories;
drop policy if exists "Kebo demo memories are insertable" on public.kebo_memories;
drop policy if exists "Kebo demo memories are updatable" on public.kebo_memories;
drop policy if exists "Kebo demo memories are deletable" on public.kebo_memories;

create policy "Kebo memories: select own device"
  on public.kebo_memories for select
  using (device_id = coalesce(current_setting('request.headers', true)::json ->> 'x-device-id', ''));

create policy "Kebo memories: insert own device"
  on public.kebo_memories for insert
  with check (device_id = coalesce(current_setting('request.headers', true)::json ->> 'x-device-id', ''));

create policy "Kebo memories: update own device"
  on public.kebo_memories for update
  using (device_id = coalesce(current_setting('request.headers', true)::json ->> 'x-device-id', ''))
  with check (device_id = coalesce(current_setting('request.headers', true)::json ->> 'x-device-id', ''));

create policy "Kebo memories: delete own device"
  on public.kebo_memories for delete
  using (device_id = coalesce(current_setting('request.headers', true)::json ->> 'x-device-id', ''));
