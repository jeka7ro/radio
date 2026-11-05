import { useEffect, useState } from 'react';
import { ChannelEpgData, EpgProgramme, TvChannel } from '../types/radio';

export interface RawEpgChannelEntry {
  icon: string;
  programmes: Array<{
    t: string;
    d?: string;
    c?: string;
    s: number;
    e: number;
  }>;
}

export interface EpgApiResponse {
  channels: Record<string, RawEpgChannelEntry>;
  keyMap: Record<string, string>;
}

const mergedEpgState: EpgApiResponse = {
  channels: {},
  keyMap: {},
};

const countryEpgMap = new Map<string, EpgApiResponse>();
const loadedCountries = new Map<string, number>();
const inflightCountries = new Map<string, Promise<EpgApiResponse>>();
const listeners = new Set<() => void>();
let epgRevision = 0;

function notifyListeners() {
  epgRevision += 1;
  for (const listener of listeners) {
    listener();
  }
}

export function normalizeEpgLookupKey(
  raw: string,
  stripGenericWords = false
): string {
  const base = (raw || '')
    .toLowerCase()
    .replace(/[ăâäàá]/g, 'a')
    .replace(/[îïìí]/g, 'i')
    .replace(/[șşš]/g, 's')
    .replace(/[țţ]/g, 't')
    .replace(/[éèêë]/g, 'e')
    .replace(/[óòôö]/g, 'o')
    .replace(/[úùûü]/g, 'u')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(
      /\(\s*(1080[pi]?|720[pi]?|576[pi]?|480[pi]?|4k|uhd|hd|sd|russia|romania|moldova|архив|live|\d+)\s*\)/gi,
      ' '
    )
    .replace(/\([^+)]*\)/g, ' ')
    .split('/')[0]
    .replace(/\.(ro|ru|md|uk|gb|us|de|fr|it|es|ua|by|kz)(@\w+)?$/i, '')
    .replace(/\b(hd|fhd|uhd|4k|sd|live|orig|50fps|архив)\b/gi, ' ');

  const cleanBase = base.replace(/[^a-z0-9а-яё+]+/gi, '').trim();
  if (!stripGenericWords) {
    return cleanBase;
  }

  const stripped = base
    .replace(/\b(tv|тв|канал|channel|телеканал|romania|russia|moldova)\b/gi, ' ')
    .replace(/[^a-z0-9а-яё+]+/gi, '')
    .trim();

  return stripped.length >= 3 ? stripped : cleanBase;
}

export async function fetchEpgForCountry(
  countryCode: string
): Promise<EpgApiResponse> {
  const upper = (countryCode || 'RO').trim().toUpperCase();
  const normalizedCountry = upper === 'MD' ? 'RO' : upper;
  const now = Date.now();
  const lastLoaded = loadedCountries.get(normalizedCountry) || 0;

  if (now - lastLoaded < 10 * 60 * 1000) {
    return mergedEpgState;
  }

  const existingPromise = inflightCountries.get(normalizedCountry);
  if (existingPromise) {
    return existingPromise;
  }

  const promise = (async () => {
    try {
      const res = await fetch(
        `/api/tv-epg?country=${encodeURIComponent(normalizedCountry)}`
      );
      if (!res.ok) {
        return mergedEpgState;
      }
      const data = (await res.json()) as EpgApiResponse;
      if (data && data.channels) {
        countryEpgMap.set(normalizedCountry, {
          channels: data.channels || {},
          keyMap: data.keyMap || {},
        });
        Object.assign(mergedEpgState.channels, data.channels);
      }
      if (data && data.keyMap) {
        for (const [k, v] of Object.entries(data.keyMap)) {
          if (!mergedEpgState.keyMap[k]) {
            mergedEpgState.keyMap[k] = v;
          }
        }
      }
      loadedCountries.set(normalizedCountry, Date.now());
      notifyListeners();
      return mergedEpgState;
    } catch {
      return mergedEpgState;
    } finally {
      inflightCountries.delete(normalizedCountry);
    }
  })();

  inflightCountries.set(normalizedCountry, promise);
  return promise;
}

if (typeof window !== 'undefined') {
  window.setInterval(() => {
    if (listeners.size > 0) {
      notifyListeners();
    }
  }, 30_000);

  window.setTimeout(() => {
    void fetchEpgForCountry('RO');
    void fetchEpgForCountry('RU');
  }, 150);
}

function findRawEpgEntryInStore(
  channel: TvChannel,
  store: EpgApiResponse
): RawEpgChannelEntry | null {
  const { channels, keyMap } = store;
  const candidates: RawEpgChannelEntry[] = [];

  const pushIfFound = (entry?: RawEpgChannelEntry) => {
    if (entry && !candidates.includes(entry)) {
      candidates.push(entry);
    }
  };

  if (channel.tvgId) {
    pushIfFound(channels[channel.tvgId]);
    const cleanTvgId = channel.tvgId.replace(/@\w+$/, '');
    pushIfFound(channels[cleanTvgId]);
    const tk1 = normalizeEpgLookupKey(cleanTvgId, false);
    if (tk1 && keyMap[tk1]) pushIfFound(channels[keyMap[tk1]]);
    const tk2 = normalizeEpgLookupKey(cleanTvgId, true);
    if (tk2 && keyMap[tk2]) pushIfFound(channels[keyMap[tk2]]);
  }

  const nk1 = normalizeEpgLookupKey(channel.name, false);
  if (nk1 && keyMap[nk1]) pushIfFound(channels[keyMap[nk1]]);

  const nk2 = normalizeEpgLookupKey(channel.name, true);
  if (nk2 && keyMap[nk2]) pushIfFound(channels[keyMap[nk2]]);
  if (nk2 && keyMap[`${nk2}tv`]) pushIfFound(channels[keyMap[`${nk2}tv`]]);
  if (nk2 && keyMap[`${nk2}ro`]) pushIfFound(channels[keyMap[`${nk2}ro`]]);

  const withProg = candidates.find(
    (c) => c.programmes && c.programmes.length > 0
  );
  return withProg || candidates[0] || null;
}

function findRawEpgEntry(channel: TvChannel): RawEpgChannelEntry | null {
  const rawCountry = (channel.countryCode || 'RO').trim().toUpperCase();
  const primaryCountry = rawCountry === 'MD' ? 'RO' : rawCountry;
  const countryStore = countryEpgMap.get(primaryCountry);
  if (countryStore) {
    const match = findRawEpgEntryInStore(channel, countryStore);
    if (match && match.programmes && match.programmes.length > 0) {
      return match;
    }
  }
  return findRawEpgEntryInStore(channel, mergedEpgState);
}

export function resolveChannelEpg(channel: TvChannel | null): ChannelEpgData | null {
  if (!channel) return null;
  const entry = findRawEpgEntry(channel);
  if (!entry) return null;

  const nowMs = Date.now();
  const upcoming: EpgProgramme[] = [];
  let currentProg: EpgProgramme | undefined;
  let nextProg: EpgProgramme | undefined;

  for (const p of entry.programmes) {
    if (p.e <= nowMs) continue;
    const item: EpgProgramme = {
      title: p.t,
      desc: p.d,
      category: p.c,
      start: p.s,
      stop: p.e,
    };

    if (p.s <= nowMs && p.e > nowMs) {
      currentProg = item;
    } else if (p.s > nowMs) {
      if (!nextProg) {
        nextProg = item;
      }
      upcoming.push(item);
    }
  }

  // If the first programme in the window starts slightly in the future and there's no active one
  if (!currentProg && entry.programmes.length > 0) {
    const first = entry.programmes.find((p) => p.e > nowMs);
    if (first && first.s <= nowMs + 15 * 60 * 1000) {
      currentProg = {
        title: first.t,
        desc: first.d,
        category: first.c,
        start: first.s,
        stop: first.e,
      };
    }
  }

  return {
    icon: entry.icon || undefined,
    now: currentProg,
    next: nextProg,
    upcoming: upcoming.slice(0, 4),
  };
}

export function enrichChannelsWithEpgLogos(channels: TvChannel[]): TvChannel[] {
  if (Object.keys(mergedEpgState.channels).length === 0) {
    return channels;
  }

  let changed = false;
  const next = channels.map((ch) => {
    const entry = findRawEpgEntry(ch);
    if (!entry || !entry.icon) return ch;

    const needsUpgrade =
      !ch.logo || /imgur\.com|wikia\.nocookie\.net/i.test(ch.logo);
    if (needsUpgrade && ch.logo !== entry.icon) {
      changed = true;
      return {
        ...ch,
        logo: entry.icon,
      };
    }
    return ch;
  });

  return changed ? next : channels;
}

export function useEpgRevision(): number {
  const [rev, setRev] = useState(epgRevision);

  useEffect(() => {
    const onUpdate = () => setRev(epgRevision);
    listeners.add(onUpdate);
    return () => {
      listeners.delete(onUpdate);
    };
  }, []);

  return rev;
}

export function useChannelEpg(channel: TvChannel | null): ChannelEpgData | null {
  useEpgRevision();

  useEffect(() => {
    if (!channel?.countryCode) return;
    void fetchEpgForCountry(channel.countryCode);
  }, [channel?.countryCode]);

  return resolveChannelEpg(channel);
}

export function formatEpgTime(ms: number): string {
  if (!ms) return '';
  try {
    return new Date(ms).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return '';
  }
}

export function getEpgProgressPercent(prog?: EpgProgramme): number {
  if (!prog) return 0;
  const total = prog.stop - prog.start;
  if (total <= 0) return 0;
  const elapsed = Date.now() - prog.start;
  return Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
}

export interface EpgTimingStats {
  progress: number;
  elapsedMin: number;
  remainingMin: number;
  totalMin: number;
  remainingShort: string;
}

export function getEpgTimingStats(prog?: EpgProgramme): EpgTimingStats {
  if (!prog) {
    return {
      progress: 0,
      elapsedMin: 0,
      remainingMin: 0,
      totalMin: 0,
      remainingShort: '',
    };
  }
  const now = Date.now();
  const totalMs = Math.max(60_000, prog.stop - prog.start);
  const elapsedMs = Math.max(0, Math.min(totalMs, now - prog.start));
  const remainingMs = Math.max(0, prog.stop - now);

  const progress = Math.max(
    0,
    Math.min(100, Math.round((elapsedMs / totalMs) * 100))
  );
  const totalMin = Math.max(1, Math.round(totalMs / 60_000));
  const elapsedMin = Math.min(totalMin, Math.floor(elapsedMs / 60_000));
  const remainingMin = Math.max(0, Math.ceil(remainingMs / 60_000));

  let remainingShort = '';
  if (remainingMin <= 0) {
    remainingShort = 'se termină acum';
  } else if (remainingMin >= 60) {
    const h = Math.floor(remainingMin / 60);
    const m = remainingMin % 60;
    remainingShort = m > 0 ? `mai sunt ${h}h ${m}m` : `mai sunt ${h}h`;
  } else {
    remainingShort = `mai sunt ${remainingMin} min`;
  }

  return {
    progress,
    elapsedMin,
    remainingMin,
    totalMin,
    remainingShort,
  };
}

const channelArchiveCache = new Map<string, EpgProgramme[]>();

export async function fetchChannelEpgArchive(
  channel: TvChannel | null
): Promise<EpgProgramme[]> {
  if (!channel) return [];
  const cacheKey = `${channel.countryCode || 'RU'}_${channel.tvgId || ''}_${channel.name}`;
  const cached = channelArchiveCache.get(cacheKey);
  if (cached) return cached;

  try {
    const params = new URLSearchParams();
    params.set('country', channel.countryCode || 'RU');
    if (channel.tvgId) params.set('tvgId', channel.tvgId);
    params.set('name', channel.name);

    const res = await fetch(`/api/tv-epg-archive?${params.toString()}`);
    if (!res.ok) return [];

    const data = (await res.json()) as {
      programmes?: Array<{
        t: string;
        d?: string;
        c?: string;
        s: number;
        e: number;
      }>;
    };

    const list: EpgProgramme[] = (data.programmes || [])
      .map((p) => ({
        title: p.t,
        desc: p.d,
        category: p.c,
        start: p.s,
        stop: p.e,
      }))
      .sort((a, b) => a.start - b.start);

    if (list.length > 0) {
      channelArchiveCache.set(cacheKey, list);
    }
    return list;
  } catch {
    return [];
  }
}

export function getEpgDayKey(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatEpgDayLabel(dayKey: string): string {
  const todayKey = getEpgDayKey(Date.now());
  const yesterdayKey = getEpgDayKey(Date.now() - 86_400_000);
  const tomorrowKey = getEpgDayKey(Date.now() + 86_400_000);

  const [y, m, d] = dayKey.split('-').map(Number);
  const dateObj = new Date(y, (m || 1) - 1, d || 1);
  const shortDate = dateObj.toLocaleDateString('ro-RO', {
    day: '2-digit',
    month: 'short',
  });
  const weekday = dateObj.toLocaleDateString('ro-RO', {
    weekday: 'short',
  });

  if (dayKey === todayKey) return `Azi (${shortDate})`;
  if (dayKey === yesterdayKey) return `Ieri (${shortDate})`;
  if (dayKey === tomorrowKey) return `Mâine (${shortDate})`;
  return `${weekday}, ${shortDate}`;
}

