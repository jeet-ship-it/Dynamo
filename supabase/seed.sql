insert into campaigns (id, name, brand, state) values
('11111111-1111-1111-1111-111111111111'::uuid, 'CoolSip Context-Aware Campaign', 'CoolSip', 'active')
on conflict (id) do update set name=excluded.name, brand=excluded.brand, state=excluded.state;

insert into app_config (key, value) values
('sync_settings', '{"interval_minutes":5,"auto_sync_enabled":true,"last_auto_sync_at":null,"weather_api":"Open-Meteo","why":"Free, no API key, supports current temperature, feels-like, precipitation, humidity, wind and weather code."}'::jsonb)
on conflict (key) do update set value=excluded.value, updated_at=now();

insert into cities (city, latitude, longitude) values
('Mumbai', 19.0760, 72.8777),
('Delhi', 28.6139, 77.2090),
('Bangalore', 12.9716, 77.5946),
('Chennai', 13.0827, 80.2707)
on conflict (city) do update set latitude=excluded.latitude, longitude=excluded.longitude, is_active=true;

insert into initiatives (id, campaign_id, name, trigger_family, description) values
('21111111-1111-1111-1111-111111111111'::uuid,'11111111-1111-1111-1111-111111111111'::uuid,'Rain / Monsoon Creative','weather','Global rainy-season creative. Applies to every city where rain is detected.'),
('22222222-2222-2222-2222-222222222222'::uuid,'11111111-1111-1111-1111-111111111111'::uuid,'Hot Summer Creative','weather','Global heat creative using feels-like temperature and brand-safety checks.'),
('22333333-3333-3333-3333-333333333333'::uuid,'11111111-1111-1111-1111-111111111111'::uuid,'Cold / Wind Creative','weather','Global cold/windy creative.'),
('23333333-3333-3333-3333-333333333333'::uuid,'11111111-1111-1111-1111-111111111111'::uuid,'Normal Fallback Creative','weather','Safe default creative.')
on conflict (id) do update set name=excluded.name, description=excluded.description;

insert into seasonal_creatives (campaign_id, trigger_type, creative_name, creative_image_url, condition_config, priority) values
('11111111-1111-1111-1111-111111111111'::uuid,'weather_rainy','Rainy day pick-me-up','https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=1200&auto=format&fit=crop','{"precipitation_gt":0,"priority_reason":"rain beats heat"}'::jsonb,100),
('11111111-1111-1111-1111-111111111111'::uuid,'weather_hot','Beat the heat','https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=1200&auto=format&fit=crop','{"min_apparent_temperature":35,"max_wind_kmh":25,"max_humidity":85}'::jsonb,80),
('11111111-1111-1111-1111-111111111111'::uuid,'weather_cold','Breezy comfort sip','https://images.unsplash.com/photo-1543253687-c931c8e01820?w=1200&auto=format&fit=crop','{"max_apparent_temperature":18,"windy_is_ok":true}'::jsonb,70),
('11111111-1111-1111-1111-111111111111'::uuid,'weather_normal','Refresh anytime','https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=1200&auto=format&fit=crop','{"safe_default":true}'::jsonb,10)
on conflict (campaign_id, trigger_type) do update set creative_name=excluded.creative_name, creative_image_url=excluded.creative_image_url, condition_config=excluded.condition_config, priority=excluded.priority, updated_at=now();

with city_data as (select * from cities), sc as (select * from seasonal_creatives where campaign_id='11111111-1111-1111-1111-111111111111'::uuid)
insert into line_items (campaign_id, seasonal_creative_id, creative_id, creative_name, creative_image_url, city, latitude, longitude, trigger_type, condition_config, priority, state, bid, daily_budget, last_decision_reason)
select sc.campaign_id, sc.id, sc.trigger_type || '-' || lower(city_data.city), sc.creative_name, sc.creative_image_url, city_data.city, city_data.latitude, city_data.longitude, sc.trigger_type, sc.condition_config, sc.priority, case when sc.trigger_type='weather_normal' then 'active' else 'paused' end, 1.20, 50, 'Seeded from global seasonal creative template.'
from city_data cross join sc
on conflict (city, trigger_type, creative_id) do update set creative_name=excluded.creative_name, creative_image_url=excluded.creative_image_url, condition_config=excluded.condition_config, priority=excluded.priority;
