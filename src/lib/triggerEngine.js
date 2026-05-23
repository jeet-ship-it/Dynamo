import { supabase } from './supabase'

const STALE_MINUTES = 30
const RAIN_CODES = new Set([51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99])
const UNSAFE_CODES = new Set([45,48,71,73,75,77,85,86,95,96,99])
export const TRIGGER_TYPES = [
  { value: 'weather_rainy', label: 'Weather: Rainy season / rain now' },
  { value: 'weather_hot', label: 'Weather: Hot / summer' },
  { value: 'weather_cold', label: 'Weather: Cold / windy' },
  { value: 'weather_normal', label: 'Weather: Normal fallback' },
  { value: 'cricket_match', label: 'Cricket match' },
  { value: 'stock_market', label: 'Stock market' },
  { value: 'festival', label: 'Festival / event you create' },
  { value: 'forex', label: 'Forex / market rule you create' },
  { value: 'manual', label: 'Manual override' },
  { value: 'custom', label: 'Custom trigger' }
]

export async function fetchWeather(latitude, longitude) {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.search = new URLSearchParams({
    latitude,
    longitude,
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,rain,showers,weather_code,wind_speed_10m,wind_gusts_10m',
    timezone: 'auto'
  }).toString()
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Open-Meteo failed: ${res.status}`)
  const data = await res.json()
  const c = data.current || {}
  const observedAt = c.time ? new Date(c.time) : new Date()
  return {
    temperature: Number(c.temperature_2m ?? 0),
    apparentTemperature: Number(c.apparent_temperature ?? c.temperature_2m ?? 0),
    humidity: Number(c.relative_humidity_2m ?? 0),
    precipitation: Number(c.precipitation ?? 0),
    rain: Number(c.rain ?? 0),
    showers: Number(c.showers ?? 0),
    weatherCode: Number(c.weather_code ?? 0),
    windSpeed: Number(c.wind_speed_10m ?? 0),
    windGusts: Number(c.wind_gusts_10m ?? 0),
    observedAt: observedAt.toISOString(),
    isStale: Date.now() - observedAt.getTime() > STALE_MINUTES * 60 * 1000
  }
}

export function getWeatherRecommendation(w) {
  const precipitation = Number(w.precipitation || 0) + Number(w.rain || 0) + Number(w.showers || 0)
  const rain = precipitation > 0 || RAIN_CODES.has(Number(w.weatherCode))
  const hot = Number(w.apparentTemperature) >= 35
  const cold = Number(w.apparentTemperature) <= 18 || (Number(w.temperature) <= 22 && Number(w.windSpeed) >= 18)
  const windy = Number(w.windSpeed) >= 25 || Number(w.windGusts) >= 35
  const humid = Number(w.humidity) >= 85
  const unsafe = UNSAFE_CODES.has(Number(w.weatherCode))
  if (w.isStale) return { recommended_trigger_type: null, shouldChangeState: false, confidence: 0.35, status: 'stale_weather', reason: 'Weather data is stale, so DynaMo kept the last known decision.' }
  if (rain) return { recommended_trigger_type: 'weather_rainy', shouldChangeState: true, confidence: 0.96, status: 'rain_priority', reason: `Rain/storm detected: precipitation ${precipitation.toFixed(1)}mm, code ${w.weatherCode}. Rain beats heat for brand safety.` }
  if (hot && !windy && !humid) return { recommended_trigger_type: 'weather_hot', shouldChangeState: true, confidence: 0.9, status: 'hot_safe', reason: `Feels-like ${w.apparentTemperature.toFixed(1)}°C, no rain, wind ${w.windSpeed.toFixed(1)}km/h and humidity ${w.humidity}% are acceptable.` }
  if (cold) return { recommended_trigger_type: 'weather_cold', shouldChangeState: true, confidence: 0.82, status: 'cold_windy', reason: `Cold/breezy signal: feels-like ${w.apparentTemperature.toFixed(1)}°C and wind ${w.windSpeed.toFixed(1)}km/h.` }
  if (unsafe || windy || humid) return { recommended_trigger_type: 'weather_normal', shouldChangeState: true, confidence: 0.74, status: 'safe_default', reason: `Weather is not ideal for hot creative: wind ${w.windSpeed.toFixed(1)}km/h, humidity ${w.humidity}%, code ${w.weatherCode}. Safe default selected.` }
  return { recommended_trigger_type: 'weather_normal', shouldChangeState: true, confidence: 0.78, status: 'normal', reason: `No strong rain, heat, or cold trigger matched. Generic creative is safest.` }
}

function isNowBetween(start, end) { return start && end && new Date() >= new Date(start) && new Date() <= new Date(end) }
function evaluateNonWeather(item) {
  const cfg = item.condition_config || {}
  if (item.trigger_type === 'festival') { const met = isNowBetween(cfg.start_date, cfg.end_date); return { trigger_name:'FestivalTrigger', condition_met:met, confidence:met?.9:.3, reason: met ? `${cfg.festival_name||'Festival'} is live.` : `${cfg.festival_name||'Festival'} is not live.` } }
  if (item.trigger_type === 'cricket_match') { const met = isNowBetween(cfg.match_start, cfg.match_end); return { trigger_name:'CricketScoreTrigger', condition_met:met, confidence:met?.82:.3, reason: met ? `Cricket window is live: ${cfg.teams||''}.` : 'Cricket window is not live.' } }
  if (item.trigger_type === 'stock_market') { const val=Number(cfg.last_value||0), th=Number(cfg.threshold||0), met=(cfg.direction==='below'?val<=th:val>=th); return { trigger_name:'StockMarketTrigger', condition_met:met, confidence:met?.75:.3, reason: `${cfg.ticker||'Stock'} value ${val}, threshold ${th}.` } }
  if (item.trigger_type === 'forex') { const val=Number(cfg.last_value||0), th=Number(cfg.threshold||0), met=(cfg.direction==='below'?val<=th:val>=th); return { trigger_name:'ForexTrigger', condition_met:met, confidence:met?.75:.3, reason: `${cfg.pair||'Forex'} value ${val}, threshold ${th}.` } }
  if (item.trigger_type === 'manual') { const met = cfg.enabled===true || cfg.enabled==='true'; return { trigger_name:'ManualTrigger', condition_met:met, confidence:met?1:.2, reason: met?'Manual override enabled.':'Manual override disabled.' } }
  if (item.trigger_type === 'custom') { const met = cfg.enabled===true || cfg.enabled==='true'; return { trigger_name: cfg.trigger_name || 'CustomTrigger', condition_met:met, confidence:met?Number(cfg.confidence||0.7):.2, reason: met ? (cfg.reason || 'Custom condition enabled.') : 'Custom condition disabled.' } }
  return { trigger_name:'UnknownTrigger', condition_met:false, confidence:0, reason:'Unsupported trigger.' }
}
function pickWinner(items, weatherDecision) {
  const nonWeather = items.filter(i=>!String(i.trigger_type).startsWith('weather_')).map(i=>({item:i,res:evaluateNonWeather(i)})).filter(x=>x.res.condition_met).sort((a,b)=>(b.item.priority||0)-(a.item.priority||0)||b.res.confidence-a.res.confidence)
  if (nonWeather.length) return { winner: nonWeather[0].item, result: nonWeather[0].res, status:'non_weather_trigger' }
  if (!weatherDecision.shouldChangeState) return { winner:null, result: weatherDecision, status: weatherDecision.status }
  const winner = items.find(i=>i.trigger_type===weatherDecision.recommended_trigger_type) || items.find(i=>i.trigger_type==='weather_normal')
  return { winner, result: { trigger_name:'WeatherTrigger', condition_met:true, confidence:weatherDecision.confidence, reason:weatherDecision.reason }, status: weatherDecision.status }
}
export async function runContextSync() {
  const { data: campaigns } = await supabase.from('campaigns').select('*').eq('state','active')
  if (!campaigns?.length) return [{city:'All', status:'campaign_paused'}]
  const { data: cities, error } = await supabase.from('cities').select('*').eq('is_active',true).order('city')
  if (error) throw error
  const results=[]
  for (const c of cities||[]) {
    try {
      const w = await fetchWeather(c.latitude,c.longitude)
      const wd = getWeatherRecommendation(w)
      await supabase.from('city_weather_cache').upsert({ city:c.city, latitude:c.latitude, longitude:c.longitude, temperature:w.temperature, apparent_temperature:w.apparentTemperature, precipitation:w.precipitation, humidity:w.humidity, wind_speed:w.windSpeed, weather_code:w.weatherCode, recommended_trigger_type:wd.recommended_trigger_type, decision_reason:wd.reason, confidence:wd.confidence, fetched_at:new Date().toISOString() }, { onConflict:'city' })
      const { data: items } = await supabase.from('line_items').select('*').eq('city',c.city).order('priority',{ascending:false})
      const { winner, result, status } = pickWinner(items||[], wd)
      if (!winner) { results.push({city:c.city,status:'no_line_items'}); continue }
      for (const item of items||[]) {
        const newState = item.id===winner.id ? 'active':'paused'
        const payload = { state:newState, last_weather_temperature:w.temperature, last_weather_apparent_temperature:w.apparentTemperature, last_weather_humidity:w.humidity, last_weather_wind_speed:w.windSpeed, last_weather_code:w.weatherCode, last_weather_precipitation:w.precipitation, last_decision_reason:result.reason, last_decision_confidence:result.confidence, sync_status:status, updated_at:new Date().toISOString() }
        await supabase.from('line_items').update(payload).eq('id',item.id)
        if (item.state !== newState) await supabase.from('transition_logs').insert({ line_item_id:item.id, city:item.city, creative_name:item.creative_name, previous_state:item.state, new_state:newState, reason:result.reason, trigger_name:result.trigger_name, weather_temperature:w.temperature, weather_apparent_temperature:w.apparentTemperature, weather_humidity:w.humidity, weather_wind_speed:w.windSpeed, weather_code:w.weatherCode, weather_precipitation:w.precipitation, confidence:result.confidence })
      }
      results.push({city:c.city,status:'success',activeCreative:winner.creative_name,trigger:winner.trigger_type,confidence:result.confidence})
    } catch(e) {
      await supabase.from('line_items').update({ sync_status:'api_failed_keep_last_state', last_decision_reason:`Weather/API sync failed. Keeping last known state. ${e.message}`, updated_at:new Date().toISOString() }).eq('city',c.city)
      results.push({city:c.city,status:'failed',reason:e.message})
    }
  }
  const { data: cfg } = await supabase.from('app_config').select('*').eq('key','sync_settings').maybeSingle()
  const oldValue = cfg?.value || {}
  await supabase.from('app_config').upsert({ key:'sync_settings', value:{...oldValue,last_auto_sync_at:new Date().toISOString()}, updated_at:new Date().toISOString() })
  return results
}
