-- Supabase Schema for TripIn Kerala Pooling
-- Copy and paste this entirely into the Supabase SQL Editor and click "Run"

-- 1. Enable PostGIS for location features (optional but good for future)
create extension if not exists postgis;

-- 2. Create Users Table
create table if not exists public.users (
  id uuid references auth.users(id) on delete cascade primary key,
  uid uuid references auth.users(id) on delete cascade,
  email text unique,
  name text,
  display_name text,
  avatar text,
  role text default 'customer',
  is_driver boolean default false,
  rating numeric default 5.0,
  trips_count integer default 0,
  is_onboarded boolean default false,
  is_verified boolean default false,
  co2_saved numeric default 0,
  money_saved numeric default 0,
  fuel_saved numeric default 0,
  wallet_balance numeric default 0,
  earnings numeric default 0,
  level integer default 1,
  kyc_data jsonb,
  bank_details jsonb,
  created_at timestamp with time zone default now()
);

-- 3. Create Drivers Table (for driver specific KYC)
create table if not exists public.drivers (
  id uuid references public.users(id) on delete cascade primary key,
  license_number text,
  verification_status text default 'incomplete',
  vehicle_details jsonb,
  created_at timestamp with time zone default now()
);

-- 4. Create Trips Table
create table if not exists public.trips (
  id uuid default gen_random_uuid() primary key,
  driver_id uuid references public.users(id),
  driver_name text,
  driver_avatar text,
  origin jsonb,
  destination jsonb,
  departure_time bigint, -- Storing as timestamp milliseconds for frontend compatibility
  price_per_seat numeric,
  available_seats integer,
  car_model text,
  status text default 'OPEN',
  created_at bigint
);

-- 5. Create Bookings Table
create table if not exists public.bookings (
  id uuid default gen_random_uuid() primary key,
  trip_id uuid references public.trips(id),
  rider_id uuid references public.users(id),
  driver_id uuid references public.users(id),
  amount numeric,
  payment_method text,
  status text default 'CONFIRMED',
  created_at bigint
);

-- 6. Create Driver Transactions Table
create table if not exists public.driver_transactions (
  id uuid default gen_random_uuid() primary key,
  driver_id uuid references public.users(id),
  amount numeric,
  type text,
  status text,
  created_at bigint
);

-- 7. Create Chats Table
create table if not exists public.chats (
  id text primary key,
  participants jsonb,
  last_message text,
  updated_at timestamp with time zone default now()
);

-- 8. Create Messages Table
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  chat_id text references public.chats(id),
  sender_id uuid references public.users(id),
  text text,
  timestamp timestamp with time zone default now()
);

-- 9. Create Live Locations Table
create table if not exists public.live_locations (
  id uuid references public.users(id) primary key,
  lat numeric,
  lng numeric,
  heading numeric,
  speed numeric,
  updated_at bigint
);

-- 10. Disable Row Level Security (RLS) for now to make migration seamless
-- (In a real production app, you should enable RLS and write security policies)
alter table public.users disable row level security;
alter table public.drivers disable row level security;
alter table public.trips disable row level security;
alter table public.bookings disable row level security;
alter table public.driver_transactions disable row level security;
alter table public.chats disable row level security;
alter table public.messages disable row level security;
alter table public.live_locations disable row level security;

-- 11. Create a Storage Bucket for KYC documents
insert into storage.buckets (id, name, public) values ('kyc-documents', 'kyc-documents', true) on conflict do nothing;

-- 12. Create trigger to automatically create public.users when auth.users is created
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, uid, email, name, display_name)
  values (new.id, new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
