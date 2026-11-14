create table if not exists public.idea_atlas_vaults (
  user_id uuid primary key references auth.users(id) on delete cascade,
  vault jsonb not null,
  updated_at timestamptz not null default now(),
  constraint idea_atlas_vaults_vault_is_object check (jsonb_typeof(vault) = 'object')
);

alter table public.idea_atlas_vaults enable row level security;

revoke all on table public.idea_atlas_vaults from anon;
grant select, insert, update, delete on table public.idea_atlas_vaults to authenticated;

create policy "vault owners can read"
on public.idea_atlas_vaults for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "vault owners can insert"
on public.idea_atlas_vaults for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "vault owners can update"
on public.idea_atlas_vaults for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "vault owners can delete"
on public.idea_atlas_vaults for delete
to authenticated
using ((select auth.uid()) = user_id);

comment on table public.idea_atlas_vaults is
  'Private per-user Idea Atlas state synchronized across devices.';
