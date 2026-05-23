create extension if not exists "uuid-ossp";

create table if not exists campaigns (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  brand text not null,
  state text not null default 'active' check (state in ('active','paused')),
  created_at timestamptz default now()
);

create table if not exists app_config (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

create table if not exists cities (
  id uuid primary key default uuid_generate_v4(),
  city text unique not null,
  latitude numeric not null,
  longitude numeric not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists initiatives (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid references campaigns(id) on delete cascade,
  name text not null,
  trigger_family text not null check (trigger_family in ('weather','cricket','stock','festival','forex','manual','custom')),
  description text,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists seasonal_creatives (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid references campaigns(id) on delete cascade,
  trigger_type text not null,
  creative_name text not null,
  creative_image_url text not null,
  condition_config jsonb default '{}'::jsonb,
  priority int default 10,
  is_active boolean default true,
  updated_at timestamptz default now(),
  unique(campaign_id, trigger_type)
);

create table if not exists line_items (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid references campaigns(id) on delete cascade,
  initiative_id uuid references initiatives(id) on delete set null,
  seasonal_creative_id uuid references seasonal_creatives(id) on delete set null,
  creative_id text not null,
  creative_name text not null,
  creative_image_url text not null,
  city text not null,
  latitude numeric not null,
  longitude numeric not null,
  trigger_type text not null,
  condition_config jsonb default '{}'::jsonb,
  priority int default 10,
  state text not null default 'paused' check (state in ('active','paused')),
  bid numeric default 1.00,
  daily_budget numeric default 50.00,
  last_weather_temperature numeric,
  last_weather_apparent_temperature numeric,
  last_weather_humidity numeric,
  last_weather_wind_speed numeric,
  last_weather_code numeric,
  last_weather_precipitation numeric,
  last_decision_reason text,
  last_decision_confidence numeric,
  sync_status text,
  updated_at timestamptz default now(),
  unique(city, trigger_type, creative_id)
);

create table if not exists transition_logs (
  id uuid primary key default uuid_generate_v4(),
  line_item_id uuid references line_items(id) on delete set null,
  city text not null,
  creative_name text not null,
  previous_state text,
  new_state text,
  reason text,
  trigger_name text,
  weather_temperature numeric,
  weather_apparent_temperature numeric,
  weather_humidity numeric,
  weather_wind_speed numeric,
  weather_code numeric,
  weather_precipitation numeric,
  confidence numeric,
  created_at timestamptz default now()
);

create table if not exists city_weather_cache (
  id uuid primary key default uuid_generate_v4(),
  city text unique not null,
  latitude numeric not null,
  longitude numeric not null,
  temperature numeric,
  apparent_temperature numeric,
  precipitation numeric,
  humidity numeric,
  wind_speed numeric,
  weather_code numeric,
  recommended_trigger_type text,
  decision_reason text,
  confidence numeric,
  fetched_at timestamptz default now()
);

create table if not exists user_weather_feedback (
  id uuid primary key default uuid_generate_v4(),
  city text not null,
  shown_trigger_type text,
  shown_creative_name text,
  question text,
  answer text,
  user_note text,
  actual_weather text,
  created_at timestamptz default now()
);

create index if not exists idx_line_items_city_state on line_items(city, state);
create index if not exists idx_line_items_trigger on line_items(city, trigger_type);
create index if not exists idx_transition_logs_created_at on transition_logs(created_at desc);

alter table campaigns enable row level security;
alter table app_config enable row level security;
alter table cities enable row level security;
alter table initiatives enable row level security;
alter table seasonal_creatives enable row level security;
alter table line_items enable row level security;
alter table transition_logs enable row level security;
alter table city_weather_cache enable row level security;
alter table user_weather_feedback enable row level security;

create policy "Public can read campaigns" on campaigns for select to anon, authenticated using (true);
create policy "Authenticated users can manage campaigns" on campaigns for all to authenticated using (true) with check (true);
create policy "Public can read app config" on app_config for select to anon, authenticated using (true);
create policy "Authenticated users can manage app config" on app_config for all to authenticated using (true) with check (true);
create policy "Public can read cities" on cities for select to anon, authenticated using (true);
create policy "Authenticated users can manage cities" on cities for all to authenticated using (true) with check (true);
create policy "Public can read initiatives" on initiatives for select to anon, authenticated using (true);
create policy "Authenticated users can manage initiatives" on initiatives for all to authenticated using (true) with check (true);
create policy "Public can read seasonal creatives" on seasonal_creatives for select to anon, authenticated using (true);
create policy "Authenticated users can manage seasonal creatives" on seasonal_creatives for all to authenticated using (true) with check (true);
create policy "Public can read line items" on line_items for select to anon, authenticated using (true);
create policy "Authenticated users can manage line items" on line_items for all to authenticated using (true) with check (true);
create policy "Authenticated users can read logs" on transition_logs for select to authenticated using (true);
create policy "Authenticated users can insert logs" on transition_logs for insert to authenticated with check (true);
create policy "Public can read city weather cache" on city_weather_cache for select to anon, authenticated using (true);
create policy "Authenticated users can manage city weather cache" on city_weather_cache for all to authenticated using (true) with check (true);
create policy "Public can submit weather feedback" on user_weather_feedback for insert to anon, authenticated with check (true);
create policy "Authenticated users can read weather feedback" on user_weather_feedback for select to authenticated using (true);

insert into storage.buckets (id, name, public) values ('creatives', 'creatives', true) on conflict (id) do update set public = true;
create policy "Public read creative images" on storage.objects for select using (bucket_id = 'creatives');
create policy "Authenticated upload creative images" on storage.objects for insert to authenticated with check (bucket_id = 'creatives');
create policy "Authenticated update creative images" on storage.objects for update to authenticated using (bucket_id = 'creatives');
