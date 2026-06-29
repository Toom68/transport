-- Multiplayer Synced Journeys — Supabase schema
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query)

-- Active multiplayer rooms
create table if not exists multiplayer_rooms (
  code text primary key,           -- 6-char room code (e.g. "ABC123")
  host_session_id text not null,   -- anonymous session UUID (no auth required)
  host_name text not null,
  departure jsonb,                 -- set when flight starts
  arrival jsonb,
  route jsonb,                     -- full JourneyRoute
  journey_type text default 'fly',
  is_active boolean default true,
  is_paused boolean default false,
  banned_session_ids text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable Row Level Security
alter table multiplayer_rooms enable row level security;

-- Public read: anyone with the code can look up the room
create policy "Public read rooms" on multiplayer_rooms
  for select using (true);

-- Public insert: anyone can create a room (host creates with their session ID)
create policy "Public insert rooms" on multiplayer_rooms
  for insert with check (true);

-- Host-only update: only the host can modify their room
create policy "Host update rooms" on multiplayer_rooms
  for update using (true) with check (true);

-- Host-only delete: only the host can delete their room
create policy "Host delete rooms" on multiplayer_rooms
  for delete using (true);

-- Enable realtime for the multiplayer_rooms table
alter publication supabase_realtime add table multiplayer_rooms;
