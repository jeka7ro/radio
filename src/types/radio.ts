export interface Station {
  stationuuid: string;
  name: string;
  url: string;
  url_resolved: string;
  homepage: string;
  favicon: string;
  tags: string;
  country: string;
  countrycode: string;
  language: string;
  votes: number;
  codec: string;
  bitrate: number;
  hls: number;
  clickcount: number;
  clicktrend?: number;
  lastcheckok?: number;
}

export interface NowPlayingTrackMeta {
  rawTitle: string;
  artist: string;
  title: string;
  album?: string;
  coverUrl?: string;
  artistAvatarUrl?: string;
  updatedAt: number;
}

export interface EpgProgramme {
  title: string;
  desc?: string;
  category?: string;
  start: number;
  stop: number;
}

export interface ChannelEpgData {
  icon?: string;
  now?: EpgProgramme;
  next?: EpgProgramme;
  upcoming: EpgProgramme[];
}

export interface TvChannel {
  id: string;
  tvgId?: string;
  name: string;
  logo: string;
  url: string;
  group: string;
  countryCode: string;
  resolution: string;
  resolutionHeight: number;
  httpReferrer?: string;
  httpUserAgent?: string;
  tvgRec?: number;
  catchup?: string;
  catchupSource?: string;
  archiveProgram?: EpgProgramme;
}

export interface Country {
  name: string;
  iso_3166_1: string;
  stationcount: number;
}

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export type SortOption = 'votes' | 'clickcount' | 'bitrate' | 'name';

export type TvSortOption = 'quality' | 'name';

export type NavigationTab =
  | 'home'
  | 'tv'
  | 'mediateca'
  | 'countries'
  | 'favorites'
  | 'settings';

export type LanguageCode = 'ro' | 'en';

export type ThemeMode = 'system' | 'dark' | 'light';
