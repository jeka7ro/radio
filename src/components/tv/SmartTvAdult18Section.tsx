import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Check,
  ChevronDown,
  Clock,
  Delete,
  Flame,
  Loader2,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { FilmioStartupLoader } from '../common/FilmioStartupLoader';
import { VodPosterWatchedControl } from '../common/VodPosterWatchedControl';
import {
  type CinemetaItem,
  type SeriesEpisodeStats,
  type VodWatchProgressEntry,
  findWatchProgressEntry,
  handleVodPosterImgError,
  resolveSafeVodPosterUrl,
} from '../../views/smartTvLampaHelpers';

const TMDB_DISCOVER_KEY = '15d2ea6d0dc1d476efbca3eba2b9bbfb';

// Strict cinema erotic / 18+ adult themes (never hardcore tube porn, never anime/kids/reality)
const TMDB_EXPLICIT_KEYWORDS = '282903|347060|155477|190370|158713|1817|256466|445';
const TMDB_EXCLUDED_GENRE_SET = new Set([16, 10751, 99, 10762, 10763, 10764, 10767]);
const ADULT18_KEYS_LATIN = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L',
  'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X',
  'Y', 'Z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
];
const TMDB_EROTIC_MOVIE_KEYWORDS =
  '1664|190370|207767|256466|298666|364719|302868|158713|459|3182|14794';
const TMDB_EROTIC_TV_KEYWORDS =
  '1664|190370|207767|256466|298666|364719|302868|158713|459|3182|14794|5906|2943';
const TMDB_EXCLUDED_MOVIE_GENRES = '16,10751,99';
const TMDB_EXCLUDED_TV_GENRES = '16,10751,10762,10763,10764,10767,99';

const TMDB_GENRE_ID_TO_NAME: Record<number, string> = {
  18: 'Drama',
  10749: 'Romance',
  53: 'Thriller',
  35: 'Comedy',
  80: 'Crime',
  9648: 'Mystery',
  27: 'Horror',
  36: 'History',
  14: 'Fantasy',
  878: 'Sci-Fi',
  10759: 'Action & Adventure',
  10765: 'Sci-Fi & Fantasy',
};

type AdultMediaFilter = 'all' | 'movie' | 'series';
type AdultThemeFilter = 'all' | 'erotic' | 'thriller' | 'drama' | 'romance' | 'comedy';
type AdultSortOption = 'erotic_desc' | 'erotic_asc' | 'popular' | 'rating' | 'newest';
type DropdownKind = 'year' | 'country' | 'theme' | 'sort';

interface FlagshipAdultItem {
  id: string;
  name: string;
  type: 'movie' | 'series';
  year: number;
  countries: string[];
  imdbRating: string;
  eroticPct: number;
  genres: string[];
  themes: Array<Exclude<AdultThemeFilter, 'all'>>;
}

// Verified iconic 18+ erotic & adult cinema movies & TV series (real IMDb IDs + explicitness % 48..98)
const FLAGSHIP_ADULT_18_ITEMS: FlagshipAdultItem[] = [
  // Very Explicit / Unsimulated Art & Adult Cinema (90%–99%)
  { id: 'tt0249380', name: 'Baise-moi', type: 'movie', year: 2000, countries: ['FR'], imdbRating: '4.8', eroticPct: 99, genres: ['Erotic', 'Thriller', 'Drama'], themes: ['erotic', 'thriller', 'drama'] },
  { id: 'tt3774694', name: 'Love', type: 'movie', year: 2015, countries: ['FR'], imdbRating: '6.1', eroticPct: 98, genres: ['Erotic', 'Drama', 'Romance'], themes: ['erotic', 'romance', 'drama'] },
  { id: 'tt0194314', name: 'Romance', type: 'movie', year: 1999, countries: ['FR'], imdbRating: '5.5', eroticPct: 98, genres: ['Erotic', 'Drama'], themes: ['erotic', 'drama'] },
  { id: 'tt2382009', name: 'Nymphomaniac: Vol. II', type: 'movie', year: 2013, countries: ['DE', 'FR'], imdbRating: '6.7', eroticPct: 98, genres: ['Erotic', 'Drama'], themes: ['erotic', 'drama'] },
  { id: 'tt0348529', name: 'Anatomy of Hell', type: 'movie', year: 2004, countries: ['FR'], imdbRating: '4.8', eroticPct: 98, genres: ['Erotic', 'Drama'], themes: ['erotic', 'drama'] },
  { id: 'tt0154421', name: 'The Idiots', type: 'movie', year: 1998, countries: ['DE'], imdbRating: '6.5', eroticPct: 97, genres: ['Erotic', 'Drama', 'Comedy'], themes: ['erotic', 'drama', 'comedy'] },
  { id: 'tt0209077', name: 'Ken Park', type: 'movie', year: 2002, countries: ['US'], imdbRating: '6.0', eroticPct: 97, genres: ['Erotic', 'Drama'], themes: ['erotic', 'drama'] },
  { id: 'tt0418832', name: 'Lie with Me', type: 'movie', year: 2005, countries: ['US'], imdbRating: '5.2', eroticPct: 96, genres: ['Erotic', 'Drama', 'Romance'], themes: ['erotic', 'drama', 'romance'] },
  { id: 'tt0870984', name: 'Antichrist', type: 'movie', year: 2009, countries: ['DE', 'FR'], imdbRating: '6.6', eroticPct: 96, genres: ['Erotic', 'Drama', 'Thriller'], themes: ['erotic', 'drama', 'thriller'] },
  { id: 'tt0098063', name: 'Paprika', type: 'movie', year: 1991, countries: ['IT'], imdbRating: '7.2', eroticPct: 95, genres: ['Erotic', 'Drama'], themes: ['erotic', 'drama'] },
  { id: 'tt0104014', name: 'All Ladies Do It', type: 'movie', year: 1992, countries: ['IT'], imdbRating: '5.1', eroticPct: 95, genres: ['Erotic', 'Comedy'], themes: ['erotic', 'comedy'] },
  { id: 'tt0174931', name: 'Frivolous Lola', type: 'movie', year: 1998, countries: ['IT'], imdbRating: '5.2', eroticPct: 95, genres: ['Erotic', 'Comedy'], themes: ['erotic', 'comedy'] },
  { id: 'tt0089598', name: 'Miranda', type: 'movie', year: 1985, countries: ['IT'], imdbRating: '5.1', eroticPct: 94, genres: ['Erotic', 'Comedy', 'Drama'], themes: ['erotic', 'comedy', 'drama'] },
  { id: 'tt0200192', name: 'Cheeky', type: 'movie', year: 2000, countries: ['IT'], imdbRating: '5.6', eroticPct: 94, genres: ['Erotic', 'Comedy'], themes: ['erotic', 'comedy'] },
  { id: 'tt0111573', name: 'The Voyeur', type: 'movie', year: 1994, countries: ['IT'], imdbRating: '6.4', eroticPct: 94, genres: ['Erotic', 'Drama'], themes: ['erotic', 'drama'] },
  { id: 'tt0075163', name: 'Salon Kitty', type: 'movie', year: 1976, countries: ['IT', 'DE'], imdbRating: '5.6', eroticPct: 94, genres: ['Erotic', 'Drama'], themes: ['erotic', 'drama'] },
  { id: 'tt0071464', name: 'Emmanuelle', type: 'movie', year: 1974, countries: ['FR'], imdbRating: '6.0', eroticPct: 93, genres: ['Erotic', 'Drama', 'Romance'], themes: ['erotic', 'drama', 'romance'] },
  { id: 'tt0073115', name: 'The Story of O', type: 'movie', year: 1975, countries: ['FR', 'DE'], imdbRating: '5.5', eroticPct: 93, genres: ['Erotic', 'Drama'], themes: ['erotic', 'drama'] },
  { id: 'tt8550054', name: 'Pleasure', type: 'movie', year: 2021, countries: ['US'], imdbRating: '6.3', eroticPct: 93, genres: ['Erotic', 'Drama'], themes: ['erotic', 'drama'] },
  { id: 'tt2080323', name: 'Hotel Desire', type: 'movie', year: 2011, countries: ['DE'], imdbRating: '6.1', eroticPct: 93, genres: ['Erotic', 'Drama', 'Romance'], themes: ['erotic', 'drama', 'romance'] },
  { id: 'tt2524674', name: 'Wetlands', type: 'movie', year: 2013, countries: ['DE'], imdbRating: '5.4', eroticPct: 92, genres: ['Erotic', 'Comedy', 'Drama'], themes: ['erotic', 'comedy', 'drama'] },
  { id: 'tt2852458', name: 'Stranger by the Lake', type: 'movie', year: 2013, countries: ['FR'], imdbRating: '6.2', eroticPct: 92, genres: ['Erotic', 'Thriller', 'Drama'], themes: ['erotic', 'thriller', 'drama'] },
  { id: 'tt21106646', name: 'The Next 365 Days', type: 'movie', year: 2022, countries: ['PL'], imdbRating: '6.4', eroticPct: 90, genres: ['Erotic', 'Drama', 'Romance'], themes: ['erotic', 'romance', 'drama'] },
  { id: 'tt0115964', name: 'Crash', type: 'movie', year: 1996, countries: ['US'], imdbRating: '6.5', eroticPct: 89, genres: ['Erotic', 'Drama', 'Thriller'], themes: ['erotic', 'drama', 'thriller'] },
  { id: 'tt2205401', name: 'Addicted', type: 'movie', year: 2014, countries: ['US'], imdbRating: '5.9', eroticPct: 88, genres: ['Erotic', 'Thriller', 'Drama'], themes: ['erotic', 'thriller', 'drama'] },
  { id: 'tt6367558', name: 'Double Lover', type: 'movie', year: 2017, countries: ['FR'], imdbRating: '6.1', eroticPct: 87, genres: ['Erotic', 'Thriller', 'Drama'], themes: ['erotic', 'thriller', 'drama'] },
  { id: 'tt0411705', name: '9 Songs', type: 'movie', year: 2004, countries: ['GB'], imdbRating: '4.8', eroticPct: 98, genres: ['Erotic', 'Drama', 'Romance'], themes: ['erotic', 'drama', 'romance'] },
  { id: 'tt0074102', name: 'In the Realm of the Senses', type: 'movie', year: 1976, countries: ['JP', 'FR'], imdbRating: '6.6', eroticPct: 98, genres: ['Erotic', 'Drama'], themes: ['erotic', 'drama'] },
  { id: 'tt0367027', name: 'Shortbus', type: 'movie', year: 2006, countries: ['US'], imdbRating: '6.4', eroticPct: 97, genres: ['Erotic', 'Comedy', 'Drama'], themes: ['erotic', 'comedy', 'drama'] },
  { id: 'tt1937390', name: 'Nymphomaniac: Vol. I', type: 'movie', year: 2013, countries: ['DE', 'FR'], imdbRating: '6.9', eroticPct: 96, genres: ['Erotic', 'Drama'], themes: ['erotic', 'drama'] },
  { id: 'tt0080491', name: 'Caligula', type: 'movie', year: 1979, countries: ['IT', 'US'], imdbRating: '5.3', eroticPct: 96, genres: ['Erotic', 'Drama', 'History'], themes: ['erotic', 'drama'] },
  { id: 'tt1879030', name: 'Q (Desire)', type: 'movie', year: 2011, countries: ['FR'], imdbRating: '4.9', eroticPct: 94, genres: ['Erotic', 'Drama'], themes: ['erotic', 'drama'] },
  { id: 'tt0256103', name: 'Intimacy', type: 'movie', year: 2001, countries: ['GB', 'FR'], imdbRating: '6.1', eroticPct: 93, genres: ['Erotic', 'Drama'], themes: ['erotic', 'drama'] },
  { id: 'tt0085328', name: 'The Key', type: 'movie', year: 1983, countries: ['IT'], imdbRating: '5.9', eroticPct: 92, genres: ['Erotic', 'Drama'], themes: ['erotic', 'drama'] },
  { id: 'tt0330099', name: 'The Brown Bunny', type: 'movie', year: 2003, countries: ['US', 'JP'], imdbRating: '5.1', eroticPct: 92, genres: ['Erotic', 'Drama'], themes: ['erotic', 'drama'] },
  { id: 'tt2278871', name: 'Blue Is the Warmest Colour', type: 'movie', year: 2013, countries: ['FR'], imdbRating: '7.7', eroticPct: 91, genres: ['Erotic', 'Drama', 'Romance'], themes: ['erotic', 'drama', 'romance'] },
  { id: 'tt10886166', name: '365 Days', type: 'movie', year: 2020, countries: ['PL'], imdbRating: '3.3', eroticPct: 90, genres: ['Erotic', 'Drama', 'Romance'], themes: ['erotic', 'romance', 'drama'] },
  { id: 'tt12996154', name: '365 Days: This Day', type: 'movie', year: 2022, countries: ['PL'], imdbRating: '2.6', eroticPct: 90, genres: ['Erotic', 'Drama', 'Romance'], themes: ['erotic', 'romance', 'drama'] },
  { id: 'tt1442449', name: 'Spartacus', type: 'series', year: 2010, countries: ['US'], imdbRating: '8.5', eroticPct: 90, genres: ['Drama', 'Action'], themes: ['erotic', 'drama'] },
  // Strong Erotic Cinema & Series (75%–89%)
  { id: 'tt5073620', name: 'Below Her Mouth', type: 'movie', year: 2016, countries: ['US'], imdbRating: '5.5', eroticPct: 89, genres: ['Erotic', 'Drama', 'Romance'], themes: ['erotic', 'romance', 'drama'] },
  { id: 'tt1263750', name: 'Room in Rome', type: 'movie', year: 2010, countries: ['ES'], imdbRating: '6.1', eroticPct: 88, genres: ['Erotic', 'Drama', 'Romance'], themes: ['erotic', 'romance', 'drama'] },
  { id: 'tt10839422', name: 'Sex/Life', type: 'series', year: 2021, countries: ['US'], imdbRating: '5.6', eroticPct: 88, genres: ['Erotic', 'Drama', 'Romance'], themes: ['erotic', 'drama', 'romance'] },
  { id: 'tt1723811', name: 'Shame', type: 'movie', year: 2011, countries: ['GB'], imdbRating: '7.2', eroticPct: 87, genres: ['Erotic', 'Drama'], themes: ['erotic', 'drama'] },
  { id: 'tt0309987', name: 'The Dreamers', type: 'movie', year: 2003, countries: ['FR', 'IT', 'GB'], imdbRating: '7.1', eroticPct: 86, genres: ['Erotic', 'Drama', 'Romance'], themes: ['erotic', 'drama', 'romance'] },
  { id: 'tt12540080', name: 'Dark Desire', type: 'series', year: 2020, countries: ['ES'], imdbRating: '6.5', eroticPct: 85, genres: ['Erotic', 'Thriller', 'Drama'], themes: ['erotic', 'thriller', 'drama'] },
  { id: 'tt18831118', name: 'Obsession', type: 'series', year: 2023, countries: ['GB'], imdbRating: '5.2', eroticPct: 84, genres: ['Erotic', 'Thriller', 'Drama'], themes: ['erotic', 'thriller', 'drama'] },
  { id: 'tt27951663', name: 'Fatal Seduction', type: 'series', year: 2023, countries: ['GB'], imdbRating: '5.5', eroticPct: 84, genres: ['Erotic', 'Thriller', 'Drama'], themes: ['erotic', 'thriller', 'drama'] },
  { id: 'tt3846642', name: 'The Girlfriend Experience', type: 'series', year: 2016, countries: ['US'], imdbRating: '7.1', eroticPct: 84, genres: ['Erotic', 'Drama'], themes: ['erotic', 'drama'] },
  { id: 'tt4465564', name: 'Fifty Shades Darker', type: 'movie', year: 2017, countries: ['US'], imdbRating: '4.6', eroticPct: 84, genres: ['Erotic', 'Drama', 'Romance'], themes: ['erotic', 'romance', 'drama'] },
  { id: 'tt2322441', name: 'Fifty Shades of Grey', type: 'movie', year: 2015, countries: ['US'], imdbRating: '4.2', eroticPct: 83, genres: ['Erotic', 'Drama', 'Romance'], themes: ['erotic', 'romance', 'drama'] },
  { id: 'tt4477536', name: 'Fifty Shades Freed', type: 'movie', year: 2018, countries: ['US'], imdbRating: '4.5', eroticPct: 82, genres: ['Erotic', 'Drama', 'Romance'], themes: ['erotic', 'romance', 'drama'] },
  { id: 'tt4016934', name: 'The Handmaiden', type: 'movie', year: 2016, countries: ['KR'], imdbRating: '8.1', eroticPct: 82, genres: ['Erotic', 'Thriller', 'Drama'], themes: ['erotic', 'thriller', 'drama', 'romance'] },
  { id: 'tt4998350', name: 'The Deuce', type: 'series', year: 2017, countries: ['US'], imdbRating: '8.1', eroticPct: 82, genres: ['Drama'], themes: ['erotic', 'drama'] },
  { id: 'tt8772296', name: 'Euphoria', type: 'series', year: 2019, countries: ['US'], imdbRating: '8.3', eroticPct: 80, genres: ['Drama'], themes: ['drama', 'erotic'] },
  { id: 'tt14369780', name: "Lady Chatterley's Lover", type: 'movie', year: 2022, countries: ['GB'], imdbRating: '6.6', eroticPct: 80, genres: ['Erotic', 'Drama', 'Romance'], themes: ['erotic', 'romance', 'drama'] },
  { id: 'tt0808357', name: 'Lust, Caution', type: 'movie', year: 2007, countries: ['US'], imdbRating: '7.5', eroticPct: 80, genres: ['Erotic', 'Thriller', 'Drama'], themes: ['erotic', 'thriller', 'drama'] },
  { id: 'tt20247888', name: 'Emmanuelle', type: 'movie', year: 2024, countries: ['FR'], imdbRating: '4.9', eroticPct: 79, genres: ['Erotic', 'Drama'], themes: ['erotic', 'drama'] },
  { id: 'tt0101316', name: 'The Lover', type: 'movie', year: 1992, countries: ['FR', 'GB'], imdbRating: '6.8', eroticPct: 78, genres: ['Erotic', 'Drama', 'Romance'], themes: ['erotic', 'romance', 'drama'] },
  { id: 'tt0904208', name: 'Californication', type: 'series', year: 2007, countries: ['US'], imdbRating: '8.3', eroticPct: 78, genres: ['Comedy', 'Drama'], themes: ['erotic', 'comedy', 'drama'] },
  { id: 'tt2017109', name: 'Banshee', type: 'series', year: 2013, countries: ['US'], imdbRating: '8.4', eroticPct: 78, genres: ['Thriller', 'Drama'], themes: ['erotic', 'thriller', 'drama'] },
  { id: 'tt0844441', name: 'True Blood', type: 'series', year: 2008, countries: ['US'], imdbRating: '7.9', eroticPct: 78, genres: ['Drama', 'Fantasy'], themes: ['erotic', 'drama'] },
  { id: 'tt0384766', name: 'Rome', type: 'series', year: 2005, countries: ['US', 'GB', 'IT'], imdbRating: '8.7', eroticPct: 78, genres: ['Drama', 'History'], themes: ['erotic', 'drama'] },
  { id: 'tt9059760', name: 'Normal People', type: 'series', year: 2020, countries: ['GB'], imdbRating: '8.4', eroticPct: 76, genres: ['Drama', 'Romance'], themes: ['erotic', 'drama', 'romance'] },
  { id: 'tt0120663', name: 'Eyes Wide Shut', type: 'movie', year: 1999, countries: ['US', 'GB'], imdbRating: '7.5', eroticPct: 76, genres: ['Erotic', 'Thriller', 'Drama'], themes: ['erotic', 'thriller', 'drama'] },
  { id: 'tt0103772', name: 'Basic Instinct', type: 'movie', year: 1992, countries: ['US'], imdbRating: '7.0', eroticPct: 76, genres: ['Erotic', 'Thriller'], themes: ['erotic', 'thriller'] },
  { id: 'tt30057084', name: 'Babygirl', type: 'movie', year: 2024, countries: ['US'], imdbRating: '6.0', eroticPct: 75, genres: ['Erotic', 'Thriller', 'Drama'], themes: ['erotic', 'thriller', 'drama'] },
  { id: 'tt11235772', name: 'The Voyeurs', type: 'movie', year: 2021, countries: ['US'], imdbRating: '6.0', eroticPct: 75, genres: ['Erotic', 'Thriller'], themes: ['erotic', 'thriller'] },
  { id: 'tt0104779', name: 'Bitter Moon', type: 'movie', year: 1992, countries: ['FR', 'GB'], imdbRating: '7.2', eroticPct: 75, genres: ['Erotic', 'Thriller', 'Drama'], themes: ['erotic', 'thriller', 'drama'] },
  { id: 'tt2431438', name: 'Sense8', type: 'series', year: 2015, countries: ['US'], imdbRating: '8.2', eroticPct: 75, genres: ['Drama', 'Thriller'], themes: ['erotic', 'drama'] },
  // Medium-Strong Sensual & Adult Drama/Thriller (60%–74%)
  { id: 'tt7134908', name: 'Elite', type: 'series', year: 2018, countries: ['ES'], imdbRating: '7.2', eroticPct: 74, genres: ['Thriller', 'Drama'], themes: ['erotic', 'thriller', 'drama'] },
  { id: 'tt13018148', name: 'Tell Me Lies', type: 'series', year: 2022, countries: ['US'], imdbRating: '6.9', eroticPct: 74, genres: ['Erotic', 'Drama', 'Romance'], themes: ['erotic', 'drama', 'romance'] },
  { id: 'tt8693266', name: 'Toy Boy', type: 'series', year: 2019, countries: ['ES'], imdbRating: '6.5', eroticPct: 74, genres: ['Erotic', 'Thriller', 'Drama'], themes: ['erotic', 'thriller', 'drama'] },
  { id: 'tt2137109', name: 'Masters of Sex', type: 'series', year: 2013, countries: ['US'], imdbRating: '7.9', eroticPct: 74, genres: ['Drama', 'Romance'], themes: ['erotic', 'drama'] },
  { id: 'tt14230458', name: 'Poor Things', type: 'movie', year: 2023, countries: ['GB', 'US'], imdbRating: '7.8', eroticPct: 73, genres: ['Comedy', 'Drama', 'Romance'], themes: ['drama', 'comedy', 'romance'] },
  { id: 'tt0250797', name: 'Unfaithful', type: 'movie', year: 2002, countries: ['US', 'FR'], imdbRating: '6.7', eroticPct: 72, genres: ['Erotic', 'Thriller', 'Drama'], themes: ['erotic', 'thriller', 'drama'] },
  { id: 'tt0254686', name: 'The Piano Teacher', type: 'movie', year: 2001, countries: ['FR'], imdbRating: '7.5', eroticPct: 72, genres: ['Erotic', 'Drama'], themes: ['erotic', 'drama'] },
  { id: 'tt0218922', name: 'Original Sin', type: 'movie', year: 2001, countries: ['US', 'FR'], imdbRating: '6.0', eroticPct: 72, genres: ['Erotic', 'Thriller', 'Romance'], themes: ['erotic', 'thriller', 'romance'] },
  { id: 'tt1314652', name: 'The Housemaid', type: 'movie', year: 2010, countries: ['KR'], imdbRating: '6.4', eroticPct: 70, genres: ['Erotic', 'Thriller', 'Drama'], themes: ['erotic', 'thriller', 'drama'] },
  { id: 'tt0274812', name: 'Secretary', type: 'movie', year: 2002, countries: ['US'], imdbRating: '7.0', eroticPct: 70, genres: ['Erotic', 'Comedy', 'Romance'], themes: ['erotic', 'comedy', 'romance'] },
  { id: 'tt0091635', name: '9½ Weeks', type: 'movie', year: 1986, countries: ['US'], imdbRating: '6.0', eroticPct: 68, genres: ['Erotic', 'Drama', 'Romance'], themes: ['erotic', 'romance', 'drama'] },
  { id: 'tt2699110', name: 'The Affair', type: 'series', year: 2014, countries: ['US'], imdbRating: '7.9', eroticPct: 66, genres: ['Drama', 'Thriller'], themes: ['erotic', 'drama', 'thriller'] },
  { id: 'tt7671070', name: 'Industry', type: 'series', year: 2020, countries: ['GB', 'US'], imdbRating: '7.4', eroticPct: 66, genres: ['Drama'], themes: ['erotic', 'drama'] },
  { id: 'tt9731288', name: 'Valeria', type: 'series', year: 2020, countries: ['ES'], imdbRating: '6.7', eroticPct: 64, genres: ['Comedy', 'Romance', 'Drama'], themes: ['erotic', 'comedy', 'romance'] },
  { id: 'tt17351924', name: 'Saltburn', type: 'movie', year: 2023, countries: ['GB', 'US'], imdbRating: '7.0', eroticPct: 62, genres: ['Thriller', 'Drama'], themes: ['erotic', 'thriller', 'drama'] },
  { id: 'tt8740790', name: 'Bridgerton', type: 'series', year: 2020, countries: ['US', 'GB'], imdbRating: '7.4', eroticPct: 62, genres: ['Drama', 'Romance'], themes: ['erotic', 'romance', 'drama'] },
  { id: 'tt2180339', name: 'Deep Water', type: 'movie', year: 2022, countries: ['US'], imdbRating: '5.5', eroticPct: 60, genres: ['Erotic', 'Thriller'], themes: ['erotic', 'thriller'] },
  // Mild / Soft Sensual 18+ (48%–59%)
  { id: 'tt11947418', name: 'Minx', type: 'series', year: 2022, countries: ['US'], imdbRating: '7.7', eroticPct: 58, genres: ['Comedy'], themes: ['erotic', 'comedy'] },
  { id: 'tt0213847', name: 'Malèna', type: 'movie', year: 2000, countries: ['IT'], imdbRating: '7.4', eroticPct: 54, genres: ['Drama', 'Romance'], themes: ['erotic', 'drama', 'romance'] },
  { id: 'tt16304446', name: 'Fair Play', type: 'movie', year: 2023, countries: ['US'], imdbRating: '6.4', eroticPct: 52, genres: ['Erotic', 'Thriller', 'Drama'], themes: ['thriller', 'drama'] },
  { id: 'tt16426418', name: 'Challengers', type: 'movie', year: 2024, countries: ['US'], imdbRating: '7.1', eroticPct: 48, genres: ['Drama', 'Romance'], themes: ['erotic', 'drama', 'romance'] },
];

const FLAGSHIP_IMDB_TO_TMDB_ID: Record<string, string> = {
  tt0249380: 'tmdb_movie_3134',
  tt0194314: 'tmdb_movie_26338',
  tt2382009: 'tmdb_movie_249397',
  tt0348529: 'tmdb_movie_2003',
  tt0154421: 'tmdb_movie_452',
  tt0209077: 'tmdb_movie_7090',
  tt0418832: 'tmdb_movie_14174',
  tt0870984: 'tmdb_movie_17609',
  tt0098063: 'tmdb_movie_50270',
  tt0104014: 'tmdb_movie_37265',
  tt0174931: 'tmdb_movie_50124',
  tt0089598: 'tmdb_movie_52212',
  tt0200192: 'tmdb_movie_22705',
  tt0111573: 'tmdb_movie_27066',
  tt0075163: 'tmdb_movie_40394',
  tt0071464: 'tmdb_movie_24402',
  tt0073115: 'tmdb_movie_4561',
  tt8550054: 'tmdb_movie_592695',
  tt2080323: 'tmdb_movie_82023',
  tt2524674: 'tmdb_movie_208277',
  tt2852458: 'tmdb_movie_186992',
  tt21106646: 'tmdb_movie_829560',
  tt0115964: 'tmdb_movie_884',
  tt2205401: 'tmdb_movie_235271',
  tt6367558: 'tmdb_movie_451955',
  tt3774694: 'tmdb_movie_292431',
  tt0411705: 'tmdb_movie_27',
  tt0074102: 'tmdb_movie_5879',
  tt0367027: 'tmdb_movie_1378',
  tt1937390: 'tmdb_movie_258216',
  tt0080491: 'tmdb_movie_9453',
  tt1879030: 'tmdb_movie_86331',
  tt0256103: 'tmdb_movie_11845',
  tt0085328: 'tmdb_movie_28468',
  tt0330099: 'tmdb_movie_12703',
  tt2278871: 'tmdb_movie_152584',
  tt10886166: 'tmdb_movie_664413',
  tt12996154: 'tmdb_movie_829557',
  tt1442449: 'tmdb_tv_46296',
  tt5073620: 'tmdb_movie_370663',
  tt1263750: 'tmdb_movie_48650',
  tt10839422: 'tmdb_tv_126280',
  tt1723811: 'tmdb_movie_76025',
  tt0309987: 'tmdb_movie_1278',
  tt12540080: 'tmdb_tv_105214',
  tt18831118: 'tmdb_tv_223313',
  tt27951663: 'tmdb_tv_227975',
  tt3846642: 'tmdb_tv_64387',
  tt4465564: 'tmdb_movie_341174',
  tt2322441: 'tmdb_movie_216015',
  tt4477536: 'tmdb_movie_337167',
  tt4016934: 'tmdb_movie_290098',
  tt4998350: 'tmdb_tv_65817',
  tt8772296: 'tmdb_tv_85552',
  tt14369780: 'tmdb_movie_814338',
  tt0808357: 'tmdb_movie_4588',
  tt20247888: 'tmdb_movie_976576',
  tt0101316: 'tmdb_movie_10995',
  tt0904208: 'tmdb_tv_1215',
  tt2017109: 'tmdb_tv_41727',
  tt0844441: 'tmdb_tv_10545',
  tt0384766: 'tmdb_tv_1891',
  tt9059760: 'tmdb_tv_89905',
  tt0120663: 'tmdb_movie_345',
  tt0103772: 'tmdb_movie_402',
  tt30057084: 'tmdb_movie_1097549',
  tt11235772: 'tmdb_movie_645710',
  tt0104779: 'tmdb_movie_10497',
  tt2431438: 'tmdb_tv_61664',
  tt7134908: 'tmdb_tv_76669',
  tt13018148: 'tmdb_tv_130464',
  tt8693266: 'tmdb_tv_87763',
  tt2137109: 'tmdb_tv_58937',
  tt14230458: 'tmdb_movie_792307',
  tt0250797: 'tmdb_movie_2251',
  tt0254686: 'tmdb_movie_1791',
  tt0218922: 'tmdb_movie_2057',
  tt1314652: 'tmdb_movie_45202',
  tt0274812: 'tmdb_movie_11013',
  tt0091635: 'tmdb_movie_10068',
  tt2699110: 'tmdb_tv_61463',
  tt7671070: 'tmdb_tv_90812',
  tt9731288: 'tmdb_tv_101918',
  tt17351924: 'tmdb_movie_930564',
  tt8740790: 'tmdb_tv_91239',
  tt2180339: 'tmdb_movie_619979',
  tt11947418: 'tmdb_tv_118303',
  tt0213847: 'tmdb_movie_10867',
  tt16304446: 'tmdb_movie_910571',
  tt16426418: 'tmdb_movie_937287',
};

const eroticPctByItemId = new Map<string, number>(
  FLAGSHIP_ADULT_18_ITEMS.map((f) => [f.id, f.eroticPct])
);
const FLAGSHIP_PCT_BY_TITLE = new Map<string, number>(
  FLAGSHIP_ADULT_18_ITEMS.map((f) => [
    `${f.type}:${normalizeTitleKey(f.name)}`,
    f.eroticPct,
  ])
);

function estimateTmdbEroticPct(
  row: Record<string, unknown>,
  kind: 'movie' | 'tv',
  isExplicitTier: boolean
): number {
  const rawTitle = String(
    kind === 'movie'
      ? row.title || row.original_title || ''
      : row.name || row.original_name || ''
  );
  const titleNorm = `${kind === 'tv' ? 'series' : 'movie'}:${normalizeTitleKey(rawTitle)}`;
  const known = FLAGSHIP_PCT_BY_TITLE.get(titleNorm);
  if (typeof known === 'number') return known;

  const text = `${rawTitle} ${String(row.overview || '')}`.toLowerCase();
  let score = isExplicitTier ? 74 : 56;
  if (row.adult === true) score += 18;
  if (/\b(unsimulated|hardcore|porno|pornograph|orgy|orgies|nymphomaniac|sex club|swingers)\b/i.test(text)) {
    score += 18;
  } else if (/\b(explicit|bdsm|fetish|dominatrix|prostitut|escort|brothel|stripper|erotic|sensual|voyeur)\b/i.test(text)) {
    score += 11;
  }
  if (/\b(sex|sexual|lust|seduc|nude|nudity|naked|pleasure|taboo|obsess|desire|carnal|intimate)\b/i.test(text)) {
    score += 7;
  }
  if (/\b(affair|passion|lover|infidelity|forbidden|temptation)\b/i.test(text)) {
    score += 4;
  }
  const idSpread = Math.abs(Number(row.id) || 0) % 5;
  return Math.max(35, Math.min(96, score + idSpread));
}

function getItemEroticPct(item: CinemetaItem): number {
  const direct = eroticPctByItemId.get(item.id);
  if (typeof direct === 'number') return direct;
  if (item.imdbId) {
    const byImdb = eroticPctByItemId.get(item.imdbId);
    if (typeof byImdb === 'number') return byImdb;
  }
  const byTitle =
    FLAGSHIP_PCT_BY_TITLE.get(`${item.type}:${normalizeTitleKey(item.name || '')}`) ??
    FLAGSHIP_PCT_BY_TITLE.get(`${item.type}:${normalizeTitleKey(item.nameOriginal || '')}`);
  return typeof byTitle === 'number' ? byTitle : 65;
}

function getEroticBadgeStyle(pct: number): string {
  if (pct >= 85) {
    return 'bg-rose-600/95 text-white border border-rose-300/45';
  }
  if (pct >= 68) {
    return 'bg-pink-600/90 text-white border border-pink-300/35';
  }
  return 'bg-zinc-950/88 text-rose-200 border border-rose-400/35';
}

const tmdbExternalImdbCache = new Map<string, string>();
const adultCatalogMemCache = new Map<string, { items: CinemetaItem[]; hasMore: boolean; ts: number }>();

const focusElSafely = (el: HTMLElement | null | undefined) => {
  if (!el) return;
  try {
    el.focus({ preventScroll: true });
  } catch {
    el.focus();
  }
};

function matchesYearFilter(year: number, yearFilter: string): boolean {
  if (!yearFilter || yearFilter === 'any') return true;
  if (!year || !Number.isFinite(year)) return false;
  if (yearFilter === '<1990') return year > 0 && year < 1990;
  if (yearFilter === '1990-1999') return year >= 1990 && year <= 1999;
  if (yearFilter === '2000-2009') return year >= 2000 && year <= 2009;
  if (yearFilter === '2010-2019') return year >= 2010 && year <= 2019;
  if (yearFilter === '2020-2026') return year >= 2020 && year <= 2026;
  return String(year) === yearFilter;
}

function getTmdbDateRangeParams(
  kind: 'movie' | 'tv',
  yearFilter: string
): Record<string, string> {
  if (!yearFilter || yearFilter === 'any') return {};
  const gteKey = kind === 'movie' ? 'primary_release_date.gte' : 'first_air_date.gte';
  const lteKey = kind === 'movie' ? 'primary_release_date.lte' : 'first_air_date.lte';
  if (yearFilter === '<1990') return { [lteKey]: '1989-12-31' };
  if (yearFilter === '1990-1999') return { [gteKey]: '1990-01-01', [lteKey]: '1999-12-31' };
  if (yearFilter === '2000-2009') return { [gteKey]: '2000-01-01', [lteKey]: '2009-12-31' };
  if (yearFilter === '2010-2019') return { [gteKey]: '2010-01-01', [lteKey]: '2019-12-31' };
  if (yearFilter === '2020-2026') return { [gteKey]: '2020-01-01', [lteKey]: '2026-12-31' };
  if (/^\d{4}$/.test(yearFilter)) {
    return { [gteKey]: `${yearFilter}-01-01`, [lteKey]: `${yearFilter}-12-31` };
  }
  return {};
}

function getTmdbThemeGenreId(kind: 'movie' | 'tv', theme: AdultThemeFilter): string {
  if (theme === 'drama') return '18';
  if (theme === 'comedy') return '35';
  if (theme === 'romance') return kind === 'movie' ? '10749' : '18';
  if (theme === 'thriller') return kind === 'movie' ? '53' : '80,9648';
  return '';
}

function getTmdbSortParam(kind: 'movie' | 'tv', sort: AdultSortOption): string {
  if (sort === 'rating') return 'vote_average.desc';
  if (sort === 'newest') {
    return kind === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc';
  }
  return 'popularity.desc';
}

function normalizeTitleKey(raw: string): string {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/9\s*(?:½|1\/2)/g, '9half')
    .replace(/\bnine\s*(?:½|1\/2|and\s+a\s+half)\b/g, '9half')
    .replace(/\bcolour\b/g, 'color')
    .replace(/\bvol\.?\s*ii\b/g, 'vol2')
    .replace(/\bvol\.?\s*i\b/g, 'vol1')
    .replace(/\bpart\s*ii\b/g, 'part2')
    .replace(/\bpart\s*i\b/g, 'part1')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function getNormalizedTitleVariants(it: CinemetaItem): string[] {
  const out = new Set<string>();
  const addRaw = (raw?: string) => {
    if (!raw) return;
    const full = normalizeTitleKey(raw);
    if (full.length >= 1) out.add(full);
    const noParens = normalizeTitleKey(raw.replace(/\([^)]*\)/g, ' '));
    if (noParens.length >= 1) out.add(noParens);
    const parenMatch = raw.match(/\(([^)]+)\)/);
    if (parenMatch?.[1]) {
      const inner = normalizeTitleKey(parenMatch[1]);
      if (inner.length >= 4) out.add(inner);
    }
  };
  addRaw(it.name);
  addRaw(it.nameOriginal);
  return Array.from(out);
}

function mapFlagshipToCinemeta(f: FlagshipAdultItem): CinemetaItem {
  return {
    id: f.id,
    imdbId: f.id,
    name: f.name,
    nameOriginal: f.name,
    type: f.type,
    releaseInfo: String(f.year),
    year: String(f.year),
    country: f.countries.join(', '),
    imdbRating: f.imdbRating,
    genres: f.genres,
    poster: `https://images.metahub.space/poster/medium/${f.id}/img`,
    background: `https://images.metahub.space/background/medium/${f.id}/img`,
    isAdult18: true,
  };
}

async function resolveTmdbExternalImdbId(
  type: 'movie' | 'series',
  tmdbNumId: string
): Promise<string> {
  const kind = type === 'series' ? 'tv' : 'movie';
  const cacheKey = `${kind}:${tmdbNumId}`;
  const cached = tmdbExternalImdbCache.get(cacheKey);
  if (cached !== undefined) return cached;
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/${kind}/${encodeURIComponent(tmdbNumId)}/external_ids?api_key=${TMDB_DISCOVER_KEY}`
    );
    if (!res.ok) return '';
    const data = (await res.json()) as { imdb_id?: string };
    const imdb =
      typeof data?.imdb_id === 'string' && data.imdb_id.startsWith('tt')
        ? data.imdb_id
        : '';
    tmdbExternalImdbCache.set(cacheKey, imdb);
    return imdb;
  } catch {
    return '';
  }
}

export interface SmartTvAdult18SectionProps {
  tr: (ro: string, en: string, ru: string) => string;
  uiLang: 'ro' | 'en' | 'ru';
  savedVodItems: CinemetaItem[];
  watchProgressMap: Record<string, VodWatchProgressEntry>;
  adult18HistoryList: VodWatchProgressEntry[];
  seriesEpStatsMap: Record<string, SeriesEpisodeStats>;
  renderPosterProgressOverlay: (
    entry?: VodWatchProgressEntry,
    isLiveCard?: boolean
  ) => React.ReactNode;
  onFocusVodItem: (item: CinemetaItem) => void;
  onOpenVodItem: (
    item: CinemetaItem,
    autoPlay?: boolean,
    explicitSeason?: number,
    explicitEpisode?: number
  ) => void;
  onCardPlayKey: (
    e: React.KeyboardEvent,
    item: CinemetaItem,
    explicitSeason?: number,
    explicitEpisode?: number
  ) => void;
  onToggleWatched: (
    item: CinemetaItem,
    season?: number,
    episode?: number,
    options?: { wholeSeries?: boolean }
  ) => void;
  onRemoveHistoryItem: (vodId: string) => void;
  onClearAdult18History: () => void;
}

export const SmartTvAdult18Section: React.FC<SmartTvAdult18SectionProps> = React.memo(
  ({
    tr,
    uiLang,
    savedVodItems,
    watchProgressMap,
    adult18HistoryList,
    seriesEpStatsMap,
    renderPosterProgressOverlay,
    onFocusVodItem,
    onOpenVodItem,
    onCardPlayKey,
    onToggleWatched,
    onRemoveHistoryItem,
    onClearAdult18History,
  }) => {
    const [mediaType, setMediaType] = useState<AdultMediaFilter>('all');
    const [yearFilter, setYearFilter] = useState<string>('any');
    const [countryFilter, setCountryFilter] = useState<string>('ALL');
    const [themeFilter, setThemeFilter] = useState<AdultThemeFilter>('all');
    const [sortBy, setSortBy] = useState<AdultSortOption>('erotic_desc');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [debouncedSearch, setDebouncedSearch] = useState<string>('');
    const [isKeyboardOpen, setIsKeyboardOpen] = useState<boolean>(false);

    useEffect(() => {
      const t = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 320);
      return () => window.clearTimeout(t);
    }, [searchQuery]);

    const [items, setItems] = useState<CinemetaItem[]>([]);
    const [page, setPage] = useState<number>(1);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
    const [hasMore, setHasMore] = useState<boolean>(true);
    const [openingId, setOpeningId] = useState<string | null>(null);

    const [openDropdown, setOpenDropdown] = useState<DropdownKind | null>(null);
    const bannerRef = useRef<HTMLDivElement | null>(null);
    const yearBtnRef = useRef<HTMLButtonElement | null>(null);
    const countryBtnRef = useRef<HTMLButtonElement | null>(null);
    const themeBtnRef = useRef<HTMLButtonElement | null>(null);
    const sortBtnRef = useRef<HTMLButtonElement | null>(null);

    const hasActiveFilters =
      mediaType !== 'all' ||
      yearFilter !== 'any' ||
      countryFilter !== 'ALL' ||
      themeFilter !== 'all' ||
      sortBy !== 'erotic_desc' ||
      searchQuery.trim().length > 0;

    const mediaOptions = useMemo(
      () => [
        { id: 'all' as const, label: tr('Toate', 'All', 'Все') },
        { id: 'movie' as const, label: tr('Filme', 'Movies', 'Фильмы') },
        { id: 'series' as const, label: tr('Seriale', 'Series', 'Сериалы') },
      ],
      [tr]
    );

    const yearOptions = useMemo(
      () => [
        { id: 'any', label: tr('Toți anii', 'All Years', 'Все годы') },
        { id: '2026', label: '2026' },
        { id: '2025', label: '2025' },
        { id: '2024', label: '2024' },
        { id: '2020-2026', label: '2020–2026' },
        { id: '2010-2019', label: '2010–2019' },
        { id: '2000-2009', label: '2000–2009' },
        { id: '1990-1999', label: '1990–1999' },
        { id: '<1990', label: '< 1990' },
      ],
      [tr]
    );

    const countryOptions = useMemo(
      () => [
        { id: 'ALL', label: tr('Toate țările', 'All Countries', 'Все страны') },
        { id: 'US', label: tr('SUA', 'USA', 'США') },
        { id: 'FR', label: tr('Franța', 'France', 'Франция') },
        { id: 'IT', label: tr('Italia', 'Italy', 'Италия') },
        { id: 'ES', label: tr('Spania', 'Spain', 'Испания') },
        { id: 'GB', label: tr('Marea Britanie', 'UK', 'Великобритания') },
        { id: 'KR', label: tr('Coreea de Sud', 'South Korea', 'Южная Корея') },
        { id: 'PL', label: tr('Polonia', 'Poland', 'Польша') },
        { id: 'DE', label: tr('Germania', 'Germany', 'Германия') },
        { id: 'JP', label: tr('Japonia', 'Japan', 'Япония') },
      ],
      [tr]
    );

    const themeOptions = useMemo(
      () => [
        { id: 'all' as const, label: tr('Toate genurile', 'All Themes', 'Все жанры') },
        { id: 'erotic' as const, label: tr('Erotic / Senzual', 'Erotic / Sensual', 'Эротика') },
        { id: 'thriller' as const, label: tr('Thriller Erotic', 'Erotic Thriller', 'Эротический триллер') },
        { id: 'drama' as const, label: tr('Dramă 18+', '18+ Drama', 'Драма 18+') },
        { id: 'romance' as const, label: tr('Romantic 18+', '18+ Romance', 'Мелодрама 18+') },
        { id: 'comedy' as const, label: tr('Comedie 18+', '18+ Comedy', 'Комедия 18+') },
      ],
      [tr]
    );

    const sortOptions = useMemo(
      () => [
        { id: 'erotic_desc' as const, label: tr('Intens → Soft (%)', 'Intense → Soft (%)', 'Жарче → Мягче (%)') },
        { id: 'erotic_asc' as const, label: tr('Soft → Intens (%)', 'Soft → Intense (%)', 'Мягче → Жарче (%)') },
        { id: 'popular' as const, label: tr('Populare', 'Popular', 'Популярные') },
        { id: 'rating' as const, label: tr('Rating IMDb', 'Top Rated', 'Рейтинг IMDb') },
        { id: 'newest' as const, label: tr('Cele mai noi', 'Newest', 'Новинки') },
      ],
      [tr]
    );

    const getBtnRefByKind = (kind: DropdownKind) => {
      if (kind === 'year') return yearBtnRef.current;
      if (kind === 'country') return countryBtnRef.current;
      if (kind === 'theme') return themeBtnRef.current;
      return sortBtnRef.current;
    };

    useEffect(() => {
      if (openDropdown === null) return;
      const closeAndRestoreFocus = () => {
        const prev = openDropdown;
        setOpenDropdown(null);
        window.requestAnimationFrame(() => {
          focusElSafely(getBtnRefByKind(prev));
        });
      };
      const handlePointerDown = (e: PointerEvent) => {
        if (!bannerRef.current?.contains(e.target as Node)) {
          setOpenDropdown(null);
        }
      };
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          closeAndRestoreFocus();
        }
      };
      document.addEventListener('pointerdown', handlePointerDown);
      document.addEventListener('keydown', handleKeyDown, true);
      window.addEventListener('aether:imdb-close-dropdown', closeAndRestoreFocus);
      return () => {
        document.removeEventListener('pointerdown', handlePointerDown);
        document.removeEventListener('keydown', handleKeyDown, true);
        window.removeEventListener('aether:imdb-close-dropdown', closeAndRestoreFocus);
      };
    }, [openDropdown]);

    const toggleDropdown = (kind: DropdownKind) => {
      const next = openDropdown === kind ? null : kind;
      setOpenDropdown(next);
      if (next !== null) {
        window.requestAnimationFrame(() => {
          const popover = bannerRef.current?.querySelector<HTMLElement>(
            '[data-imdb-dropdown-popover="true"]'
          );
          focusElSafely(
            popover?.querySelector<HTMLElement>('[data-imdb-dropdown-option="active"]') ||
              popover?.querySelector<HTMLElement>('[data-imdb-dropdown-option]')
          );
        });
      }
    };

    const fetchSeqRef = useRef<number>(0);
    const openingIdRef = useRef<string | null>(null);
    const fetchSortKey: AdultSortOption =
      sortBy === 'erotic_asc' ? 'erotic_desc' : sortBy;

    useEffect(() => {
      const onCloseTvKeyboard = () => setIsKeyboardOpen(false);
      window.addEventListener('aether:close-tv-keyboard', onCloseTvKeyboard);
      return () =>
        window.removeEventListener('aether:close-tv-keyboard', onCloseTvKeyboard);
    }, []);

    const fetchPage = useCallback(
      async (targetPage: number, append: boolean) => {
        const mySeq = ++fetchSeqRef.current;
        const cleanQuery = debouncedSearch.trim();
        const isSearching = cleanQuery.length > 0;
        const cacheSortKey =
          fetchSortKey === 'erotic_desc' ? 'erotic' : fetchSortKey;
        const cacheKey = `${mediaType}|${yearFilter}|${countryFilter}|${themeFilter}|${cacheSortKey}|${uiLang}|q:${cleanQuery.toLowerCase()}|p${targetPage}`;
        const cached = adultCatalogMemCache.get(cacheKey);
        if (cached && Date.now() - cached.ts < 5 * 60 * 1000) {
          setItems((prev) => (append ? mergeDedupe(prev, cached.items) : cached.items));
          setHasMore(cached.hasMore);
          setIsLoading(false);
          setIsLoadingMore(false);
          return;
        }

        if (append) {
          setIsLoadingMore(true);
        } else {
          setIsLoading(true);
        }

        try {
          const tmdbLang =
            uiLang === 'ru' ? 'ru-RU' : uiLang === 'ro' ? 'en-US' : 'en-US';
          const minVotes =
            countryFilter !== 'ALL' || yearFilter === '2026' || yearFilter === '2025'
              ? '10'
              : fetchSortKey === 'rating'
                ? '60'
                : '25';

          const buildDiscoverUrl = (kind: 'movie' | 'tv', explicitOnly = false) => {
            const qs = new URLSearchParams({
              api_key: TMDB_DISCOVER_KEY,
              language: tmdbLang,
              include_adult: 'true',
              sort_by: getTmdbSortParam(kind, fetchSortKey),
              'vote_count.gte': explicitOnly ? '15' : minVotes,
              without_genres:
                kind === 'movie'
                  ? TMDB_EXCLUDED_MOVIE_GENRES
                  : TMDB_EXCLUDED_TV_GENRES,
              with_keywords: explicitOnly
                ? TMDB_EXPLICIT_KEYWORDS
                : kind === 'movie'
                  ? TMDB_EROTIC_MOVIE_KEYWORDS
                  : TMDB_EROTIC_TV_KEYWORDS,
              page: String(targetPage),
            });
            if (countryFilter !== 'ALL') {
              qs.set('with_origin_country', countryFilter);
            }
            const gId = getTmdbThemeGenreId(kind, themeFilter);
            if (gId) {
              qs.set('with_genres', gId);
            }
            const dateParams = getTmdbDateRangeParams(kind, yearFilter);
            Object.entries(dateParams).forEach(([k, v]) => qs.set(k, v));
            return `https://api.themoviedb.org/3/discover/${kind}?${qs.toString()}`;
          };

          const fetchJson = async (url: string) => {
            try {
              const res = await fetch(url);
              if (!res.ok) return { results: [], total_pages: 1 };
              return (await res.json()) as {
                results?: Array<Record<string, unknown>>;
                total_pages?: number;
              };
            } catch {
              return { results: [], total_pages: 1 };
            }
          };

          const buildSearchUrl = (kind: 'movie' | 'tv') => {
            const qs = new URLSearchParams({
              api_key: TMDB_DISCOVER_KEY,
              language: tmdbLang,
              include_adult: 'true',
              query: cleanQuery,
              page: String(targetPage),
            });
            return `https://api.themoviedb.org/3/search/${kind}?${qs.toString()}`;
          };

          const [explicitMovieData, movieData, tvData] = isSearching
            ? await Promise.all([
                Promise.resolve({ results: [], total_pages: 0 }),
                mediaType === 'series'
                  ? Promise.resolve({ results: [], total_pages: 0 })
                  : fetchJson(buildSearchUrl('movie')),
                mediaType === 'movie'
                  ? Promise.resolve({ results: [], total_pages: 0 })
                  : fetchJson(buildSearchUrl('tv')),
              ])
            : await Promise.all([
                mediaType === 'series'
                  ? Promise.resolve({ results: [], total_pages: 0 })
                  : fetchJson(buildDiscoverUrl('movie', true)),
                mediaType === 'series'
                  ? Promise.resolve({ results: [], total_pages: 0 })
                  : fetchJson(buildDiscoverUrl('movie', false)),
                mediaType === 'movie'
                  ? Promise.resolve({ results: [], total_pages: 0 })
                  : fetchJson(buildDiscoverUrl('tv', false)),
              ]);

          const mapTmdbRow = (
            row: Record<string, unknown>,
            kind: 'movie' | 'tv',
            isExplicitTier: boolean
          ): CinemetaItem | null => {
            const numId = Number(row.id);
            const posterPath = String(row.poster_path || '').trim();
            const rawTitle = String(
              kind === 'movie'
                ? row.title || row.original_title || ''
                : row.name || row.original_name || ''
            ).trim();
            if (!numId || !rawTitle || !posterPath) return null;
            const genreIds = Array.isArray(row.genre_ids)
              ? (row.genre_ids as number[])
              : [];
            if (genreIds.some((gid) => TMDB_EXCLUDED_GENRE_SET.has(gid))) {
              return null;
            }
            const rawDate = String(
              kind === 'movie' ? row.release_date || '' : row.first_air_date || ''
            );
            const yr = rawDate.slice(0, 4);
            if (
              isSearching &&
              yearFilter !== 'any' &&
              !matchesYearFilter(Number(yr) || 0, yearFilter)
            ) {
              return null;
            }
            if (isSearching && themeFilter !== 'all') {
              const reqGenreId = Number(getTmdbThemeGenreId(kind, themeFilter) || 0);
              if (reqGenreId > 0 && genreIds.length > 0 && !genreIds.includes(reqGenreId)) {
                return null;
              }
            }
            const ratingNum = Number(row.vote_average || 0);
            const mappedGenres = genreIds
              .map((gid) => TMDB_GENRE_ID_TO_NAME[gid])
              .filter(Boolean);
            const origTitle = String(
              kind === 'movie'
                ? row.original_title || rawTitle
                : row.original_name || rawTitle
            ).trim();
            const backdropPath = String(row.backdrop_path || '').trim();
            const itemId = `tmdb_${kind}_${numId}`;
            const estPct = estimateTmdbEroticPct(row, kind, isExplicitTier || row.adult === true);
            const prevPct = eroticPctByItemId.get(itemId) || 0;
            eroticPctByItemId.set(itemId, Math.max(prevPct, estPct));
            return {
              id: itemId,
              name: rawTitle,
              nameOriginal: origTitle,
              type: kind === 'tv' ? 'series' : 'movie',
              releaseInfo: yr || undefined,
              year: yr || undefined,
              imdbRating: ratingNum > 0 ? ratingNum.toFixed(1) : undefined,
              description: String(row.overview || '').trim() || undefined,
              genres: mappedGenres.length > 0 ? mappedGenres.slice(0, 3) : ['Erotic', 'Drama'],
              poster: `https://image.tmdb.org/t/p/w500${posterPath}`,
              background: backdropPath
                ? `https://image.tmdb.org/t/p/w1280${backdropPath}`
                : `https://image.tmdb.org/t/p/w780${posterPath}`,
              isAdult18: true,
            };
          };

          const liveExplicitMovies = (explicitMovieData.results || [])
            .map((r) => mapTmdbRow(r, 'movie', true))
            .filter((x): x is CinemetaItem => Boolean(x));
          const liveMovies = mergeDedupe(
            liveExplicitMovies,
            (movieData.results || [])
              .map((r) => mapTmdbRow(r, 'movie', false))
              .filter((x): x is CinemetaItem => Boolean(x))
          );
          const liveSeries = (tvData.results || [])
            .map((r) => mapTmdbRow(r, 'tv', false))
            .filter((x): x is CinemetaItem => Boolean(x));

          // Interleave movies & series cleanly on 'all' so both show immediately on page 1
          const liveCombined: CinemetaItem[] = [];
          const maxLive = Math.max(liveMovies.length, liveSeries.length);
          for (let i = 0; i < maxLive; i++) {
            if (liveMovies[i]) liveCombined.push(liveMovies[i]);
            if (liveSeries[i]) liveCombined.push(liveSeries[i]);
          }

          let pageItems: CinemetaItem[] = [];
          if (targetPage === 1) {
            const qLower = cleanQuery.toLowerCase();
            const qNorm = normalizeTitleKey(cleanQuery);
            const matchingFlagships = FLAGSHIP_ADULT_18_ITEMS.filter((f) => {
              if (mediaType !== 'all' && f.type !== mediaType) return false;
              if (!matchesYearFilter(f.year, yearFilter)) return false;
              if (countryFilter !== 'ALL' && !f.countries.includes(countryFilter)) {
                return false;
              }
              if (themeFilter !== 'all' && !f.themes.includes(themeFilter)) {
                return false;
              }
              if (qLower) {
                const hay = `${f.name} ${f.year} ${f.genres.join(' ')} ${f.countries.join(' ')}`.toLowerCase();
                if (!hay.includes(qLower) && !(qNorm && normalizeTitleKey(f.name).includes(qNorm))) {
                  return false;
                }
              }
              return true;
            }).map(mapFlagshipToCinemeta);

            pageItems = mergeDedupe(matchingFlagships, liveCombined);
          } else {
            pageItems = liveCombined;
          }

          const maxTotalPages = Math.max(
            Number(explicitMovieData.total_pages) || 0,
            Number(movieData.total_pages) || 0,
            Number(tvData.total_pages) || 0
          );
          const nextHasMore = targetPage < Math.min(maxTotalPages, 12);

          adultCatalogMemCache.set(cacheKey, {
            items: pageItems,
            hasMore: nextHasMore,
            ts: Date.now(),
          });

          if (mySeq !== fetchSeqRef.current) return;
          setItems((prev) => (append ? mergeDedupe(prev, pageItems) : pageItems));
          setHasMore(nextHasMore);
        } finally {
          if (mySeq === fetchSeqRef.current) {
            setIsLoading(false);
            setIsLoadingMore(false);
          }
        }
      },
      [mediaType, yearFilter, countryFilter, themeFilter, fetchSortKey, uiLang, debouncedSearch]
    );

    const displayedItems = useMemo(() => {
      const list = [...items];
      if (sortBy === 'erotic_desc') {
        list.sort((a, b) => {
          const diff = getItemEroticPct(b) - getItemEroticPct(a);
          if (diff !== 0) return diff;
          return (
            (parseFloat(String(b.imdbRating || '0')) || 0) -
            (parseFloat(String(a.imdbRating || '0')) || 0)
          );
        });
      } else if (sortBy === 'erotic_asc') {
        list.sort((a, b) => {
          const diff = getItemEroticPct(a) - getItemEroticPct(b);
          if (diff !== 0) return diff;
          return (
            (parseFloat(String(b.imdbRating || '0')) || 0) -
            (parseFloat(String(a.imdbRating || '0')) || 0)
          );
        });
      } else if (sortBy === 'rating') {
        list.sort(
          (a, b) =>
            (parseFloat(String(b.imdbRating || '0')) || 0) -
            (parseFloat(String(a.imdbRating || '0')) || 0)
        );
      } else if (sortBy === 'newest') {
        list.sort(
          (a, b) =>
            (parseInt(String(b.year || b.releaseInfo || '0'), 10) || 0) -
            (parseInt(String(a.year || a.releaseInfo || '0'), 10) || 0)
        );
      }
      return list;
    }, [items, sortBy]);

    useEffect(() => {
      setPage(1);
      void fetchPage(1, false);
    }, [fetchPage]);

    const handleActivateCard = useCallback(
      async (
        item: CinemetaItem,
        autoPlay = false,
        explicitSeason?: number,
        explicitEpisode?: number
      ) => {
        const taggedItem: CinemetaItem = item.isAdult18
          ? item
          : { ...item, isAdult18: true };
        if (
          taggedItem.id.startsWith('tt') ||
          (taggedItem.imdbId && taggedItem.imdbId.startsWith('tt'))
        ) {
          onOpenVodItem(taggedItem, autoPlay, explicitSeason, explicitEpisode);
          return;
        }
        const m = taggedItem.id.match(/^tmdb_(movie|tv)_(\d+)$/);
        if (!m) {
          onOpenVodItem(taggedItem, autoPlay, explicitSeason, explicitEpisode);
          return;
        }
        if (openingIdRef.current) return;
        openingIdRef.current = taggedItem.id;
        setOpeningId(taggedItem.id);
        try {
          const imdb = await resolveTmdbExternalImdbId(taggedItem.type, m[2]);
          if (imdb) {
            onOpenVodItem(
              { ...taggedItem, id: imdb, imdbId: imdb, isAdult18: true },
              autoPlay,
              explicitSeason,
              explicitEpisode
            );
          } else {
            onOpenVodItem(taggedItem, autoPlay, explicitSeason, explicitEpisode);
          }
        } finally {
          openingIdRef.current = null;
          setOpeningId(null);
        }
      },
      [onOpenVodItem]
    );

    const droplists = [
      {
        kind: 'year' as const,
        btnRef: yearBtnRef,
        activeVal: yearFilter,
        defaultVal: 'any',
        options: yearOptions,
        mobileIdleLabel: tr('An', 'Year', 'Год'),
        desktopPrefix: tr('An:', 'Year:', 'Год:'),
        widthClass: 'w-44 sm:w-48',
        activeBtnClass: 'bg-white text-[#141414] shadow-md font-black border border-white',
        activeOptClass: 'bg-rose-500 text-white font-black',
        onSelect: (val: string) => setYearFilter(val),
      },
      {
        kind: 'country' as const,
        btnRef: countryBtnRef,
        activeVal: countryFilter,
        defaultVal: 'ALL',
        options: countryOptions,
        mobileIdleLabel: tr('Țară', 'Country', 'Страна'),
        desktopPrefix: tr('Țară:', 'Country:', 'Страна:'),
        widthClass: 'w-48 sm:w-52',
        activeBtnClass: 'bg-white text-[#141414] shadow-md font-black border border-white',
        activeOptClass: 'bg-rose-500 text-white font-black',
        onSelect: (val: string) => setCountryFilter(val),
      },
      {
        kind: 'theme' as const,
        btnRef: themeBtnRef,
        activeVal: themeFilter,
        defaultVal: 'all',
        options: themeOptions,
        mobileIdleLabel: tr('Gen', 'Theme', 'Жанр'),
        desktopPrefix: tr('Gen:', 'Theme:', 'Жанр:'),
        widthClass: 'w-52 sm:w-56',
        activeBtnClass:
          'bg-rose-600 text-white shadow-md font-black border border-rose-400/60 focus:bg-white focus:text-[#141414]',
        activeOptClass: 'bg-rose-600 text-white font-black',
        onSelect: (val: string) => setThemeFilter(val as AdultThemeFilter),
      },
      {
        kind: 'sort' as const,
        btnRef: sortBtnRef,
        activeVal: sortBy,
        defaultVal: 'erotic_desc',
        options: sortOptions,
        mobileIdleLabel: tr('Intens %', 'Intense %', 'Жар %'),
        desktopPrefix: '',
        widthClass: 'w-48 sm:w-52',
        activeBtnClass: 'bg-white text-[#141414] shadow-md font-black border border-white',
        activeOptClass: 'bg-rose-500 text-white font-black',
        onSelect: (val: string) => setSortBy(val as AdultSortOption),
      },
    ];

    return (
      <div className="space-y-4 sm:space-y-5 pb-16">
        {/* Compact Single-Row Smart Filter Banner (zero wasted vertical space, identical to Top IMDb) */}
        <div
          ref={bannerRef}
          data-adult18-smart-banner="true"
          className="relative z-30 px-2.5 py-2 sm:px-4 sm:py-2.5 rounded-2xl tahoe-glass border border-white/15 flex items-center justify-between gap-1.5 sm:gap-3 flex-wrap lg:flex-nowrap"
        >
          {/* Left: Compact 18+ Badge + Single-Line Title */}
          <div className="flex items-center gap-2 min-w-0 shrink-0">
            <span className="inline-flex px-2 py-0.5 rounded-md bg-rose-600 text-white font-black text-[11px] sm:text-xs tracking-wider shadow shrink-0">
              18+
            </span>
            <h2 className="hidden md:block text-sm lg:text-base font-bold text-white tracking-tight truncate">
              {tr('Cinema 18+', '18+ Cinema', 'Кино 18+')}
            </h2>
          </div>

          {/* Right: Format Segmented Control + Compact Year / Country / Theme / Sort Droplists */}
          <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap lg:flex-nowrap justify-end min-w-0">
            <div className="inline-flex items-center p-0.5 rounded-full bg-white/[0.07] border border-white/15 shrink-0">
              {mediaOptions.map((mTab) => {
                const isActive = mediaType === mTab.id;
                return (
                  <button
                    key={`a18_m_${mTab.id}`}
                    type="button"
                    tabIndex={0}
                    data-top-pill="true"
                    onClick={() => {
                      setOpenDropdown(null);
                      setMediaType(mTab.id);
                    }}
                    className={`h-7 sm:h-8 px-2 sm:px-3 rounded-full text-[11px] sm:text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap focus:outline-none focus:ring-2 sm:focus:ring-4 focus:ring-white ${
                      isActive
                        ? 'bg-rose-600 text-white shadow font-black'
                        : 'text-zinc-200 hover:text-white hover:bg-white/10 focus:bg-white focus:text-[#141414]'
                    }`}
                  >
                    {mTab.label}
                  </button>
                );
              })}
            </div>

            {droplists.map((dl) => {
              const isOpen = openDropdown === dl.kind;
              const isFiltered = dl.activeVal !== dl.defaultVal;
              const activeObj =
                dl.options.find((o) => o.id === dl.activeVal) || dl.options[0];
              return (
                <div key={dl.kind} className="relative shrink-0">
                  <button
                    ref={dl.btnRef}
                    type="button"
                    tabIndex={0}
                    data-top-pill="true"
                    aria-expanded={isOpen}
                    onClick={() => toggleDropdown(dl.kind)}
                    className={`h-8 sm:h-9 px-2 sm:px-3 rounded-full text-[11px] sm:text-xs font-bold inline-flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap focus:outline-none focus:ring-2 sm:focus:ring-4 focus:ring-white ${
                      isFiltered
                        ? dl.activeBtnClass
                        : 'bg-white/[0.08] hover:bg-white/15 text-zinc-200 border border-white/15 focus:bg-white focus:text-[#141414]'
                    }`}
                  >
                    <span className="sm:hidden max-w-[54px] truncate">
                      {isFiltered ? activeObj.label : dl.mobileIdleLabel}
                    </span>
                    <span className="hidden sm:inline-flex items-center gap-1">
                      {dl.desktopPrefix && (
                        <span className="hidden xl:inline opacity-75 font-semibold">
                          {dl.desktopPrefix}
                        </span>
                      )}
                      <span className="max-w-[104px] truncate">{activeObj.label}</span>
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <div
                      data-imdb-dropdown-popover="true"
                      className={`absolute right-0 mt-2 ${dl.widthClass} max-h-[65vh] overflow-y-auto p-1.5 rounded-2xl bg-[#121621] border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.85)] z-50 space-y-0.5`}
                    >
                      {dl.options.map((opt) => {
                        const isSelected = dl.activeVal === opt.id;
                        return (
                          <button
                            key={`a18_${dl.kind}_${opt.id}`}
                            type="button"
                            data-imdb-dropdown-option={isSelected ? 'active' : 'item'}
                            onClick={() => {
                              dl.onSelect(opt.id);
                              setOpenDropdown(null);
                              window.requestAnimationFrame(() =>
                                focusElSafely(dl.btnRef.current)
                              );
                            }}
                            className={`w-full h-9 px-3 rounded-xl text-xs font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer focus:outline-none focus:bg-white focus:text-[#141414] ${
                              isSelected
                                ? dl.activeOptClass
                                : 'text-zinc-200 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            <span className="truncate">{opt.label}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {(sortBy === 'erotic_desc' || sortBy === 'erotic_asc') && (
              <button
                type="button"
                tabIndex={0}
                data-top-pill="true"
                title={
                  sortBy === 'erotic_desc'
                    ? tr(
                        'Inversează ordinea: Soft → Intens (%)',
                        'Reverse order: Soft → Intense (%)',
                        'Поменять: Мягче → Жарче (%)'
                      )
                    : tr(
                        'Inversează ordinea: Intens → Soft (%)',
                        'Reverse order: Intense → Soft (%)',
                        'Поменять: Жарче → Мягче (%)'
                      )
                }
                aria-label={tr('Inversează sensul sortării', 'Toggle sort direction', 'Сменить порядок')}
                onClick={() => {
                  setOpenDropdown(null);
                  setSortBy((prev) =>
                    prev === 'erotic_desc' ? 'erotic_asc' : 'erotic_desc'
                  );
                }}
                className="h-8 sm:h-9 px-2.5 rounded-full bg-rose-600/20 hover:bg-rose-600/35 text-rose-200 border border-rose-400/40 inline-flex items-center gap-1 text-[11px] sm:text-xs font-extrabold shrink-0 cursor-pointer transition-all focus:outline-none focus:ring-2 sm:focus:ring-4 focus:ring-white focus:bg-white focus:text-[#141414]"
              >
                {sortBy === 'erotic_desc' ? (
                  <ArrowDownWideNarrow className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <ArrowUpNarrowWide className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="hidden lg:inline">
                  {sortBy === 'erotic_desc' ? '99→35%' : '35→99%'}
                </span>
              </button>
            )}

            {hasActiveFilters && (
              <button
                type="button"
                tabIndex={0}
                data-top-pill="true"
                title={tr('Resetează filtrele', 'Reset filters', 'Сбросить фильтры')}
                aria-label={tr('Resetează filtrele', 'Reset filters', 'Сбросить фильтры')}
                onClick={() => {
                  setOpenDropdown(null);
                  setMediaType('all');
                  setYearFilter('any');
                  setCountryFilter('ALL');
                  setThemeFilter('all');
                  setSortBy('erotic_desc');
                  setSearchQuery('');
                  setDebouncedSearch('');
                  setIsKeyboardOpen(false);
                }}
                className="h-8 w-8 sm:h-9 sm:w-auto sm:px-2.5 rounded-full bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-400/30 inline-flex items-center justify-center gap-1 text-xs font-bold shrink-0 cursor-pointer focus:outline-none focus:ring-2 sm:focus:ring-4 focus:ring-white focus:bg-white focus:text-[#141414]"
              >
                <X className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden xl:inline">{tr('Reset', 'Reset', 'Сброс')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Compact Search Bar + On-Screen TV Remote Keyboard for Cinema 18+ */}
        <div className="rounded-2xl tahoe-glass border border-white/10 px-2.5 py-2 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex-1 min-w-[180px] h-9 px-3 rounded-full bg-black/40 border border-white/15 focus-within:border-rose-400 flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.stopPropagation();
                    setSearchQuery('');
                    setDebouncedSearch('');
                    (e.currentTarget as HTMLInputElement).blur();
                  }
                }}
                placeholder={tr(
                  'Caută în Cinema 18+ (titlu, Emmanuelle, Tinto Brass, Caligula, BDSM...)',
                  'Search Cinema 18+ (title, Emmanuelle, Tinto Brass, Caligula, BDSM...)',
                  'Поиск в Cinema 18+ (название, Эммануэль, Тинто Брасс, Калигула...)'
                )}
                className="flex-1 min-w-0 bg-transparent text-xs sm:text-sm font-bold text-white placeholder:text-zinc-500 placeholder:font-normal focus:outline-none select-text"
              />
              {searchQuery && (
                <button
                  type="button"
                  data-top-pill="true"
                  onClick={() => {
                    setSearchQuery('');
                    setDebouncedSearch('');
                  }}
                  className="px-2.5 py-0.5 rounded-full bg-zinc-800 hover:bg-zinc-700 focus:bg-white focus:text-[#141414] text-[11px] font-extrabold text-zinc-200 shrink-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-white"
                >
                  {tr('Șterge', 'Clear', 'Сброс')}
                </button>
              )}
            </div>

            <button
              type="button"
              data-top-pill="true"
              onClick={() => setIsKeyboardOpen((prev) => !prev)}
              className={`h-9 px-3.5 rounded-full text-xs font-extrabold inline-flex items-center gap-1.5 border transition-all focus:outline-none focus:ring-2 sm:focus:ring-4 focus:ring-white cursor-pointer shrink-0 ${
                isKeyboardOpen
                  ? 'bg-rose-600 text-white border-rose-300/60'
                  : 'bg-white/[0.06] hover:bg-white/[0.12] focus:bg-white focus:text-[#141414] text-zinc-100 border-white/15'
              }`}
            >
              <Search className="w-3.5 h-3.5 shrink-0" />
              <span>
                {isKeyboardOpen
                  ? tr('Ascunde Tastatura', 'Hide Keyboard', 'Скрыть клавиатуру')
                  : tr('Tastatură TV', 'TV Keyboard', 'Клавиатура ТВ')}
              </span>
            </button>
          </div>

          {isKeyboardOpen && (
            <div data-tv-keyboard-open="true" className="pt-2 border-t border-white/10 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-rose-300">
                  {tr(
                    'Tastează cu telecomanda TV în Cinema 18+:',
                    'Type with the TV remote in Cinema 18+:',
                    'Введите запрос с пульта ТВ в Cinema 18+:'
                  )}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    data-top-pill="true"
                    onClick={() => setSearchQuery((q) => q + ' ')}
                    className="h-8 px-3 rounded-lg bg-[#2a2a2a] hover:bg-[#343434] focus:bg-white focus:text-[#141414] focus:ring-2 focus:ring-white focus:outline-none text-white text-xs font-bold border border-white/10 cursor-pointer"
                  >
                    {tr('Spațiu', 'Space', 'Пробел')}
                  </button>
                  <button
                    type="button"
                    data-top-pill="true"
                    onClick={() => setSearchQuery((q) => q.slice(0, -1))}
                    className="h-8 px-3 rounded-lg bg-[#2a2a2a] hover:bg-[#343434] focus:bg-rose-600 focus:text-white focus:ring-2 focus:ring-white focus:outline-none text-rose-400 text-xs font-bold inline-flex items-center gap-1 border border-white/10 cursor-pointer"
                  >
                    <Delete className="w-3.5 h-3.5" />
                    <span>{tr('Șterge', 'Backspace', 'Стереть')}</span>
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-9 sm:grid-cols-12 gap-1">
                {ADULT18_KEYS_LATIN.map((ch) => (
                  <button
                    key={`a18_key_${ch}`}
                    type="button"
                    onClick={() => setSearchQuery((q) => q + ch)}
                    className="h-9 rounded-lg bg-[#141414] hover:bg-white hover:text-[#141414] focus:bg-white focus:text-[#141414] focus:ring-2 focus:ring-white focus:outline-none text-white font-extrabold text-xs sm:text-sm transition-colors border border-white/10 cursor-pointer"
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Isolated Cinema 18+ Watch History / Continue Watching Shelf (identical to Home, strictly confined to this page) */}
        {adult18HistoryList.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg sm:text-xl font-normal text-zinc-100 tracking-tight flex items-center gap-2">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400 shrink-0" />
                <span>
                  {tr(
                    `Continuă vizionarea 18+ (${adult18HistoryList.length})`,
                    `Continue Watching 18+ (${adult18HistoryList.length})`,
                    `История 18+ (${adult18HistoryList.length})`
                  )}
                </span>
              </h2>
              <button
                type="button"
                tabIndex={0}
                onClick={onClearAdult18History}
                className="h-8 px-3 rounded-full bg-white/[0.06] hover:bg-rose-600/80 focus:bg-white focus:text-[#141414] text-zinc-300 hover:text-white border border-white/10 text-[11px] font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 focus:outline-none focus:ring-2 focus:ring-white"
              >
                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {tr('Șterge istoric 18+', 'Clear 18+ history', 'Очистить 18+')}
                </span>
              </button>
            </div>
            <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 no-scrollbar">
              {adult18HistoryList.map((entry) => {
                const histItem = entry.item;
                const posterUrl = resolveSafeVodPosterUrl(histItem);
                const numScore = parseFloat(String(histItem.imdbRating || '')) || 0;
                const displayScore = numScore > 0 ? numScore.toFixed(1) : '';
                return (
                  <article
                    key={`adult18_hist_${histItem.id}`}
                    className="group/hist relative flex w-[145px] sm:w-[175px] md:w-[195px] shrink-0 flex-col gap-1.5"
                  >
                    <button
                      type="button"
                      tabIndex={0}
                      data-watched-poster-btn="true"
                      data-vod-card="true"
                      data-vod-id={histItem.id}
                      onFocus={(e) => {
                        onFocusVodItem(histItem);
                        const container = e.currentTarget.closest('.overflow-x-auto') as HTMLElement | null;
                        if (container) {
                          const cardRect = e.currentTarget.getBoundingClientRect();
                          const contRect = container.getBoundingClientRect();
                          const targetScroll =
                            container.scrollLeft +
                            (cardRect.left - contRect.left) -
                            (contRect.width / 2 - cardRect.width / 2);
                          container.scrollTo({
                            left: Math.max(0, targetScroll),
                            behavior: 'smooth',
                          });
                        }
                      }}
                      onMouseEnter={() => onFocusVodItem(histItem)}
                      onKeyDown={(e) =>
                        onCardPlayKey(e, histItem, entry.season, entry.episode)
                      }
                      onClick={() =>
                        void handleActivateCard(
                          histItem,
                          false,
                          entry.season,
                          entry.episode
                        )
                      }
                      className="group w-full block text-left focus:outline-none cursor-pointer"
                    >
                      <div className="aspect-[2/3] w-full rounded-2xl bg-[#242424] relative overflow-hidden shadow-lg group-focus:ring-4 group-focus:ring-white group-hover:ring-2 group-hover:ring-white/80 group-focus:scale-[1.03] transition-all duration-200">
                        <img
                          src={posterUrl}
                          alt={histItem.name}
                          loading="lazy"
                          onError={(e) => handleVodPosterImgError(e, histItem)}
                          className="w-full h-full object-cover"
                        />

                        {displayScore && (
                          <div className="absolute top-2.5 left-2.5 z-10 px-2 py-0.5 rounded-md bg-[#f5c518] text-black font-black text-[11px] shadow-lg flex items-center gap-1">
                            <Star className="w-3 h-3 fill-current text-black" />
                            <span>{displayScore}</span>
                          </div>
                        )}

                        <span
                          className={`absolute top-2.5 right-2.5 z-10 px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider shadow whitespace-nowrap ${
                            histItem.type === 'series'
                              ? 'bg-[#172554]/95 text-white border border-[#2563eb]/50'
                              : 'bg-black/75 text-zinc-100 border border-white/20'
                          }`}
                        >
                          {histItem.type === 'series'
                            ? `S${entry.season || 1}:E${entry.episode || 1}`
                            : tr('FILM', 'MOVIE', 'ФИЛЬМ')}
                        </span>

                        {renderPosterProgressOverlay(entry, false)}

                        <VodPosterWatchedControl
                          item={histItem}
                          entry={entry}
                          stats={seriesEpStatsMap[histItem.id]}
                          onToggleWatched={onToggleWatched}
                          tr={tr}
                          positionClass="top-9 left-2.5"
                        />
                      </div>

                      <div className="mt-2 px-0.5">
                        <h3 className="text-sm sm:text-[15px] font-semibold text-zinc-100 group-focus:text-white leading-snug line-clamp-1">
                          {histItem.name}
                        </h3>
                        <div className="text-xs text-zinc-400 mt-0.5 truncate">
                          {histItem.releaseInfo || histItem.year || ''}
                          {histItem.type === 'series'
                            ? ` • S${entry.season || 1}:E${entry.episode || 1}`
                            : ''}
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      title={tr('Șterge din istoric 18+', 'Remove from 18+ history', 'Убрать из истории 18+')}
                      aria-label={tr('Șterge din istoric 18+', 'Remove from 18+ history', 'Убрать из истории 18+')}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onRemoveHistoryItem(histItem.id);
                      }}
                      className="absolute top-9 right-2.5 z-20 p-1.5 rounded-full bg-black/70 hover:bg-rose-600 focus:bg-rose-600 focus:text-white focus:opacity-100 focus:ring-2 focus:ring-white focus:outline-none text-zinc-200 hover:text-white border border-white/25 opacity-0 group-hover/hist:opacity-100 group-focus-within/hist:opacity-100 max-md:opacity-85 transition-all cursor-pointer shadow-lg inline-flex items-center justify-center"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {/* Cinema Poster Cards Grid (Exact Same Styling as Top IMDb / Filme / Seriale) */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <FilmioStartupLoader compact />
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 sm:p-12 text-center rounded-[28px] tahoe-glass border border-white/15 space-y-3">
            <div className="text-lg font-bold text-white">
              {tr(
                'Niciun titlu 18+ găsit cu filtrele selectate.',
                'No 18+ titles found with current filters.',
                'Ничего не найдено по выбранным фильтрам.'
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setMediaType('all');
                setYearFilter('any');
                setCountryFilter('ALL');
                setThemeFilter('all');
                setSortBy('erotic_desc');
                setSearchQuery('');
                setDebouncedSearch('');
                setIsKeyboardOpen(false);
              }}
              className="h-10 px-6 rounded-full bg-white text-[#141414] font-extrabold text-xs inline-flex items-center justify-center cursor-pointer shadow mt-2 focus:outline-none focus:ring-4 focus:ring-rose-400"
            >
              {tr('Resetează filtrele', 'Reset filters', 'Сбросить фильтры')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4.5">
            {displayedItems.map((item) => {
              const posterUrl = resolveSafeVodPosterUrl(item);
              const numScore = parseFloat(String(item.imdbRating || '')) || 0;
              const displayScore = numScore > 0 ? numScore.toFixed(1) : '';
              const eroticPct = getItemEroticPct(item);
              const isFav = (savedVodItems || []).some((x) => x.id === item.id);
              const prog = findWatchProgressEntry(watchProgressMap, item);
              const hasProgress = Boolean(prog && prog.currentTime > 10);
              const isOpeningThis = openingId === item.id;

              return (
                <article
                  key={`adult18_card_${item.id}`}
                  className="group relative max-w-[220px] w-full"
                >
                  <button
                    type="button"
                    tabIndex={0}
                    data-vod-card="true"
                    data-vod-id={item.id}
                    onFocus={() => onFocusVodItem(item)}
                    onMouseEnter={() => onFocusVodItem(item)}
                    onClick={() => void handleActivateCard(item, false)}
                    onKeyDown={(e) => {
                      if (e.key === 'MediaPlay' || e.keyCode === 415) {
                        e.preventDefault();
                        void handleActivateCard(item, true);
                        return;
                      }
                      onCardPlayKey(e, item);
                    }}
                    className="block w-full text-left focus:outline-none cursor-pointer"
                  >
                    <div className="aspect-[2/3] w-full rounded-2xl bg-[#242424] relative overflow-hidden shadow-lg group-focus-within:ring-4 group-focus-within:ring-white group-hover:ring-2 group-hover:ring-white/80 group-focus-within:scale-[1.03] transition-all duration-200">
                      <img
                        src={posterUrl}
                        alt={item.name}
                        loading="lazy"
                        onError={(e) => handleVodPosterImgError(e, item)}
                        className="w-full h-full object-cover"
                      />

                      {isOpeningThis && (
                        <div className="absolute inset-0 bg-black/55 flex items-center justify-center z-20">
                          <Loader2 className="w-7 h-7 text-white animate-spin" />
                        </div>
                      )}

                      {/* Rating + Erotic Intensity % Badges (Top Left) */}
                      <div className="absolute top-2.5 left-2.5 flex items-center gap-1">
                        {displayScore && (
                          <div className="px-1.5 py-0.5 rounded-md bg-[#f5c518] text-black font-black text-[10px] sm:text-[11px] shadow-lg flex items-center gap-0.5">
                            <Star className="w-2.5 h-2.5 fill-current text-black" />
                            <span>{displayScore}</span>
                          </div>
                        )}
                        <div
                          title={tr(
                            `Intensitate scene erotice: ${eroticPct}%`,
                            `Erotic scene intensity: ${eroticPct}%`,
                            `Интенсивность эротики: ${eroticPct}%`
                          )}
                          className={`px-1.5 py-0.5 rounded-md font-black text-[10px] sm:text-[11px] shadow-lg flex items-center gap-0.5 tabular-nums ${getEroticBadgeStyle(
                            eroticPct
                          )}`}
                        >
                          <Flame className="w-2.5 h-2.5 shrink-0" />
                          <span>{eroticPct}%</span>
                        </div>
                      </div>

                      {/* Media Type Badge (Top Right) */}
                      <span
                        className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider shadow whitespace-nowrap ${
                          item.type === 'series'
                            ? 'bg-[#172554]/95 text-white border border-[#2563eb]/50'
                            : 'bg-black/75 text-zinc-100 border border-white/20'
                        }`}
                      >
                        {item.type === 'series'
                          ? tr('SERIAL', 'SERIES', 'СЕРИАЛ')
                          : tr('FILM', 'MOVIE', 'ФИЛЬМ')}
                      </span>

                      {hasProgress && prog && (
                        <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/60">
                          <div
                            className="h-full bg-blue-500 rounded-r"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.max(
                                  5,
                                  Math.round(
                                    (prog.currentTime / (prog.duration || 5400)) * 100
                                  )
                                )
                              )}%`,
                            }}
                          />
                        </div>
                      )}

                      {isFav && (
                        <span className="absolute bottom-2.5 right-2.5 px-1.5 py-0.5 rounded-md bg-black/80 text-amber-400 text-xs shadow">
                          ★
                        </span>
                      )}

                      <VodPosterWatchedControl
                        item={item}
                        entry={prog}
                        stats={seriesEpStatsMap[item.id]}
                        onToggleWatched={onToggleWatched}
                        tr={tr}
                      />
                    </div>

                    <div className="mt-2.5 px-0.5">
                      <h3 className="text-sm sm:text-[15px] font-bold text-zinc-100 group-focus-within:text-white leading-snug line-clamp-1">
                        {item.name}
                      </h3>
                      <div className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1.5 truncate">
                        <span>{item.releaseInfo || item.year || ''}</span>
                        {Array.isArray(item.genres) && item.genres[0] && (
                          <>
                            <span>•</span>
                            <span className="truncate">
                              {item.genres.slice(0, 2).join(', ')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                </article>
              );
            })}
          </div>
        )}

        {/* Pagination / Load More */}
        {hasMore && !isLoading && items.length > 0 && (
          <div className="flex justify-center pt-4">
            <button
              type="button"
              tabIndex={0}
              disabled={isLoadingMore}
              onClick={() => {
                const nextPage = page + 1;
                setPage(nextPage);
                void fetchPage(nextPage, true);
              }}
              className="h-11 px-8 rounded-full bg-white/10 hover:bg-white hover:text-[#141414] focus:bg-white focus:text-[#141414] text-white font-extrabold text-xs sm:text-sm border border-white/15 inline-flex items-center gap-2 transition-all cursor-pointer focus:outline-none focus:ring-4 focus:ring-white disabled:opacity-50"
            >
              {isLoadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>
                {isLoadingMore
                  ? tr('Se încarcă...', 'Loading...', 'Загрузка...')
                  : tr('Încarcă mai multe', 'Load more', 'Загрузить ещё')}
              </span>
            </button>
          </div>
        )}
      </div>
    );
  }
);

function mergeDedupe(base: CinemetaItem[], extra: CinemetaItem[]): CinemetaItem[] {
  const seenIds = new Set<string>();
  const seenYearsByTypeTitle = new Map<string, number[]>();
  const out: CinemetaItem[] = [];
  for (const it of [...base, ...extra]) {
    if (!it?.id) continue;
    const imdb =
      it.imdbId && it.imdbId.startsWith('tt')
        ? it.imdbId
        : it.id.startsWith('tt')
          ? it.id
          : '';
    const mappedTmdbId =
      (imdb && FLAGSHIP_IMDB_TO_TMDB_ID[imdb]) ||
      FLAGSHIP_IMDB_TO_TMDB_ID[it.id] ||
      '';
    if (
      seenIds.has(it.id) ||
      (imdb && seenIds.has(imdb)) ||
      (mappedTmdbId && seenIds.has(mappedTmdbId))
    ) {
      continue;
    }

    const yrNum = Number(String(it.year || it.releaseInfo || '').slice(0, 4)) || 0;
    const variants = getNormalizedTitleVariants(it);

    let isDup = false;
    for (const v of variants) {
      const mapKey = `${it.type}:${v}`;
      const existingYears = seenYearsByTypeTitle.get(mapKey);
      if (!existingYears) continue;
      if (
        (yrNum === 0 && v.length >= 4) ||
        existingYears.some(
          (py) =>
            (py === 0 && v.length >= 4) ||
            (py > 0 && yrNum > 0 && Math.abs(py - yrNum) <= 1)
        )
      ) {
        isDup = true;
        break;
      }
    }
    if (isDup) continue;

    seenIds.add(it.id);
    if (imdb) seenIds.add(imdb);
    if (mappedTmdbId) seenIds.add(mappedTmdbId);
    for (const v of variants) {
      const mapKey = `${it.type}:${v}`;
      const list = seenYearsByTypeTitle.get(mapKey);
      if (list) list.push(yrNum);
      else seenYearsByTypeTitle.set(mapKey, [yrNum]);
    }
    out.push(it);
  }
  return out;
}
