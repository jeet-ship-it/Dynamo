# DynaMo V6 — Auto Sync + City Weather Cards + Feedback Loop

## What this version adds
- Auto weather sync every 5 minutes by default.
- Admin can change auto-sync interval from the dashboard.
- Netlify Scheduled Function checks every minute and syncs only when the configured interval is due.
- Admin city weather cards show temperature, feels-like, wind, rain, humidity, weather code, confidence, reasoning and fetch time.
- Customer site hides technical weather details and only shows the right campaign experience.
- Customer feedback popup asks whether the weather is actually matching the user's location.
- Public banner/animation changes dynamically after weather sync: rain, heat, cold/wind, normal.
- Add City is real: inserts into Supabase, applies seasonal templates, syncs weather, and appears in public dropdown through Supabase Realtime.
- No pre-seeded festival/IPL/forex examples. The functionality exists, but you add those initiatives yourself.

## Weather API
This MVP uses Open-Meteo because it is free, does not require an API key, and supports current temperature, apparent temperature, humidity, precipitation, rain, showers, weather code, wind speed and gusts.

## Local setup
1. Run schema.sql in Supabase SQL Editor.
2. Run seed.sql in Supabase SQL Editor.
3. Add an auth user in Supabase Authentication.
4. Create a public storage bucket named `creatives` if it is not already there.
5. Create `.env`:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

6. Install and run:

```powershell
cmd /c npm install
cmd /c npm run dev
```

## Netlify hosting
Build command:

```text
npm run build
```

Publish directory:

```text
dist
```

Environment variables in Netlify:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

The scheduled function is in `netlify/functions/weather-sync.js` and configured in `netlify.toml`.
