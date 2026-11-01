-- Petoskémon initial schema
-- Run this entire file in Supabase Dashboard > SQL Editor.
-- Never put the Supabase service_role key in the browser or GitHub.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  alias text not null unique check (char_length(alias) between 3 and 24),
  city text default 'Petoskey',
  created_at timestamptz not null default now()
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 100),
  description text default '',
  price numeric(10,2) not null check (price >= 0),
  condition text not null default 'Near Mint',
  category text not null check (category in ('Singles','Sealed','Collections','Graded')),
  city text not null default 'Petoskey',
  images text[] not null default '{}',
  status text not null default 'active' check (status in ('active','reserved','sold','withdrawn','expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists listings_status_created_idx on public.listings(status, created_at desc);
create index if not exists listings_seller_idx on public.listings(seller_id);
create index if not exists listings_category_idx on public.listings(category);

create table if not exists public.saved_items (
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  constraint messages_not_self check (sender_id <> recipient_id)
);

create index if not exists messages_sender_idx on public.messages(sender_id, created_at desc);
create index if not exists messages_recipient_idx on public.messages(recipient_id, created_at desc);
create index if not exists messages_listing_idx on public.messages(listing_id, created_at desc);

-- Create a public alias profile automatically for new auth users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_alias text;
begin
  requested_alias := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'alias'), ''),
    'Collector-' || left(replace(new.id::text, '-', ''), 8)
  );

  insert into public.profiles (id, alias)
  values (new.id, left(requested_alias, 24))
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.saved_items enable row level security;
alter table public.messages enable row level security;

-- Public profiles expose aliases and general city only. Email is never stored here.
drop policy if exists "Profiles are publicly readable" on public.profiles;
create policy "Profiles are publicly readable"
  on public.profiles for select using (true);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Active listings are public; owners see all own" on public.listings;
create policy "Active listings are public; owners see all own"
  on public.listings for select
  using (status = 'active' or auth.uid() = seller_id);

drop policy if exists "Authenticated users can create own listings" on public.listings;
create policy "Authenticated users can create own listings"
  on public.listings for insert to authenticated
  with check (auth.uid() = seller_id);

drop policy if exists "Owners can update own listings" on public.listings;
create policy "Owners can update own listings"
  on public.listings for update to authenticated
  using (auth.uid() = seller_id) with check (auth.uid() = seller_id);

drop policy if exists "Owners can delete own listings" on public.listings;
create policy "Owners can delete own listings"
  on public.listings for delete to authenticated
  using (auth.uid() = seller_id);

drop policy if exists "Users can read own saved items" on public.saved_items;
create policy "Users can read own saved items"
  on public.saved_items for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can save own items" on public.saved_items;
create policy "Users can save own items"
  on public.saved_items for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can unsave own items" on public.saved_items;
create policy "Users can unsave own items"
  on public.saved_items for delete to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Conversation participants can read messages" on public.messages;
create policy "Conversation participants can read messages"
  on public.messages for select to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

drop policy if exists "Senders can send messages to listing owners" on public.messages;
create policy "Senders can send messages to listing owners"
  on public.messages for insert to authenticated
  with check (
    auth.uid() = sender_id
    and sender_id <> recipient_id
    and exists (
      select 1 from public.listings l
      where l.id = listing_id and l.seller_id = recipient_id
    )
  );

-- Public image bucket. Uploads are restricted to a folder named with the user's auth UUID.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-images', 'listing-images', true, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Listing images are publicly viewable" on storage.objects;
create policy "Listing images are publicly viewable"
  on storage.objects for select
  using (bucket_id = 'listing-images');

drop policy if exists "Users upload images to own folder" on storage.objects;
create policy "Users upload images to own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users update images in own folder" on storage.objects;
create policy "Users update images in own folder"
  on storage.objects for update to authenticated
  using (bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users delete images in own folder" on storage.objects;
create policy "Users delete images in own folder"
  on storage.objects for delete to authenticated
  using (bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- Optional: allow Supabase Realtime subscriptions on messages if desired later.
-- alter publication supabase_realtime add table public.messages;
