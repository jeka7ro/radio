export interface IedemVodItem {
  type: 'stream' | 'multistream' | 'next' | 'category';
  title: string;
  img?: string;
  imglr?: string;
  fid: number;
  url?: string;
  variants?: Record<string, string>;
  fhd?: boolean;
  '4k'?: boolean;
  hdr?: boolean;
  year?: number;
  duration?: number;
  description?: string;
  agelimit?: number;
  request?: Record<string, unknown>;
}

export interface IedemVodDetailResponse {
  type: 'stream' | 'multistream';
  title: string;
  img?: string;
  imglr?: string;
  fid?: number;
  url?: string;
  variants?: Record<string, string>;
  items?: IedemVodItem[];
  fhd?: boolean;
  '4k'?: boolean;
  hdr?: boolean;
  year?: number;
  duration?: number;
  description?: string;
}

export interface IedemCategoryTab {
  id: string;
  label: string;
  labelRo?: string;
  labelEn?: string;
  fid: number;
  vc?: number;
  only4k?: boolean;
  onlyRu?: boolean;
  excludeRu?: boolean;
  iconType:
    | 'ru_movie'
    | 'ru_series'
    | 'movie'
    | 'series'
    | '4k_movie'
    | '4k_series'
    | 'tr_series'
    | 'cartoon'
    | 'cartoon_series'
    | 'anime'
    | 'tvshow'
    | 'sport';
}

export const IEDEM_VOD_CATEGORIES: IedemCategoryTab[] = [
  {
    id: 'movies_ru',
    label: 'Русские фильмы',
    labelRo: 'Filme Rusești',
    labelEn: 'Russian Movies',
    fid: 1,
    onlyRu: true,
    iconType: 'ru_movie',
  },
  {
    id: 'series_ru',
    label: 'Русские сериалы',
    labelRo: 'Seriale Rusești',
    labelEn: 'Russian Series',
    fid: 2,
    onlyRu: true,
    iconType: 'ru_series',
  },
  {
    id: 'movies',
    label: 'Фильмы (Новинки)',
    labelRo: 'Filme (Toate)',
    labelEn: 'Movies (All)',
    fid: 1,
    iconType: 'movie',
  },
  {
    id: 'series',
    label: 'Сериалы (Новинки)',
    labelRo: 'Seriale (Toate)',
    labelEn: 'Series (All)',
    fid: 2,
    iconType: 'series',
  },
  {
    id: 'movies_4k',
    label: 'Фильмы 4K UHD',
    labelRo: 'Filme 4K UHD',
    labelEn: '4K UHD Movies',
    fid: 1,
    only4k: true,
    iconType: '4k_movie',
  },
  {
    id: 'series_4k',
    label: 'Сериалы 4K UHD',
    labelRo: 'Seriale 4K UHD',
    labelEn: '4K UHD Series',
    fid: 2,
    only4k: true,
    iconType: '4k_series',
  },
];

export const IEDEM_VOD_YEARS = [
  { label: 'Все годы', value: '' },
  { label: '2026', value: '2026' },
  { label: '2025', value: '2025' },
  { label: '2024', value: '2024' },
  { label: '2023', value: '2023' },
  { label: '2022', value: '2022' },
  { label: '2021-2026', value: '2021-2026' },
  { label: '2016-2021', value: '2016-2021' },
];

export const IEDEM_VOD_GENRES: Array<{ label: string; value: number }> = [
  { label: 'Все жанры', value: 0 },
  { label: 'Боевики', value: 3 },
  { label: 'Комедии', value: 10 },
  { label: 'Триллеры', value: 19 },
  { label: 'Фантастика', value: 21 },
  { label: 'Детективы', value: 5 },
  { label: 'Драмы', value: 7 },
  { label: 'Приключения', value: 15 },
  { label: 'Криминал', value: 11 },
  { label: 'Ужасы', value: 20 },
  { label: 'Фэнтези', value: 22 },
  { label: 'Семейные', value: 16 },
  { label: 'Военные', value: 4 },
  { label: 'Исторические', value: 9 },
  { label: 'Документальные', value: 6 },
];

export function proxyIedemPosterUrl(rawUrl?: string): string {
  if (!rawUrl) return '';
  if (rawUrl.startsWith('http://')) {
    return `/api/iedem-vod?poster=${encodeURIComponent(rawUrl)}`;
  }
  return rawUrl;
}

function normalizeItems(items: IedemVodItem[] = []): IedemVodItem[] {
  return items
    .filter((it) => it && (it.type === 'stream' || it.type === 'multistream'))
    .map((it) => ({
      ...it,
      img: proxyIedemPosterUrl(it.img || it.imglr),
      imglr: proxyIedemPosterUrl(it.imglr || it.img),
    }));
}

export function isRussianIedemItem(it: IedemVodItem): boolean {
  const txt = `${it.title || ''} ${it.description || ''}`;
  const ruExplicit =
    /(Москв|москвич|московск|подмосков|петербург|ленинград|питер|росси|русск|советск|ссср|рубл|мвд|фсб|гибдд|следственн|участков|околоточн|сибирь|урал|кавказ|смоленск|сочи|крым|байкал|волг|воронеж|екатеринбург|казан|новосибирск|самар|ростов|краснодар|владивосток|калининград|мурманск|твер|тул|рязан|ярославл|гаи|омон|спецназ|кгб|колхоз|совхоз|хрущевк|коммуналк|мгу|гнесинк)/i.test(
      txt
    );
  if (ruExplicit) return true;

  const foreignExplicit =
    /(США|Америк|Чикаго|Нью-Йорк|Лос-Анджелес|Калифорни|Техас|Флорид|Вашингтон|Лондон|Англи|Великобритани|Франци|Париж|Испани|Итали|Германи|Швеци|Норвеги|Дани|Копенгаген|Польш|Инди|Пуны|Китай|Япони|Коре|Австрали|Канад|Мексик|Бразили|Амазон|Зеландии|Шотланди|Ирланди|Токио|Сеул|Берлин|Мадрид|Рим)/i.test(
      txt
    );
  if (foreignExplicit) return false;

  const ruNames =
    /(?:^|[^а-яёА-ЯЁ])(Иван|Илья|Алёш|Алеш|Добрын|Богатыр|Чебурашк|Буратин|Простоквашин|Домовой|Баба-?Яга|Кощей|Финист|Холоп|Брат|Бригада|Мажор|Триггер|Метод|Чикатило|Фишер|Папины дочки|Кухня|Ивановы|Жуки|Полярный|Универ|Интерны|След|Невский|Шеф|Первый отдел|Склифосовский|Ищейка|Знахарь|Глухарь|Карпов|Молодёжка|Содержанки|Беспринципные|Кибердеревня|Аня|Ира|Сергей|Паша|Саша|Сашу|Маша|Даша|Наташа|Соня|Женя|Дима|Димы|Вова|Коля|Петя|Вася|Лёша|Леша|Андрей|Алексей|Дмитрий|Максим|Владимир|Николай|Евгений|Михаил|Александр|Екатерина|Елена|Ольга|Татьяна|Светлана|Анастасия|Виктор|Игорь|Олег|Юрий|Борис|Глеб|Валера|Толя|Федя|Семён|Семен|Егор|Артем|Артём|Кирилл|Никита|Денис|Роман|Павел|Константин|Антон|Вадим|Руслан|Тимур|Марат|Настя|Катя|Юля|Лена|Оля|Таня|Света|Ксюша|Вика|Алиса|Данила|Сержант)(?:$|[^а-яёА-ЯЁ])/.test(
      txt
    );
  const ruSurname =
    /(?:^|[^а-яёА-ЯЁ])[А-ЯЁ][а-яё]{2,}(ов|ова|овых|ев|ева|евых|ин|ина|иных|ский|ская|ских|цкий|цкая|ович|евич|овна|евна)(?:$|[^а-яёА-ЯЁ])/.test(
      txt
    );
  return ruNames || ruSurname;
}

export async function fetchIedemCatalogItems(params: {
  fid: number;
  vc?: number;
  offset?: number;
  years?: string;
  genre?: number;
  only4k?: boolean;
  onlyRu?: boolean;
  excludeRu?: boolean;
}): Promise<{ items: IedemVodItem[]; hasMore: boolean }> {
  const sp = new URLSearchParams();
  sp.set('cmd', 'flicks');
  sp.set('fid', String(params.fid));
  sp.set('offset', String(params.offset || 0));
  sp.set('limit', '300');
  if (params.vc) sp.set('vc', String(params.vc));
  if (params.years) {
    sp.set('filter', 'on');
    sp.set('years', params.years);
  }
  if (params.genre && params.genre > 0) {
    sp.set('filter', 'on');
    sp.set('genre', String(params.genre));
  }

  const res = await fetch(`/api/iedem-vod?${sp.toString()}`);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const data = (await res.json()) as { items?: IedemVodItem[] };
  const rawList = data.items || [];
  const hasNext = rawList.some((x) => x.type === 'next');
  let items = normalizeItems(rawList);
  if (params.only4k) {
    items = items.filter((x) => Boolean(x['4k']));
  }
  if (params.onlyRu) {
    items = items.filter((x) => isRussianIedemItem(x));
  } else if (params.excludeRu) {
    items = items.filter((x) => !isRussianIedemItem(x));
  }
  return { items, hasMore: hasNext };
}

export async function searchIedemVod(query: string): Promise<IedemVodItem[]> {
  const clean = query.trim();
  if (!clean) return [];
  const sp = new URLSearchParams({
    cmd: 'search',
    query: clean,
  });
  const res = await fetch(`/api/iedem-vod?${sp.toString()}`);
  if (!res.ok) return [];
  const data = (await res.json()) as { items?: IedemVodItem[] };
  return normalizeItems(data.items || []);
}

export async function fetchIedemItemDetail(
  fid: number
): Promise<IedemVodDetailResponse | null> {
  const sp = new URLSearchParams({
    cmd: 'flick',
    fid: String(fid),
  });
  const res = await fetch(`/api/iedem-vod?${sp.toString()}`);
  if (!res.ok) return null;
  const data = (await res.json()) as IedemVodDetailResponse;
  if (data.img) data.img = proxyIedemPosterUrl(data.img);
  if (data.imglr) data.imglr = proxyIedemPosterUrl(data.imglr);
  return data;
}

