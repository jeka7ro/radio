import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplets,
  Loader2,
  LocateFixed,
  MapPin,
  Moon,
  RefreshCw,
  Search,
  Sun,
  Thermometer,
  Wind,
  X,
} from 'lucide-react';

type UiLang = 'ro' | 'en' | 'ru';

interface WeatherLocation {
  name: string;
  country: string;
  lat: number;
  lon: number;
  source: 'ip' | 'gps' | 'manual' | 'fallback';
}

interface HourlyForecastItem {
  time: string;
  hourLabel: string;
  temp: number;
  code: number;
  isDay: boolean;
  precipProb: number;
}

interface DailyForecastItem {
  date: string;
  code: number;
  maxTemp: number;
  minTemp: number;
  precipProb: number;
}

interface WeatherSnapshot {
  temp: number;
  feelsLike: number;
  humidity: number;
  windKmh: number;
  code: number;
  isDay: boolean;
  hourly: HourlyForecastItem[];
  daily: DailyForecastItem[];
}

interface CachedWeatherState {
  location: WeatherLocation;
  weather: WeatherSnapshot;
  fetchedAt: number;
}

interface GeoSearchResult {
  id: number;
  name: string;
  country: string;
  admin1?: string;
  latitude: number;
  longitude: number;
}

export interface HeaderWeatherWidgetProps {
  uiLang: UiLang;
  isMobilePhone?: boolean;
  variant?: 'tv' | 'classic';
}

const WEATHER_STORAGE_KEY = 'filmio_local_weather_v1';
const WEATHER_REFRESH_INTERVAL_MS = 20 * 60 * 1000; // 20 minutes (>= 60s, 0 Netlify quota)
const WEATHER_UPDATED_EVENT = 'filmio:weather-updated';
const WEATHER_CLOSE_EVENT = 'aether:close-weather-modal';

function fetchJsonWithTimeout(url: string, timeoutMs: number): Promise<any> {
  return new Promise((resolve, reject) => {
    const hasAbort = typeof AbortController !== 'undefined';
    const controller = hasAbort ? new AbortController() : null;
    const timer = window.setTimeout(() => {
      if (controller) {
        try {
          controller.abort();
        } catch {
          // ignore
        }
      }
      reject(new Error('timeout'));
    }, timeoutMs);

    fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal: controller ? controller.signal : undefined,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        window.clearTimeout(timer);
        resolve(data);
      })
      .catch((err) => {
        window.clearTimeout(timer);
        reject(err);
      });
  });
}

function readCachedWeather(): CachedWeatherState | null {
  try {
    const raw = window.localStorage.getItem(WEATHER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedWeatherState;
    if (
      !parsed ||
      !parsed.location ||
      typeof parsed.location.lat !== 'number' ||
      typeof parsed.location.lon !== 'number' ||
      !parsed.weather ||
      typeof parsed.weather.temp !== 'number'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedWeather(state: CachedWeatherState): void {
  try {
    window.localStorage.setItem(WEATHER_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage quota errors
  }
}

function getTimezoneFallbackLocation(): WeatherLocation {
  let tz = '';
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    tz = '';
  }
  const map: Record<string, { name: string; country: string; lat: number; lon: number }> = {
    'Europe/Bucharest': { name: 'București', country: 'România', lat: 44.4323, lon: 26.1063 },
    'Europe/Chisinau': { name: 'Chișinău', country: 'Moldova', lat: 47.0105, lon: 28.8638 },
    'Europe/London': { name: 'London', country: 'UK', lat: 51.5072, lon: -0.1276 },
    'Europe/Paris': { name: 'Paris', country: 'France', lat: 48.8566, lon: 2.3522 },
    'Europe/Berlin': { name: 'Berlin', country: 'Germany', lat: 52.52, lon: 13.405 },
    'Europe/Rome': { name: 'Roma', country: 'Italia', lat: 41.9028, lon: 12.4964 },
    'Europe/Madrid': { name: 'Madrid', country: 'España', lat: 40.4168, lon: -3.7038 },
    'Europe/Vienna': { name: 'Vienna', country: 'Austria', lat: 48.2082, lon: 16.3738 },
  };
  const found = map[tz] || map['Europe/Bucharest'];
  return {
    name: found.name,
    country: found.country,
    lat: found.lat,
    lon: found.lon,
    source: 'fallback',
  };
}

async function detectLocationByIp(): Promise<WeatherLocation> {
  // Provider 1: geojs.io (fast HTTPS CORS *)
  try {
    const data = await fetchJsonWithTimeout('https://get.geojs.io/v1/ip/geo.json', 4500);
    const lat = Number(data?.latitude);
    const lon = Number(data?.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return {
        name: String(data?.city || data?.region || data?.country || 'Local').trim(),
        country: String(data?.country || '').trim(),
        lat,
        lon,
        source: 'ip',
      };
    }
  } catch {
    // fallback to provider 2
  }

  // Provider 2: ipwho.is (HTTPS CORS *)
  try {
    const data = await fetchJsonWithTimeout('https://ipwho.is/', 4500);
    const lat = Number(data?.latitude);
    const lon = Number(data?.longitude);
    if (data?.success !== false && Number.isFinite(lat) && Number.isFinite(lon)) {
      return {
        name: String(data?.city || data?.region || data?.country || 'Local').trim(),
        country: String(data?.country || '').trim(),
        lat,
        lon,
        source: 'ip',
      };
    }
  } catch {
    // fallback to timezone default
  }

  return getTimezoneFallbackLocation();
}

async function reverseGeocodeLabel(
  lat: number,
  lon: number,
  uiLang: UiLang
): Promise<{ name: string; country: string } | null> {
  try {
    const langParam = uiLang === 'ru' ? 'ru' : uiLang === 'en' ? 'en' : 'ro';
    const data = await fetchJsonWithTimeout(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(
        lat.toFixed(4)
      )}&longitude=${encodeURIComponent(lon.toFixed(4))}&localityLanguage=${langParam}`,
      4000
    );
    const name = String(data?.city || data?.locality || data?.principalSubdivision || '').trim();
    const country = String(data?.countryName || '').trim();
    if (name) return { name, country };
  } catch {
    // ignore optional reverse geocoder failure
  }
  return null;
}

async function fetchOpenMeteoForecast(lat: number, lon: number): Promise<WeatherSnapshot> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat.toFixed(4))}` +
    `&longitude=${encodeURIComponent(lon.toFixed(4))}` +
    '&current=temperature_2m,apparent_temperature,relative_humidity_2m,is_day,weather_code,wind_speed_10m' +
    '&hourly=temperature_2m,weather_code,precipitation_probability,is_day' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
    '&timezone=auto&forecast_days=5';

  const data = await fetchJsonWithTimeout(url, 6000);
  const current = data?.current;
  if (!current || typeof current.temperature_2m !== 'number') {
    throw new Error('Invalid Open-Meteo response');
  }

  const currentTimeStr = String(current.time || '');
  const currentHourPrefix = currentTimeStr.slice(0, 13); // "YYYY-MM-DDTHH"

  const hourlyTimes: string[] = Array.isArray(data?.hourly?.time) ? data.hourly.time : [];
  const hourlyTemps: number[] = Array.isArray(data?.hourly?.temperature_2m)
    ? data.hourly.temperature_2m
    : [];
  const hourlyCodes: number[] = Array.isArray(data?.hourly?.weather_code)
    ? data.hourly.weather_code
    : [];
  const hourlyPrecip: number[] = Array.isArray(data?.hourly?.precipitation_probability)
    ? data.hourly.precipitation_probability
    : [];
  const hourlyIsDay: number[] = Array.isArray(data?.hourly?.is_day) ? data.hourly.is_day : [];

  let startIdx = 0;
  if (currentHourPrefix) {
    const foundIdx = hourlyTimes.findIndex((t) => String(t).slice(0, 13) >= currentHourPrefix);
    if (foundIdx >= 0) startIdx = foundIdx;
  }

  const hourly: HourlyForecastItem[] = [];
  for (let i = startIdx; i < Math.min(hourlyTimes.length, startIdx + 8); i++) {
    const t = String(hourlyTimes[i] || '');
    hourly.push({
      time: t,
      hourLabel: t.length >= 16 ? t.slice(11, 16) : `${i}:00`,
      temp: Math.round(Number(hourlyTemps[i] ?? current.temperature_2m)),
      code: Number(hourlyCodes[i] ?? current.weather_code ?? 0),
      isDay: Number(hourlyIsDay[i] ?? current.is_day ?? 1) === 1,
      precipProb: Math.max(0, Math.min(100, Math.round(Number(hourlyPrecip[i] ?? 0)))),
    });
  }

  const dailyTimes: string[] = Array.isArray(data?.daily?.time) ? data.daily.time : [];
  const dailyCodes: number[] = Array.isArray(data?.daily?.weather_code)
    ? data.daily.weather_code
    : [];
  const dailyMax: number[] = Array.isArray(data?.daily?.temperature_2m_max)
    ? data.daily.temperature_2m_max
    : [];
  const dailyMin: number[] = Array.isArray(data?.daily?.temperature_2m_min)
    ? data.daily.temperature_2m_min
    : [];
  const dailyPrecip: number[] = Array.isArray(data?.daily?.precipitation_probability_max)
    ? data.daily.precipitation_probability_max
    : [];

  const daily: DailyForecastItem[] = [];
  for (let i = 0; i < Math.min(dailyTimes.length, 5); i++) {
    daily.push({
      date: String(dailyTimes[i] || ''),
      code: Number(dailyCodes[i] ?? 0),
      maxTemp: Math.round(Number(dailyMax[i] ?? current.temperature_2m)),
      minTemp: Math.round(Number(dailyMin[i] ?? current.temperature_2m)),
      precipProb: Math.max(0, Math.min(100, Math.round(Number(dailyPrecip[i] ?? 0)))),
    });
  }

  return {
    temp: Math.round(Number(current.temperature_2m)),
    feelsLike: Math.round(Number(current.apparent_temperature ?? current.temperature_2m)),
    humidity: Math.max(0, Math.min(100, Math.round(Number(current.relative_humidity_2m ?? 0)))),
    windKmh: Math.max(0, Math.round(Number(current.wind_speed_10m ?? 0))),
    code: Number(current.weather_code ?? 0),
    isDay: Number(current.is_day ?? 1) === 1,
    hourly,
    daily,
  };
}

function getWmoConditionLabel(code: number, uiLang: UiLang): string {
  const t = (ro: string, en: string, ru: string) =>
    uiLang === 'en' ? en : uiLang === 'ru' ? ru : ro;

  if (code === 0) return t('Senin', 'Clear sky', 'Ясно');
  if (code === 1) return t('Predominant senin', 'Mainly clear', 'Преимущественно ясно');
  if (code === 2) return t('Parțial noros', 'Partly cloudy', 'Переменная облачность');
  if (code === 3) return t('Înnorat', 'Overcast', 'Пасмурно');
  if (code === 45 || code === 48) return t('Ceață', 'Fog', 'Туман');
  if (code >= 51 && code <= 57) return t('Burniță', 'Drizzle', 'Морось');
  if (code >= 61 && code <= 67) return t('Ploaie', 'Rain', 'Дождь');
  if (code >= 71 && code <= 77) return t('Ninsoare', 'Snow', 'Снег');
  if (code >= 80 && code <= 82) return t('Averse de ploaie', 'Rain showers', 'Ливень');
  if (code >= 85 && code <= 86) return t('Averse de ninsoare', 'Snow showers', 'Снегопад');
  if (code >= 95) return t('Furtună', 'Thunderstorm', 'Гроза');
  return t('Vreme locală', 'Local weather', 'Местная погода');
}

function renderWeatherIcon(
  code: number,
  isDay: boolean,
  className: string,
  classicLight?: boolean
): React.ReactElement {
  if (code === 0) {
    return isDay ? (
      <Sun
        className={`${className} ${classicLight ? 'text-amber-500 dark:text-amber-300' : 'text-amber-300'}`}
        aria-hidden="true"
      />
    ) : (
      <Moon
        className={`${className} ${classicLight ? 'text-indigo-500 dark:text-indigo-200' : 'text-indigo-200'}`}
        aria-hidden="true"
      />
    );
  }
  if (code === 1 || code === 2) {
    return isDay ? (
      <CloudSun
        className={`${className} ${classicLight ? 'text-amber-500 dark:text-amber-200' : 'text-amber-200'}`}
        aria-hidden="true"
      />
    ) : (
      <CloudMoon
        className={`${className} ${classicLight ? 'text-slate-500 dark:text-slate-200' : 'text-slate-200'}`}
        aria-hidden="true"
      />
    );
  }
  if (code === 3) {
    return (
      <Cloud
        className={`${className} ${classicLight ? 'text-slate-500 dark:text-slate-200' : 'text-slate-200'}`}
        aria-hidden="true"
      />
    );
  }
  if (code === 45 || code === 48) {
    return (
      <CloudFog
        className={`${className} ${classicLight ? 'text-slate-500 dark:text-slate-300' : 'text-slate-300'}`}
        aria-hidden="true"
      />
    );
  }
  if (code >= 51 && code <= 57) {
    return (
      <CloudDrizzle
        className={`${className} ${classicLight ? 'text-sky-600 dark:text-sky-300' : 'text-sky-300'}`}
        aria-hidden="true"
      />
    );
  }
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) {
    return (
      <CloudRain
        className={`${className} ${classicLight ? 'text-sky-600 dark:text-sky-400' : 'text-sky-400'}`}
        aria-hidden="true"
      />
    );
  }
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
    return (
      <CloudSnow
        className={`${className} ${classicLight ? 'text-cyan-600 dark:text-cyan-200' : 'text-cyan-200'}`}
        aria-hidden="true"
      />
    );
  }
  if (code >= 95) {
    return (
      <CloudLightning
        className={`${className} ${classicLight ? 'text-amber-600 dark:text-amber-400' : 'text-amber-400'}`}
        aria-hidden="true"
      />
    );
  }
  return (
    <CloudSun
      className={`${className} ${classicLight ? 'text-amber-500 dark:text-amber-200' : 'text-amber-200'}`}
      aria-hidden="true"
    />
  );
}

function formatDayName(dateStr: string, index: number, uiLang: UiLang): string {
  if (index === 0) {
    return uiLang === 'en' ? 'Today' : uiLang === 'ru' ? 'Сегодня' : 'Azi';
  }
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return dateStr;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  const day = d.getDay();
  const namesRo = ['Dum', 'Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm'];
  const namesEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const namesRu = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const list = uiLang === 'en' ? namesEn : uiLang === 'ru' ? namesRu : namesRo;
  return list[day] || dateStr;
}

export const HeaderWeatherWidget: React.FC<HeaderWeatherWidgetProps> = ({
  uiLang,
  isMobilePhone = false,
  variant = 'tv',
}) => {
  const tr = useCallback(
    (ro: string, en: string, ru: string) =>
      uiLang === 'en' ? en : uiLang === 'ru' ? ru : ro,
    [uiLang]
  );

  const [state, setState] = useState<CachedWeatherState | null>(() => readCachedWeather());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [cityQuery, setCityQuery] = useState<string>('');
  const [cityResults, setCityResults] = useState<GeoSearchResult[]>([]);
  const [isSearchingCity, setIsSearchingCity] = useState<boolean>(false);
  const [statusNote, setStatusNote] = useState<string>('');

  const triggerBtnRef = useRef<HTMLButtonElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const mountedRef = useRef<boolean>(true);
  const stateRef = useRef<CachedWeatherState | null>(state);
  stateRef.current = state;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refreshWeather = useCallback(
    async (opts?: { forceIp?: boolean; explicitLocation?: WeatherLocation }) => {
      setIsLoading(true);
      setStatusNote('');
      try {
        let loc: WeatherLocation | null = opts?.explicitLocation || null;
        if (!loc && !opts?.forceIp && stateRef.current?.location) {
          loc = stateRef.current.location;
        }
        if (!loc) {
          loc = await detectLocationByIp();
        }
        const weather = await fetchOpenMeteoForecast(loc.lat, loc.lon);
        const next: CachedWeatherState = {
          location: loc,
          weather,
          fetchedAt: Date.now(),
        };
        writeCachedWeather(next);
        if (mountedRef.current) {
          setState(next);
        }
        window.dispatchEvent(new CustomEvent(WEATHER_UPDATED_EVENT, { detail: next }));
      } catch {
        if (mountedRef.current) {
          setStatusNote(
            tr(
              'Nu s-a putut actualiza vremea momentan.',
              'Could not refresh weather right now.',
              'Не удалось обновить погоду сейчас.'
            )
          );
        }
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [tr]
  );

  // Initial fetch (only if missing or stale > 20 min) + periodic 20-min refresh
  useEffect(() => {
    const cached = readCachedWeather();
    if (!cached || Date.now() - cached.fetchedAt >= WEATHER_REFRESH_INTERVAL_MS) {
      void refreshWeather();
    }

    const timer = window.setInterval(() => {
      if (document.hidden) return;
      const latest = stateRef.current;
      if (!latest || Date.now() - latest.fetchedAt >= WEATHER_REFRESH_INTERVAL_MS) {
        void refreshWeather();
      }
    }, WEATHER_REFRESH_INTERVAL_MS);

    const onVisibility = () => {
      if (document.hidden) return;
      const latest = stateRef.current;
      if (!latest || Date.now() - latest.fetchedAt >= WEATHER_REFRESH_INTERVAL_MS) {
        void refreshWeather();
      }
    };

    const onExternalUpdate = (e: Event) => {
      const detail = (e as CustomEvent<CachedWeatherState>).detail;
      if (detail && detail.weather && mountedRef.current) {
        setState(detail);
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener(WEATHER_UPDATED_EVENT, onExternalUpdate);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener(WEATHER_UPDATED_EVENT, onExternalUpdate);
    };
  }, [refreshWeather]);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setCityQuery('');
    setCityResults([]);
    setStatusNote('');
    window.setTimeout(() => {
      triggerBtnRef.current?.focus();
    }, 30);
  }, []);

  // Escape / Smart TV Back button close handler
  useEffect(() => {
    if (!isOpen) return;
    const focusTimer = window.setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 40);

    const onCloseEvent = () => {
      closeModal();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeModal();
      }
    };

    window.addEventListener(WEATHER_CLOSE_EVENT, onCloseEvent);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener(WEATHER_CLOSE_EVENT, onCloseEvent);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [isOpen, closeModal]);

  // City search via Open-Meteo Geocoding API (debounced)
  useEffect(() => {
    const q = cityQuery.trim();
    if (!isOpen || q.length < 2) {
      setCityResults([]);
      setIsSearchingCity(false);
      return;
    }
    let cancelled = false;
    setIsSearchingCity(true);
    const timer = window.setTimeout(() => {
      const langParam = uiLang === 'ru' ? 'ru' : uiLang === 'en' ? 'en' : 'ro';
      fetchJsonWithTimeout(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          q
        )}&count=5&language=${langParam}&format=json`,
        4500
      )
        .then((data) => {
          if (cancelled || !mountedRef.current) return;
          const list: GeoSearchResult[] = Array.isArray(data?.results)
            ? data.results
                .filter(
                  (r: any) =>
                    typeof r?.latitude === 'number' && typeof r?.longitude === 'number'
                )
                .map((r: any) => ({
                  id: Number(r.id || 0),
                  name: String(r.name || ''),
                  country: String(r.country || r.country_code || ''),
                  admin1: r.admin1 ? String(r.admin1) : undefined,
                  latitude: Number(r.latitude),
                  longitude: Number(r.longitude),
                }))
            : [];
          setCityResults(list);
        })
        .catch(() => {
          if (!cancelled && mountedRef.current) setCityResults([]);
        })
        .finally(() => {
          if (!cancelled && mountedRef.current) setIsSearchingCity(false);
        });
    }, 320);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [cityQuery, isOpen, uiLang]);

  const handleUseGps = useCallback(() => {
    if (
      typeof navigator === 'undefined' ||
      !navigator.geolocation ||
      (typeof window !== 'undefined' && !window.isSecureContext)
    ) {
      setStatusNote(
        tr(
          'GPS necesită HTTPS. Folosește detectarea automată IP sau caută orașul.',
          'GPS requires HTTPS. Use automatic IP location or search a city.',
          'Для GPS нужен HTTPS. Используйте авто-IP или поиск города.'
        )
      );
      return;
    }
    setIsLoading(true);
    setStatusNote(
      tr('Se determină locația GPS...', 'Getting GPS location...', 'Определение GPS...')
    );
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const rev = await reverseGeocodeLabel(lat, lon, uiLang);
        await refreshWeather({
          explicitLocation: {
            name: rev?.name || tr('Locația mea', 'My Location', 'Моё местоположение'),
            country: rev?.country || '',
            lat,
            lon,
            source: 'gps',
          },
        });
      },
      () => {
        if (mountedRef.current) {
          setIsLoading(false);
          setStatusNote(
            tr(
              'Accesul GPS a fost refuzat. Folosește IP sau alege orașul manual.',
              'GPS permission denied. Use IP detection or pick a city.',
              'Доступ к GPS отклонён. Используйте IP или выберите город.'
            )
          );
        }
      },
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 600000 }
    );
  }, [refreshWeather, tr, uiLang]);

  const conditionText = state
    ? getWmoConditionLabel(state.weather.code, uiLang)
    : tr('Vremea locală', 'Local weather', 'Местная погода');

  const tooltipText = state
    ? `${state.location.name}: ${state.weather.temp}°C · ${conditionText} (${tr(
        'Resimțit',
        'Feels like',
        'Ощущается'
      )} ${state.weather.feelsLike}°C)`
    : tr('Vremea locală', 'Local weather', 'Местная погода');

  const updatedTimeLabel = state
    ? new Date(state.fetchedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  const buttonClass =
    variant === 'classic'
      ? 'group min-h-[32px] sm:min-h-[40px] px-2 sm:px-3 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 inline-flex items-center justify-center gap-1 sm:gap-1.5 text-slate-800 dark:text-zinc-100 transition-colors cursor-pointer shrink-0'
      : `group hidden lg:inline-flex h-10 ${
          isMobilePhone ? 'px-2 gap-1' : 'px-3 gap-1.5'
        } rounded-full bg-white/10 hover:bg-white/20 border border-white/15 items-center justify-center text-white transition-all focus:bg-white focus:!text-zinc-950 focus:outline-none focus:ring-2 focus:ring-sky-400 cursor-pointer shrink-0`;

  return (
    <>
      <button
        ref={triggerBtnRef}
        type="button"
        data-header-weather-btn="true"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={tooltipText}
        title={tooltipText}
        onClick={() => {
          setIsOpen((prev) => !prev);
          if (!state || Date.now() - state.fetchedAt >= WEATHER_REFRESH_INTERVAL_MS) {
            void refreshWeather();
          }
        }}
        className={buttonClass}
      >
        {state ? (
          renderWeatherIcon(
            state.weather.code,
            state.weather.isDay,
            'w-4 h-4 sm:w-[18px] sm:h-[18px] shrink-0 group-focus:!text-zinc-950',
            variant === 'classic'
          )
        ) : (
          <CloudSun
            className={`w-4 h-4 sm:w-[18px] sm:h-[18px] shrink-0 ${
              variant === 'classic'
                ? 'text-amber-500 dark:text-amber-300'
                : 'text-amber-200/80 group-focus:!text-zinc-950'
            } ${isLoading ? 'animate-pulse' : ''}`}
            aria-hidden="true"
          />
        )}
        <span className="text-[11px] sm:text-xs font-extrabold tabular-nums tracking-tight leading-none">
          {state ? `${state.weather.temp}°` : '--°'}
        </span>
      </button>

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            data-weather-modal="true"
            role="dialog"
            aria-modal="true"
            aria-label={tr('Vremea locală și prognoză', 'Local weather forecast', 'Прогноз погоды')}
            onClick={closeModal}
            className="fixed inset-0 z-[9998] bg-black/65 backdrop-blur-md flex items-center justify-center p-3 sm:p-5"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md max-h-[88vh] overflow-y-auto rounded-3xl bg-[#0e1422]/95 border border-white/15 shadow-[0_24px_80px_rgba(0,0,0,0.7)] text-white p-4 sm:p-5 space-y-4"
            >
              {/* Header: Location + Refresh + Close */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-sky-300 text-xs font-bold uppercase tracking-wider">
                    <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">
                      {state
                        ? `${state.location.name}${state.location.country ? `, ${state.location.country}` : ''}`
                        : tr('Detectare locație...', 'Detecting location...', 'Определение города...')}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    {conditionText}
                    {updatedTimeLabel ? ` · ${updatedTimeLabel}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => void refreshWeather()}
                    disabled={isLoading}
                    aria-label={tr('Actualizează vremea', 'Refresh weather', 'Обновить погоду')}
                    title={tr('Actualizează vremea', 'Refresh weather', 'Обновить погоду')}
                    className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 focus:bg-white focus:text-zinc-950 focus:outline-none inline-flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
                      aria-hidden="true"
                    />
                  </button>
                  <button
                    ref={closeBtnRef}
                    type="button"
                    onClick={closeModal}
                    aria-label={tr('Închide', 'Close', 'Закрыть')}
                    title={tr('Închide (Esc)', 'Close (Esc)', 'Закрыть (Esc)')}
                    className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 focus:bg-white focus:text-zinc-950 focus:outline-none inline-flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* Hero Current Weather */}
              {state ? (
                <>
                  <div className="flex items-center justify-between gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-white/[0.04] border border-white/12 px-4 py-3.5">
                    <div className="flex items-center gap-3.5">
                      {renderWeatherIcon(
                        state.weather.code,
                        state.weather.isDay,
                        'w-12 h-12 shrink-0 drop-shadow'
                      )}
                      <div>
                        <div className="text-4xl font-black tabular-nums leading-none tracking-tight">
                          {state.weather.temp}°C
                        </div>
                        <div className="text-xs text-zinc-200 font-semibold mt-1">
                          {conditionText}
                        </div>
                      </div>
                    </div>
                    {state.weather.daily[0] && (
                      <div className="text-right text-xs text-zinc-300 tabular-nums space-y-0.5 shrink-0">
                        <div className="font-bold text-white">
                          H: {state.weather.daily[0].maxTemp}°
                        </div>
                        <div className="text-zinc-400">
                          L: {state.weather.daily[0].minTemp}°
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Quick Metrics */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-white/[0.06] border border-white/10 px-2.5 py-2 text-center">
                      <div className="inline-flex items-center gap-1 text-[10px] text-zinc-400 font-semibold">
                        <Thermometer className="w-3 h-3" aria-hidden="true" />
                        <span>{tr('Resimțit', 'Feels like', 'Ощущ.')}</span>
                      </div>
                      <div className="text-sm font-extrabold tabular-nums mt-0.5">
                        {state.weather.feelsLike}°C
                      </div>
                    </div>
                    <div className="rounded-xl bg-white/[0.06] border border-white/10 px-2.5 py-2 text-center">
                      <div className="inline-flex items-center gap-1 text-[10px] text-zinc-400 font-semibold">
                        <Droplets className="w-3 h-3 text-sky-300" aria-hidden="true" />
                        <span>{tr('Umiditate', 'Humidity', 'Влажн.')}</span>
                      </div>
                      <div className="text-sm font-extrabold tabular-nums mt-0.5">
                        {state.weather.humidity}%
                      </div>
                    </div>
                    <div className="rounded-xl bg-white/[0.06] border border-white/10 px-2.5 py-2 text-center">
                      <div className="inline-flex items-center gap-1 text-[10px] text-zinc-400 font-semibold">
                        <Wind className="w-3 h-3 text-cyan-300" aria-hidden="true" />
                        <span>{tr('Vânt', 'Wind', 'Ветер')}</span>
                      </div>
                      <div className="text-sm font-extrabold tabular-nums mt-0.5">
                        {state.weather.windKmh} km/h
                      </div>
                    </div>
                  </div>

                  {/* Next 8 Hours */}
                  {state.weather.hourly.length > 0 && (
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
                        {tr('Următoarele ore', 'Next hours', 'По часам')}
                      </div>
                      <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                        {state.weather.hourly.slice(0, 8).map((h) => (
                          <div
                            key={h.time}
                            className="rounded-xl bg-white/[0.05] border border-white/[0.08] py-2 px-1 flex flex-col items-center gap-1 text-center"
                          >
                            <span className="text-[10px] text-zinc-400 tabular-nums">
                              {h.hourLabel}
                            </span>
                            {renderWeatherIcon(h.code, h.isDay, 'w-4 h-4')}
                            <span className="text-xs font-bold tabular-nums">{h.temp}°</span>
                            {h.precipProb >= 20 ? (
                              <span className="text-[9px] font-bold text-sky-300 tabular-nums leading-none">
                                {h.precipProb}%
                              </span>
                            ) : (
                              <span className="text-[9px] text-transparent leading-none">0%</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 5-Day Forecast */}
                  {state.weather.daily.length > 0 && (
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                        {tr('Prognoză 5 zile', '5-Day Forecast', 'Прогноз на 5 дней')}
                      </div>
                      <div className="divide-y divide-white/[0.08] rounded-2xl bg-white/[0.04] border border-white/[0.08] px-3">
                        {state.weather.daily.map((d, idx) => (
                          <div
                            key={d.date}
                            className="py-2 flex items-center justify-between gap-2 text-xs"
                          >
                            <span className="w-16 font-semibold text-zinc-200">
                              {formatDayName(d.date, idx, uiLang)}
                            </span>
                            <div className="flex items-center gap-2 min-w-[70px]">
                              {renderWeatherIcon(d.code, true, 'w-4 h-4 shrink-0')}
                              {d.precipProb >= 20 ? (
                                <span className="text-[11px] font-bold text-sky-300 tabular-nums">
                                  {d.precipProb}%
                                </span>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-2.5 tabular-nums">
                              <span className="text-zinc-400">{d.minTemp}°</span>
                              <span className="font-extrabold text-white w-8 text-right">
                                {d.maxTemp}°
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-8 flex flex-col items-center justify-center gap-2 text-zinc-300">
                  <Loader2 className="w-6 h-6 animate-spin text-sky-400" aria-hidden="true" />
                  <span className="text-xs">
                    {tr('Se încarcă vremea locală...', 'Loading local weather...', 'Загрузка погоды...')}
                  </span>
                </div>
              )}

              {/* City Picker & Auto/GPS Location */}
              <div className="pt-2 border-t border-white/10 space-y-2.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void refreshWeather({ forceIp: true })}
                    disabled={isLoading}
                    className="flex-1 min-h-[38px] px-3 rounded-xl bg-white/10 hover:bg-white/20 focus:bg-white focus:text-zinc-950 focus:outline-none text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{tr('Auto (IP)', 'Auto (IP)', 'Авто (IP)')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleUseGps}
                    disabled={isLoading}
                    className="flex-1 min-h-[38px] px-3 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/30 text-sky-200 focus:bg-white focus:text-zinc-950 focus:outline-none text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <LocateFixed className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{tr('GPS Exact', 'Exact GPS', 'Точный GPS')}</span>
                  </button>
                </div>

                <div className="relative">
                  <Search
                    className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    value={cityQuery}
                    onChange={(e) => setCityQuery(e.target.value)}
                    placeholder={tr(
                      'Schimbă orașul (ex. București, Cluj, Chișinău)...',
                      'Change city (e.g. London, Bucharest)...',
                      'Сменить город (напр. Кишинёв, Бухарест)...'
                    )}
                    aria-label={tr('Caută oraș', 'Search city', 'Поиск города')}
                    className="w-full h-10 pl-9 pr-8 rounded-xl bg-white/[0.08] border border-white/15 text-xs text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                  {isSearchingCity && (
                    <Loader2
                      className="w-3.5 h-3.5 text-sky-400 animate-spin absolute right-3 top-1/2 -translate-y-1/2"
                      aria-hidden="true"
                    />
                  )}
                </div>

                {cityResults.length > 0 && (
                  <div className="rounded-xl bg-white/[0.06] border border-white/12 divide-y divide-white/[0.08] overflow-hidden">
                    {cityResults.map((c) => (
                      <button
                        key={`${c.id}_${c.latitude}_${c.longitude}`}
                        type="button"
                        onClick={() => {
                          setCityQuery('');
                          setCityResults([]);
                          void refreshWeather({
                            explicitLocation: {
                              name: c.name,
                              country: c.country,
                              lat: c.latitude,
                              lon: c.longitude,
                              source: 'manual',
                            },
                          });
                        }}
                        className="w-full px-3 py-2.5 text-left text-xs hover:bg-white/15 focus:bg-white focus:text-zinc-950 focus:outline-none flex items-center justify-between gap-2 transition-colors cursor-pointer"
                      >
                        <span className="font-semibold truncate">
                          {c.name}
                          {c.admin1 && c.admin1 !== c.name ? `, ${c.admin1}` : ''}
                        </span>
                        <span className="text-[11px] opacity-70 shrink-0">{c.country}</span>
                      </button>
                    ))}
                  </div>
                )}

                {statusNote && (
                  <p className="text-[11px] text-amber-300 font-medium">{statusNote}</p>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
