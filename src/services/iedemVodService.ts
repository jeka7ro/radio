export type IedemTvShowNetworkId = 'all' | 'tnt' | 'vk' | 'pyatnitsa' | 'sts_ntv';

export interface IedemVodItem {
  type: 'stream' | 'multistream' | 'next' | 'category';
  title: string;
  img?: string;
  imglr?: string;
  fid: number;
  kpId?: number;
  explicitSeason?: number;
  episodesCount?: number;
  seasonsCount?: number;
  tvShowNetwork?: Exclude<IedemTvShowNetworkId, 'all'>;
  networkBadge?: string;
  url?: string;
  variants?: Record<string, string>;
  fhd?: boolean;
  '4k'?: boolean;
  hdr?: boolean;
  year?: number;
  duration?: number;
  description?: string;
  agelimit?: number;
  ratingKinopoisk?: string;
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
    id: 'series_ru',
    label: 'Русские сериалы',
    labelRo: 'Seriale Rusești',
    labelEn: 'Russian Series',
    fid: 2,
    onlyRu: true,
    iconType: 'ru_series',
  },
  {
    id: 'tvshows_ru',
    label: 'Телепередачи и ТВ-Шоу',
    labelRo: 'TV & Emisiuni Rusești',
    labelEn: 'Russian TV Shows',
    fid: 6,
    onlyRu: true,
    iconType: 'tvshow',
  },
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
    id: 'cartoons_ru',
    label: 'Русские мультфильмы',
    labelRo: 'Desene Rusești',
    labelEn: 'Russian Cartoons',
    fid: 3,
    onlyRu: true,
    iconType: 'cartoon',
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
  { label: 'Боевики', value: 2 },
  { label: 'Комедии', value: 9 },
  { label: 'Триллеры', value: 19 },
  { label: 'Фантастика', value: 21 },
  { label: 'Детективы', value: 5 },
  { label: 'Драмы', value: 7 },
  { label: 'Приключения', value: 15 },
  { label: 'Криминал', value: 10 },
  { label: 'Мелодрамы', value: 11 },
  { label: 'Ужасы', value: 20 },
  { label: 'Фэнтези', value: 22 },
  { label: 'Семейные', value: 16 },
  { label: 'Военные', value: 4 },
  { label: 'Исторические', value: 8 },
  { label: 'Документальные', value: 6 },
];

export interface IedemTvShowNetworkFilter {
  id: IedemTvShowNetworkId;
  label: string;
  labelRo: string;
  labelEn: string;
  badgeColor: string;
}

export const IEDEM_TVSHOW_NETWORKS: IedemTvShowNetworkFilter[] = [
  {
    id: 'all',
    label: 'Все ТОП-Шоу',
    labelRo: 'Toate Top Emisiuni',
    labelEn: 'All Top Shows',
    badgeColor: '#2563eb',
  },
  {
    id: 'tnt',
    label: 'ТНТ (Comedy • Реалити)',
    labelRo: 'ТНТ (Comedy • Reality)',
    labelEn: 'TNT (Comedy • Reality)',
    badgeColor: '#e11d48',
  },
  {
    id: 'vk',
    label: 'VK Видео & Звёзды',
    labelRo: 'VK Video & Звёзды',
    labelEn: 'VK Video & Zvezdy',
    badgeColor: '#0077ff',
  },
  {
    id: 'pyatnitsa',
    label: 'Пятница! (Шефы • Реалити)',
    labelRo: 'Пятница! (Chefi • Reality)',
    labelEn: 'Pyatnitsa! (Chefs • Reality)',
    badgeColor: '#d97706',
  },
  {
    id: 'sts_ntv',
    label: 'СТС • НТВ • КВН',
    labelRo: 'СТС • НТВ • КВН',
    labelEn: 'STS • NTV • KVN',
    badgeColor: '#7c3aed',
  },
];

export const CURATED_TOP_RUSSIAN_TV_SHOWS: IedemVodItem[] = [
  // ================= VK ВИДЕО & ЗВЁЗДЫ =================
  {
    type: 'multistream',
    fid: -5318639,
    kpId: 5318639,
    title: 'Шоу «Кстати» (VK Видео)',
    img: 'https://kinopoiskapiunofficial.tech/images/posters/kp/5318639.jpg',
    fhd: true,
    year: 2026,
    ratingKinopoisk: '7.6',
    episodesCount: 120,
    seasonsCount: 1,
    tvShowNetwork: 'vk',
    networkBadge: 'VK Видео',
    agelimit: 18,
    description:
      'Главное вечернее разговорно-юмористическое шоу VK Видео с Гариком Харламовым, Азаматом Мусагалиевым и Денисом Дороховым. Звёздные гости, живая музыка и жёсткие импровизации.',
  },
  {
    type: 'multistream',
    fid: -550853001,
    kpId: 5508530,
    explicitSeason: 1,
    title: 'Звёзды. Сезон 1 (НТВ • VK Видео)',
    img: 'https://kinopoiskapiunofficial.tech/images/posters/kp/5508530.jpg',
    fhd: true,
    year: 2024,
    ratingKinopoisk: '7.9',
    episodesCount: 10,
    seasonsCount: 3,
    tvShowNetwork: 'vk',
    networkBadge: 'VK • НТВ',
    agelimit: 18,
    description:
      '1-й сезон главного юмористического баттла страны (ведущий Азамат Мусагалиев). 10 сильнейших команд и звёзды шоу-бизнеса (Киркоров, Дорохов, Джиган, Мигель, Губерниев) борются за призовой фонд 20 млн рублей.',
  },
  {
    type: 'multistream',
    fid: -550853002,
    kpId: 5508530,
    explicitSeason: 2,
    title: 'Звёзды. Сезон 2 (НТВ • VK Видео)',
    img: 'https://kinopoiskapiunofficial.tech/images/posters/kp/5508530.jpg',
    fhd: true,
    year: 2025,
    ratingKinopoisk: '7.9',
    episodesCount: 8,
    seasonsCount: 3,
    tvShowNetwork: 'vk',
    networkBadge: 'VK • НТВ',
    agelimit: 18,
    description:
      '2-й сезон грандиозного юмористического проекта «Звёзды» на НТВ и VK Видео. Новые звёздные лидеры, дуэли команд и финал сезона.',
  },
  {
    type: 'multistream',
    fid: -550853003,
    kpId: 5508530,
    explicitSeason: 3,
    title: 'Звёзды. Сезон 3 • Новогодний Кубок и Фестиваль',
    img: 'https://kinopoiskapiunofficial.tech/images/posters/kp/5508530.jpg',
    fhd: true,
    year: 2026,
    ratingKinopoisk: '7.9',
    episodesCount: 3,
    seasonsCount: 3,
    tvShowNetwork: 'vk',
    networkBadge: 'VK • НТВ',
    agelimit: 18,
    description:
      'Специальный 3-й сезон шоу «Звёзды»: Новогодний кубок и большой фестиваль лучших команд проекта.',
  },
  {
    type: 'multistream',
    fid: -5423568,
    kpId: 5423568,
    title: 'Большое шоу (VK Видео • Азамат Мусагалиев)',
    img: 'https://kinopoiskapiunofficial.tech/images/posters/kp/5423568.jpg',
    fhd: true,
    year: 2026,
    ratingKinopoisk: '7.8',
    episodesCount: 94,
    seasonsCount: 19,
    tvShowNetwork: 'vk',
    networkBadge: 'VK Видео',
    agelimit: 18,
    description:
      'Хитовое комедийное реалити Азамата Мусагалиева (все 19 сезонов). Десять известных комиков и звёзд запираются в одной комнате: кто засмеётся или улыбнётся — выбывает.',
  },

  // ================= ТНТ =================
  {
    type: 'multistream',
    fid: -471505,
    kpId: 471505,
    title: 'Comedy Club (ТНТ • Все сезоны)',
    img: 'https://kinopoiskapiunofficial.tech/images/posters/kp/471505.jpg',
    fhd: true,
    year: 2026,
    ratingKinopoisk: '7.5',
    episodesCount: 709,
    seasonsCount: 22,
    tvShowNetwork: 'tnt',
    networkBadge: 'ТНТ',
    agelimit: 18,
    description:
      'Флагманское юмористическое шоу телеканала ТНТ с Гариком Харламовым, Павлом Волей, Тимуром Батрутдиновым, Демисом Карибидисом и Мариной Кравец.',
  },
  {
    type: 'multistream',
    fid: -1344492,
    kpId: 1344492,
    title: 'Женский стендап на ТНТ',
    img: 'https://kinopoiskapiunofficial.tech/images/posters/kp/1344492.jpg',
    fhd: true,
    year: 2026,
    ratingKinopoisk: '7.6',
    episodesCount: 109,
    seasonsCount: 8,
    tvShowNetwork: 'tnt',
    networkBadge: 'ТНТ',
    agelimit: 18,
    description:
      'Откровенный и бескомпромиссный стендап на ТНТ: Ирина Мягкова, Зоя Яровицына, Варвара Щербакова, Надежда Джабраилова, Мария Маркова и Сауле Юсупова.',
  },
  {
    type: 'multistream',
    fid: -802911,
    kpId: 802911,
    title: 'Stand Up на ТНТ',
    img: 'https://kinopoiskapiunofficial.tech/images/posters/kp/802911.jpg',
    fhd: true,
    year: 2026,
    ratingKinopoisk: '7.8',
    episodesCount: 317,
    seasonsCount: 13,
    tvShowNetwork: 'tnt',
    networkBadge: 'ТНТ',
    agelimit: 18,
    description:
      'Главное стендап-шоу страны на ТНТ: Алексей Щербаков, Нурлан Сабуров, Руслан Белый, Иван Абрамов, Тимур Каргинов, Виктория Складчикова и Евгений Чебатков.',
  },
  {
    type: 'multistream',
    fid: -842497,
    kpId: 842497,
    title: 'Однажды в России (ТНТ)',
    img: 'https://kinopoiskapiunofficial.tech/images/posters/kp/842497.jpg',
    fhd: true,
    year: 2026,
    ratingKinopoisk: '7.2',
    episodesCount: 292,
    seasonsCount: 2,
    tvShowNetwork: 'tnt',
    networkBadge: 'ТНТ',
    agelimit: 16,
    description:
      'Острая сатирическая скетч-программа ТНТ с Азаматом Мусагалиевым, Денисом Дороховым, Ольгой Картунковой, Екатериной Моргуновой и Максимом Киселёвым.',
  },
  {
    type: 'multistream',
    fid: -5582628,
    kpId: 5582628,
    title: 'Титаны на ТНТ',
    img: 'https://kinopoiskapiunofficial.tech/images/posters/kp/5582628.jpg',
    fhd: true,
    year: 2026,
    ratingKinopoisk: '8.8',
    episodesCount: 64,
    seasonsCount: 5,
    tvShowNetwork: 'tnt',
    networkBadge: 'ТНТ',
    agelimit: 16,
    description:
      'Масштабное спортивно-экстремальное шоу ТНТ, где сильнейшие атлеты России проходят испытания, созданные искусственным интеллектом, ради приза в 10 миллионов рублей.',
  },
  {
    type: 'multistream',
    fid: -533142201,
    kpId: 5331422,
    explicitSeason: 1,
    title: 'Выжить в Дубае. Сезон 1 (ТНТ)',
    img: 'https://kinopoiskapiunofficial.tech/images/posters/kp/5331422.jpg',
    fhd: true,
    year: 2023,
    ratingKinopoisk: '7.2',
    episodesCount: 12,
    seasonsCount: 2,
    tvShowNetwork: 'tnt',
    networkBadge: 'ТНТ',
    agelimit: 16,
    description:
      'Реалити-шоу Павла Воли и Ляйсан Утяшевой на ТНТ: звёздная и народная команды сражаются за выживание в пустыне Дубая и суперприз 10 миллионов рублей.',
  },
  {
    type: 'multistream',
    fid: -533142202,
    kpId: 5331422,
    explicitSeason: 2,
    title: 'Выжить в Самарканде. Сезон 2 (ТНТ)',
    img: 'https://kinopoiskapiunofficial.tech/images/posters/kp/5331422.jpg',
    fhd: true,
    year: 2024,
    ratingKinopoisk: '7.2',
    episodesCount: 14,
    seasonsCount: 2,
    tvShowNetwork: 'tnt',
    networkBadge: 'ТНТ',
    agelimit: 16,
    description:
      'Второй сезон экстремального реалити Павла Воли и Ляйсан Утяшевой в горах и пустынях Узбекистана.',
  },
  {
    type: 'multistream',
    fid: -5463970,
    kpId: 5463970,
    title: 'Сокровища императора (ТНТ)',
    img: 'https://kinopoiskapiunofficial.tech/images/posters/kp/5463970.jpg',
    fhd: true,
    year: 2025,
    ratingKinopoisk: '7.5',
    episodesCount: 39,
    seasonsCount: 3,
    tvShowNetwork: 'tnt',
    networkBadge: 'ТНТ',
    agelimit: 16,
    description:
      'Приключенческое реалити-шоу ТНТ в Китае с ведущими Ольгой Бузовой и Михаилом Галустяном. Звёздные пары проходят испытания в борьбе за 1 миллион юаней.',
  },
  {
    type: 'multistream',
    fid: -4761950,
    kpId: 4761950,
    title: 'Звёзды в Африке (ТНТ • Все 5 сезонов)',
    img: 'https://kinopoiskapiunofficial.tech/images/posters/kp/4761950.jpg',
    fhd: true,
    year: 2024,
    ratingKinopoisk: '6.9',
    episodesCount: 75,
    seasonsCount: 5,
    tvShowNetwork: 'tnt',
    networkBadge: 'ТНТ',
    agelimit: 16,
    description:
      'Популярное реалити-шоу ТНТ с Ольгой Бузовой и Михаилом Галустяном в саванне Южной Африки.',
  },
  {
    type: 'multistream',
    fid: -14171220,
    kpId: 14171220,
    title: 'Звёзды в джунглях (ТНТ • Все 3 сезона)',
    img: 'https://kinopoiskapiunofficial.tech/images/posters/kp/4761950.jpg',
    fhd: true,
    year: 2025,
    ratingKinopoisk: '7.3',
    episodesCount: 35,
    seasonsCount: 3,
    tvShowNetwork: 'tnt',
    networkBadge: 'ТНТ',
    agelimit: 16,
    description:
      'Новое реалити-шоу ТНТ с Ольгой Бузовой и Михаилом Галустяном в джунглях Колумбии и Карибского побережья.',
  },
  {
    type: 'multistream',
    fid: -5509905,
    kpId: 5509905,
    title: 'Экстрасенсы. Битва сильнейших (ТНТ)',
    img: 'https://kinopoiskapiunofficial.tech/images/posters/kp/5509905.jpg',
    fhd: true,
    year: 2025,
    ratingKinopoisk: '7.0',
    episodesCount: 61,
    seasonsCount: 2,
    tvShowNetwork: 'tnt',
    networkBadge: 'ТНТ',
    agelimit: 16,
    description:
      'Главный мистический турнир ТНТ: победители и финалисты прошлых сезонов «Битвы экстрасенсов» сходятся в личном противостоянии.',
  },
  {
    type: 'multistream',
    fid: -467943,
    kpId: 467943,
    title: 'Битва экстрасенсов (ТНТ)',
    img: 'https://kinopoiskapiunofficial.tech/images/posters/kp/467943.jpg',
    fhd: true,
    year: 2025,
    ratingKinopoisk: '6.8',
    episodesCount: 355,
    seasonsCount: 25,
    tvShowNetwork: 'tnt',
    networkBadge: 'ТНТ',
    agelimit: 16,
    description:
      'Легендарное мистическое реалити-шоу телеканала ТНТ с ведущим Маратом Башаровым.',
  },
  {
    type: 'multistream',
    fid: -5190505,
    kpId: 5190505,
    title: 'Концерты на ТНТ',
    img: 'https://kinopoiskapiunofficial.tech/images/posters/kp/5190505.jpg',
    fhd: true,
    year: 2024,
    ratingKinopoisk: '6.6',
    episodesCount: 24,
    seasonsCount: 2,
    tvShowNetwork: 'tnt',
    networkBadge: 'ТНТ',
    agelimit: 16,
    description:
      'Большие сольные концерты лучших юмористических коллективов страны («Камызяки», «Союз», «Плюшки», «Юг» и др.) на ТНТ.',
  },
  {
    type: 'multistream',
    fid: -4640330,
    kpId: 4640330,
    title: 'ИГРА на ТНТ',
    img: 'https://kinopoiskapiunofficial.tech/images/posters/kp/4640330.jpg',
    fhd: true,
    year: 2021,
    ratingKinopoisk: '7.9',
    episodesCount: 6,
    seasonsCount: 1,
    tvShowNetwork: 'tnt',
    networkBadge: 'ТНТ',
    agelimit: 18,
    description:
      'Культовый юмористический турнир ТНТ: 12 лучших комедийных коллективов страны («Камызяки», «Лена Кука», «Студия Союз», «Плюшки») в битве за 30 млн рублей.',
  },
  {
    type: 'multistream',
    fid: -4374613,
    kpId: 4374613,
    title: 'Музыкальная интуиция (ТНТ)',
    img: 'https://kinopoiskapiunofficial.tech/images/posters/kp/4374613.jpg',
    fhd: true,
    year: 2025,
    ratingKinopoisk: '7.0',
    episodesCount: 73,
    seasonsCount: 6,
    tvShowNetwork: 'tnt',
    networkBadge: 'ТНТ',
    agelimit: 16,
    description:
      'Музыкально-детективное шоу Азамата Мусагалиева на ТНТ, где звёзды музыки и юмора угадывают, кто из участников поёт, а кто только делает вид.',
  },
  {
    type: 'multistream',
    fid: -1047767,
    kpId: 1047767,
    title: 'Импровизация на ТНТ',
    img: 'https://kinopoiskapiunofficial.tech/images/posters/kp/1047767.jpg',
    fhd: true,
    year: 2023,
    ratingKinopoisk: '8.3',
    episodesCount: 178,
    seasonsCount: 8,
    tvShowNetwork: 'tnt',
    networkBadge: 'ТНТ',
    agelimit: 16,
    description:
      'Шоу без сценария на ТНТ с Павлом Волей и четвёркой импровизаторов: Антон Шастун, Арсений Попов, Дмитрий Позов и Сергей Матвиенко.',
  },
  {
    type: 'multistream',
    fid: -5354824,
    kpId: 5354824,
    title: 'Шоу Воли (ТНТ)',
    img: 'https://kinopoiskapiunofficial.tech/images/posters/kp/5354824.jpg',
    fhd: true,
    year: 2026,
    ratingKinopoisk: '7.8',
    episodesCount: 180,
    seasonsCount: 1,
    tvShowNetwork: 'tnt',
    networkBadge: 'ТНТ',
    agelimit: 16,
    description:
      'Большое воскресное вечернее шоу Павла Воли и Ильи Соболева на ТНТ с главными звёздами, итогами недели и музыкальными номерами.',
  },
  {
    type: 'multistream',
    fid: -5452387,
    kpId: 5452387,
    title: 'Новая Фабрика звёзд (ТНТ)',
    img: 'https://kinopoiskapiunofficial.tech/images/posters/kp/5452387.jpg',
    fhd: true,
    year: 2024,
    ratingKinopoisk: '6.5',
    episodesCount: 12,
    seasonsCount: 1,
    tvShowNetwork: 'tnt',
    networkBadge: 'ТНТ',
    agelimit: 12,
    description:
      'Возрождение легендарного музыкального реалити на ТНТ под руководством наставников Сергея Жукова и Сергея Шнурова.',
  },

  // ================= ПЯТНИЦА! =================
  {
    type: 'multistream',
    fid: -5320550,
    kpId: 5320550,
    title: 'На ножах (Пятница! • Константин Ивлев)',
    img: 'https://kinopoiskapiunofficial.tech/images/posters/kp/5320550.jpg',
    fhd: true,
    year: 2025,
    ratingKinopoisk: '7.2',
    episodesCount: 176,
    seasonsCount: 9,
    tvShowNetwork: 'pyatnitsa',
    networkBadge: 'Пятница!',
    agelimit: 16,
    description:
      'Знаменитое кулинарное реалити-шоу телеканала «Пятница!»: шеф-повар Константин Ивлев спасает убыточные кафе и рестораны по всей стране.',
  },
  {
    type: 'multistream',
    fid: -5367740,
    kpId: 5367740,
    title: 'Битва шефов (Пятница! • Ивлев и Агзамов)',
    img: 'https://img.imgilall.me/movies/video/6/0/8/7/0/0/0/0/0/0/800x450_608700.jpg',
    fhd: true,
    year: 2025,
    ratingKinopoisk: '7.2',
    episodesCount: 139,
    seasonsCount: 6,
    tvShowNetwork: 'pyatnitsa',
    networkBadge: 'Пятница!',
    agelimit: 16,
    description:
      'Кулинарный поединок титанов на телеканале «Пятница!»: Константин Ивлев и Ренат Агзамов набирают свои команды поваров и выясняют, чей талант сильнее.',
  },
  {
    type: 'multistream',
    fid: -5189047,
    kpId: 5189047,
    title: 'Адский шеф (Пятница! • Константин Ивлев)',
    img: 'https://kinopoiskapiunofficial.tech/images/posters/kp/5189047.jpg',
    fhd: true,
    year: 2025,
    ratingKinopoisk: '7.6',
    episodesCount: 68,
    seasonsCount: 4,
    tvShowNetwork: 'pyatnitsa',
    networkBadge: 'Пятница!',
    agelimit: 16,
    description:
      'Экстремальная кулинарная академия Константина Ивлева на телеканале «Пятница!». Испытания на выживание и высокая кухня.',
  },
  {
    type: 'multistream',
    fid: -5320563,
    kpId: 5320563,
    title: 'Кондитер (Пятница! • Ренат Агзамов)',
    img: 'https://img.imgilall.me/movies/video/5/9/1/7/1/8/0/0/0/0/800x450_591718.jpg',
    fhd: true,
    year: 2025,
    ratingKinopoisk: '6.7',
    episodesCount: 107,
    seasonsCount: 7,
    tvShowNetwork: 'pyatnitsa',
    networkBadge: 'Пятница!',
    agelimit: 16,
    description:
      'Главное сладкое шоу телеканала «Пятница!» с королём тортов Ренатом Агзамовым.',
  },
  {
    type: 'multistream',
    fid: -5326185,
    kpId: 5326185,
    title: 'Пацанки / Новые Пацанки (Пятница!)',
    img: 'https://kinopoiskapiunofficial.tech/images/posters/kp/5326185.jpg',
    fhd: true,
    year: 2025,
    ratingKinopoisk: '6.5',
    episodesCount: 157,
    seasonsCount: 10,
    tvShowNetwork: 'pyatnitsa',
    networkBadge: 'Пятница!',
    agelimit: 18,
    description:
      'Социальное реалити-шоу телеканала «Пятница!» о преображении девушек с непростой судьбой в Школе Леди.',
  },
  {
    type: 'multistream',
    fid: -5617914,
    kpId: 5617914,
    title: 'Выживалити (Пятница!)',
    img: 'https://kinopoiskapiunofficial.tech/images/posters/kp/5617914.jpg',
    fhd: true,
    year: 2025,
    ratingKinopoisk: '7.6',
    episodesCount: 36,
    seasonsCount: 4,
    tvShowNetwork: 'pyatnitsa',
    networkBadge: 'Пятница!',
    agelimit: 16,
    description:
      'Самое жёсткое экстремально-психологическое реалити-шоу на выживание телеканала «Пятница!» с ведущим Вадимом Демчогом.',
  },

  // ================= СТС • НТВ • КВН =================
  {
    type: 'multistream',
    fid: -5267860,
    kpId: 5267860,
    title: 'Импровизаторы (СТС)',
    img: 'https://kinopoiskapiunofficial.tech/images/posters/kp/5267860.jpg',
    fhd: true,
    year: 2025,
    ratingKinopoisk: '8.5',
    episodesCount: 51,
    seasonsCount: 5,
    tvShowNetwork: 'sts_ntv',
    networkBadge: 'СТС',
    agelimit: 16,
    description:
      'Антон Шастун, Арсений Попов, Дмитрий Позов и Сергей Матвиенко в комедийном шоу без сценария на телеканале СТС.',
  },
  {
    type: 'multistream',
    fid: -573840,
    kpId: 573840,
    title: 'Шоу «Уральских пельменей» (СТС)',
    img: 'https://kinopoiskapiunofficial.tech/images/posters/kp/573840.jpg',
    fhd: true,
    year: 2026,
    ratingKinopoisk: '7.0',
    episodesCount: 212,
    seasonsCount: 1,
    tvShowNetwork: 'sts_ntv',
    networkBadge: 'СТС',
    agelimit: 16,
    description:
      'Все концерты и выпуски легендарного семейного юмористического шоу «Уральские пельмени» на СТС.',
  },
  {
    type: 'multistream',
    fid: -5255425,
    kpId: 5255425,
    title: 'Суперниндзя (СТС)',
    img: 'https://kinopoiskapiunofficial.tech/images/posters/kp/5255425.jpg',
    fhd: true,
    year: 2025,
    ratingKinopoisk: '8.6',
    episodesCount: 57,
    seasonsCount: 5,
    tvShowNetwork: 'sts_ntv',
    networkBadge: 'СТС',
    agelimit: 12,
    description:
      'Грандиозное спортивно-экстремальное шоу СТС на сложнейшей полосе препятствий в Минеральных Водах.',
  },
  {
    type: 'multistream',
    fid: -5463968,
    kpId: 5463968,
    title: 'Прятки (СТС • Егор Крид)',
    img: 'https://kinopoiskapiunofficial.tech/images/posters/kp/5463968.jpg',
    fhd: true,
    year: 2025,
    ratingKinopoisk: '8.1',
    episodesCount: 17,
    seasonsCount: 2,
    tvShowNetwork: 'sts_ntv',
    networkBadge: 'СТС',
    agelimit: 16,
    description:
      'Экстремальные прятки со звёздами в заброшенных локациях по всей стране на телеканале СТС.',
  },
  {
    type: 'multistream',
    fid: -5194229,
    kpId: 5194229,
    title: 'Шоу «Маска» (НТВ)',
    img: 'https://kinopoiskapiunofficial.tech/images/posters/kp/5194229.jpg',
    fhd: true,
    year: 2025,
    ratingKinopoisk: '8.1',
    episodesCount: 88,
    seasonsCount: 7,
    tvShowNetwork: 'sts_ntv',
    networkBadge: 'НТВ',
    agelimit: 12,
    description:
      'Главное музыкальное шоу-загадка телеканала НТВ: суперзвёзды выступают в фантастических костюмах, скрывая свою личность.',
  },
  {
    type: 'multistream',
    fid: 133136,
    title: 'КВН-2025. Высшая лига',
    img: proxyIedemPosterUrl('http://895890bd73a7.jmeekos.com/posters/h/p_00023654.jpg'),
    fhd: true,
    year: 2025,
    ratingKinopoisk: '7.4',
    episodesCount: 16,
    seasonsCount: 1,
    tvShowNetwork: 'sts_ntv',
    networkBadge: 'КВН',
    agelimit: 12,
    description:
      'Все игры Высшей лиги КВН сезона 2025 года в Full HD 1080p.',
  },
  {
    type: 'multistream',
    fid: 133120,
    title: 'КВН-2024. Высшая лига',
    img: proxyIedemPosterUrl('http://895890bd73a7.jmeekos.com/posters/h/p_00023655.jpg'),
    fhd: true,
    year: 2024,
    ratingKinopoisk: '7.4',
    episodesCount: 15,
    seasonsCount: 1,
    tvShowNetwork: 'sts_ntv',
    networkBadge: 'КВН',
    agelimit: 12,
    description:
      'Все игры Высшей лиги КВН сезона 2024 года в Full HD 1080p.',
  },
  {
    type: 'multistream',
    fid: 104452,
    title: 'КВН-2023. Высшая лига',
    img: proxyIedemPosterUrl('http://895890bd73a7.jmeekos.com/posters/h/p_00019443.jpg'),
    fhd: true,
    year: 2023,
    ratingKinopoisk: '7.3',
    episodesCount: 11,
    seasonsCount: 1,
    tvShowNetwork: 'sts_ntv',
    networkBadge: 'КВН',
    agelimit: 12,
    description:
      'Высшая лига КВН сезона 2023 года и Кубок мэра Москвы в Full HD 1080p.',
  },
];

export interface IedemVerifiedMeta {
  year?: number;
  isRussian?: boolean;
  kpId?: number;
  ratingKinopoisk?: string;
  checkedAt: number;
}

const IEDEM_KP_CACHE_KEY = 'iedem_kp_verified_meta_v3';
const iedemKpCache = new Map<string, IedemVerifiedMeta>();

try {
  if (typeof window !== 'undefined' && window.localStorage) {
    const raw = window.localStorage.getItem(IEDEM_KP_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, IedemVerifiedMeta>;
      for (const [k, v] of Object.entries(parsed)) {
        if (v && typeof v === 'object') {
          iedemKpCache.set(k, v);
        }
      }
    }
  }
} catch {
  // ignore storage errors
}

function persistIedemKpCache(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const obj: Record<string, IedemVerifiedMeta> = {};
    let count = 0;
    for (const [k, v] of iedemKpCache.entries()) {
      obj[k] = v;
      count++;
      if (count >= 1500) break;
    }
    window.localStorage.setItem(IEDEM_KP_CACHE_KEY, JSON.stringify(obj));
  } catch {
    // ignore storage errors
  }
}

export function cleanIedemBaseTitle(rawTitle?: string): string {
  return String(rawTitle || '')
    .replace(/\(\d{4}\)/g, ' ')
    .replace(/\[.*?\]/g, ' ')
    .replace(/\b(4K|UHD|HDR|FHD|1080p)\b/gi, ' ')
    .replace(/[.\s-]*Сезон\s*\d+\.?/gi, '')
    .replace(/[.\s-]*Выпуск\s*\d+\.?/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/[.\s-]+$/g, '')
    .trim();
}

function normalizeRuCompareKey(str?: string): string {
  return String(str || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .trim();
}

export function getIedemKpCacheKey(item: Pick<IedemVodItem, 'title' | 'type'>): string {
  const isSeries = item.type === 'multistream';
  const base = normalizeRuCompareKey(cleanIedemBaseTitle(item.title));
  return `${isSeries ? 's' : 'm'}_${base}`;
}

export function getCachedIedemVerifiedMeta(
  item: Pick<IedemVodItem, 'title' | 'type'>
): IedemVerifiedMeta | undefined {
  const key = getIedemKpCacheKey(item);
  return iedemKpCache.get(key);
}

export function extractExplicitYearFromIedemText(item: IedemVodItem): number | undefined {
  const title = String(item.title || '');
  // Match explicit 4-digit year in title like "Концерт 2020", "(2023)", "КВН-2024", "1987"
  const titleYearMatch = title.match(/(?:^|[\s(\-«"])(19[4-9]\d|20[0-2]\d)(?:$|[\s).»"г])/i);
  if (titleYearMatch) {
    const y = Number(titleYearMatch[1]);
    if (y >= 1940 && y <= 2026) return y;
  }
  const cached = getCachedIedemVerifiedMeta(item);
  if (cached?.year && cached.year >= 1940 && cached.year <= 2026) {
    return cached.year;
  }
  if (typeof item.year === 'number' && item.year >= 1940 && item.year <= 2026) {
    return item.year;
  }
  return undefined;
}

export async function resolveIedemKinopoiskMeta(
  item: IedemVodItem
): Promise<IedemVerifiedMeta> {
  const cacheKey = getIedemKpCacheKey(item);
  const existing = iedemKpCache.get(cacheKey);
  if (existing) return existing;

  const baseTitle = cleanIedemBaseTitle(item.title);
  const normTarget = normalizeRuCompareKey(baseTitle);
  if (!baseTitle || normTarget.length < 2) {
    const empty: IedemVerifiedMeta = { checkedAt: Date.now() };
    iedemKpCache.set(cacheKey, empty);
    return empty;
  }

  try {
    const res = await fetch(
      `https://kinopoiskapiunofficial.tech/api/v2.1/films/search-by-keyword?keyword=${encodeURIComponent(
        baseTitle
      )}&page=1`,
      {
        headers: {
          'X-API-KEY': '8c8e1a50-6322-4135-8875-5d40a5420d86',
        },
      }
    );
    if (!res.ok) {
      return { checkedAt: Date.now() };
    }
    const data = (await res.json()) as {
      films?: Array<{
        filmId?: number;
        nameRu?: string;
        nameEn?: string;
        type?: string;
        year?: string | number;
        rating?: string | number;
        countries?: Array<{ country?: string }>;
      }>;
    };
    const films = Array.isArray(data.films) ? data.films : [];
    const wantSeries = item.type === 'multistream';

    const exactMatches = films.filter((f) => {
      const fNormRu = normalizeRuCompareKey(f.nameRu);
      const fNormEn = normalizeRuCompareKey(f.nameEn);
      return fNormRu === normTarget || (fNormEn && fNormEn === normTarget);
    });

    const isSeriesType = (t?: string) =>
      t === 'TV_SERIES' || t === 'MINI_SERIES' || t === 'TV_SHOW';

    const isRuCountryList = (countries?: Array<{ country?: string }>) =>
      Array.isArray(countries) &&
      countries.some((c) =>
        /(Росси|СССР|Беларус|Казахстан)/i.test(String(c?.country || ''))
      );

    // Prefer exact match with matching media type and Russian/USSR origin
    const chosen =
      exactMatches.find(
        (f) =>
          isSeriesType(f.type) === wantSeries &&
          isRuCountryList(f.countries) &&
          f.year &&
          f.year !== 'null'
      ) ||
      exactMatches.find(
        (f) =>
          isSeriesType(f.type) === wantSeries &&
          f.year &&
          f.year !== 'null'
      ) ||
      exactMatches.find((f) => isRuCountryList(f.countries) && f.year && f.year !== 'null') ||
      exactMatches.find((f) => f.year && f.year !== 'null');

    if (chosen) {
      const parsedYear = Number(String(chosen.year).slice(0, 4));
      const validYear =
        Number.isFinite(parsedYear) && parsedYear >= 1930 && parsedYear <= 2026
          ? parsedYear
          : undefined;
      const hasCountries =
        Array.isArray(chosen.countries) && chosen.countries.length > 0;
      const isRu = hasCountries ? isRuCountryList(chosen.countries) : undefined;

      const rawRating = String(chosen.rating || '').trim();
      let validRating: string | undefined;
      if (rawRating && rawRating !== 'null' && !rawRating.endsWith('%')) {
        const rNum = parseFloat(rawRating.replace(',', '.'));
        if (Number.isFinite(rNum) && rNum > 0 && rNum <= 10) {
          validRating = rNum.toFixed(1);
        }
      }

      const meta: IedemVerifiedMeta = {
        year: validYear,
        isRussian: isRu,
        kpId: chosen.filmId,
        ratingKinopoisk: validRating,
        checkedAt: Date.now(),
      };
      iedemKpCache.set(cacheKey, meta);
      persistIedemKpCache();
      return meta;
    }
  } catch {
    // ignore network error
  }

  const fallbackMeta: IedemVerifiedMeta = { checkedAt: Date.now() };
  iedemKpCache.set(cacheKey, fallbackMeta);
  return fallbackMeta;
}

export function proxyIedemPosterUrl(rawUrl?: string): string {
  if (!rawUrl) return '';
  if (rawUrl.startsWith('http://')) {
    return `/api/iedem-vod?poster=${encodeURIComponent(rawUrl)}`;
  }
  return rawUrl;
}

function normalizeItems(items: IedemVodItem[] = []): IedemVodItem[] {
  const seenFids = new Set<number>();
  const seenTitleKeys = new Set<string>();
  const out: IedemVodItem[] = [];

  for (const it of items) {
    if (!it || (it.type !== 'stream' && it.type !== 'multistream')) continue;
    if (it.fid && seenFids.has(it.fid)) continue;
    const cleanTitle = String(it.title || '')
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/\s*\(\d{4}\)\s*/g, ' ')
      .replace(/[^\p{L}\p{N}]+/gu, '')
      .trim();
    const titleKey = `${it.type}_${cleanTitle}`;
    if (cleanTitle && seenTitleKeys.has(titleKey)) continue;
    if (it.fid) seenFids.add(it.fid);
    if (cleanTitle) seenTitleKeys.add(titleKey);
    const resolvedYear = extractExplicitYearFromIedemText(it);
    const cachedMeta = getCachedIedemVerifiedMeta(it);
    out.push({
      ...it,
      year: resolvedYear ?? it.year,
      ratingKinopoisk: cachedMeta?.ratingKinopoisk || it.ratingKinopoisk,
      img: proxyIedemPosterUrl(it.img || it.imglr),
      imglr: proxyIedemPosterUrl(it.imglr || it.img),
    });
  }
  return out;
}

export function isRussianIedemItem(it: IedemVodItem): boolean {
  const cached = getCachedIedemVerifiedMeta(it);
  if (cached?.isRussian === false) return false;
  if (cached?.isRussian === true) return true;

  const txt = `${it.title || ''} ${it.description || ''}`;

  const foreignExplicit =
    /(США|Америк|Чикаго|Нью-Йорк|Лос-Анджелес|Калифорни|Техас|Флорид|Вашингтон|Оклахом|Каролин|Вирджини|Алабам|Невад|Аризон|Кентукк|Пенсильвани|Массачусетс|Коннектикут|Орегон|Мичиган|Иллинойс|Миссури|Луизиан|Джорджи|Теннесси|Лондон|Англи|Великобритани|Франци|Париж|Испани|Итали|Германи|Швеци|Норвеги|Дани|Копенгаген|Польш|Инди|Пуны|Китай|Япони|Коре|Австрали|Канад|Мексик|Бразили|Амазон|Зеландии|Шотланди|Ирланди|Токио|Сеул|Берлин|Мадрид|Рим|ФБР|ЦРУ|шериф|штат[аеу]?\b|доллар|колледж|миссис|мистер|сэр\b|лорд|Голливуд|Болливуд|BBC|Netflix|HBO|Шаолин|Остров Пальма|Симпсон|Перси Джексон)/i.test(
      txt
    );
  if (foreignExplicit) return false;

  const foreignNames =
    /(?:^|[^а-яёА-ЯЁ])(Тайлер|Джеки|Кларисс|Ганнибал|Леонард|Шелдон|Пенни|Раджеш|Дуайт|Манфреди|Хансен|Майкл|Джон|Джеймс|Дэвид|Роберт|Уильям|Ричард|Томас|Чарльз|Кристофер|Дэниел|Мэттью|Энтони|Стивен|Эндрю|Джошуа|Кевин|Брайан|Джордж|Эдвард|Тимоти|Джейсон|Джеффри|Райан|Джейкоб|Гэри|Николас|Джонатан|Джастин|Скотт|Брэндон|Бенджамин|Сэмюэл|Грегори|Фрэнк|Патрик|Джек|Деннис|Джерри|Аарон|Генри|Натан|Дуглас|Питер|Кайл|Уолтер|Итан|Джереми|Кристиан|Роджер|Ноа|Карл|Терри|Шон|Остин|Лоуренс|Джесси|Дилан|Джордан|Билли|Брюс|Уэйн|Винсент|Рассел|Луис|Бобби|Джонни|Мэри|Патриция|Дженнифер|Линда|Элизабет|Барбара|Сьюзан|Джессика|Сара|Карен|Нэнси|Бетти|Маргарет|Сандра|Эшли|Кимберли|Эмили|Донна|Мишель|Дороти|Кэрол|Аманда|Мелисса|Дебора|Стефани|Ребекка|Шэрон|Лора|Синтия|Кэтлин|Эми|Ширли|Анджела|Хелен|Бренда|Памела|Николь|Саманта|Кэтрин|Кристин|Дебра|Рэйчел|Кэролайн|Джанет|Хизер|Рут|Джули|Джойс|Келли|Лорен|Джоан|Эвелин|Джудит|Меган|Шерил|Ханна|Жаклин|Глория|Тереза|Мэдисон|Джин|Эбигейл|Элис|Джуди|Грейс|Дениз|Эмбер|Дорис|Мэрилин|Даниэль|Беверли|Изабелла|Бриттани|Шарлотта|Кайла|Алексис|Лори)(?:$|[^а-яёА-ЯЁ])/.test(
      txt
    );
  if (foreignNames) return false;

  const ruExplicit =
    /(?:^|[^а-яёА-ЯЁ])(Москв[аеуыой]|москвич\w*|московск\w*|подмосков\w*|петербург\w*|ленинград\w*|питер\w*|росси[ияюей]|российск\w*|советск\w*|ссср|рубл\w*|мвд|фсб|гибдд|следственн\w+\s+комитет\w*|участков\w+|околоточн\w+|сибирь|сибири|сибирск\w*|урал\w*|кавказ\w*|смоленск\w*|сочи|крым\w*|байкал\w*|волг[аеиуой]|воронеж\w*|екатеринбург\w*|казан[ьи]|казанск\w*|новосибирск\w*|самар[аеуыой]|самарск\w*|ростов-на-дону|ростовск\w*|краснодар\w*|владивосток\w*|калининград\w*|мурманск\w*|твер[ьи]|тверск\w*|тул[аеуыой]|тульск\w*|рязан[ьи]|рязанск\w*|ярославл\w*|ярославск\w*|гаи|омон|кгб|колхоз\w*|совхоз\w*|хрущевк\w*|коммуналк\w*|мгу|гнесинк\w*|квн|голубой огонёк|голубой огонек|уральских пельменей)(?:$|[^а-яёА-ЯЁ])/i.test(
      txt
    );
  if (ruExplicit) return true;

  const ruNames =
    /(?:^|[^а-яёА-ЯЁ])(Иван|Илья|Алёш|Алеш|Добрын|Богатыр|Чебурашк|Буратин|Простоквашин|Домовой|Баба-?Яга|Кощей|Финист|Холоп|Брат|Бригада|Мажор|Триггер|Метод|Чикатило|Фишер|Папины дочки|Кухня|Ивановы|Жуки|Полярный|Универ|Интерны|След|Невский|Шеф|Первый отдел|Склифосовский|Ищейка|Знахарь|Глухарь|Карпов|Молодёжка|Содержанки|Беспринципные|Кибердеревня|Аня|Ира|Сергей|Паша|Саша|Сашу|Маша|Даша|Наташа|Соня|Женя|Дима|Димы|Вова|Коля|Петя|Вася|Лёша|Леша|Андрей|Алексей|Дмитрий|Максим|Владимир|Николай|Евгений|Михаил|Александр|Екатерина|Елена|Ольга|Татьяна|Светлана|Анастасия|Виктор|Игорь|Олег|Юрий|Борис|Глеб|Валера|Толя|Федя|Семён|Семен|Егор|Артем|Артём|Кирилл|Никита|Денис|Роман|Павел|Константин|Антон|Вадим|Руслан|Тимур|Марат|Настя|Катя|Юля|Лена|Оля|Таня|Света|Ксюша|Вика|Данила)(?:$|[^а-яёА-ЯЁ])/.test(
      txt
    );
  const ruSurname =
    /(?:^|[^а-яёА-ЯЁ])[А-ЯЁ][а-яё]{2,}(ов|ова|овых|ев|ева|евых|ин|ина|иных|ский|ская|ских|цкий|цкая|ович|евич|овна|евна)(?:$|[^а-яёА-ЯЁ])/.test(
      txt
    );
  return ruNames || ruSurname;
}

export function matchesIedemYearFilter(itemYear?: number, filterYears?: string): boolean {
  if (!filterYears) return true;
  if (!itemYear) return false;
  const clean = filterYears.trim();
  const rangeMatch = clean.match(/^(\d{4})\s*-\s*(\d{4})$/);
  if (rangeMatch) {
    const yFrom = Number(rangeMatch[1]);
    const yTo = Number(rangeMatch[2]);
    const min = Math.min(yFrom, yTo);
    const max = Math.max(yFrom, yTo);
    return itemYear >= min && itemYear <= max;
  }
  const singleYear = Number(clean);
  if (Number.isFinite(singleYear) && singleYear > 1900) {
    return itemYear === singleYear;
  }
  return true;
}

export function sortIedemItemsByYearDesc(items: IedemVodItem[]): IedemVodItem[] {
  return [...items].sort((a, b) => {
    const yA = a.year || 0;
    const yB = b.year || 0;
    if (yB !== yA) return yB - yA;
    return (b.fid || 0) - (a.fid || 0);
  });
}

async function fetchSingleIedemPage(params: {
  fid: number;
  vc?: number;
  offset: number;
  years?: string;
  genre?: number;
}): Promise<{ rawList: IedemVodItem[]; hasNext: boolean }> {
  const sp = new URLSearchParams();
  // Note: upstream iEdem API ignores `filter=on` when `cmd=flicks` is present,
  // and `filter=on` without `cmd=flicks` only returns `stream` (movies).
  const useUpstreamFilterOnly =
    params.fid === 1 && Boolean(params.years || (params.genre && params.genre > 0));
  if (!useUpstreamFilterOnly) {
    sp.set('cmd', 'flicks');
    sp.set('fid', String(params.fid));
  }
  sp.set('offset', String(params.offset));
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
  return { rawList, hasNext };
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
  tvShowNetwork?: IedemTvShowNetworkId;
}): Promise<{ items: IedemVodItem[]; hasMore: boolean }> {
  // For Russian TV Shows (fid === 6), return the curated top shows from TNT, VK Video, Pyatnitsa!, STS, NTV & KVN
  if (params.fid === 6) {
    let curated = [...CURATED_TOP_RUSSIAN_TV_SHOWS];
    if (params.tvShowNetwork && params.tvShowNetwork !== 'all') {
      curated = curated.filter((x) => x.tvShowNetwork === params.tvShowNetwork);
    }
    if (params.years) {
      curated = curated.filter((x) => matchesIedemYearFilter(x.year, params.years));
    }
    return { items: curated, hasMore: false };
  }

  const baseOffset = params.offset || 0;
  // When filtering by year on series/TV shows/cartoons (fid !== 1), fetch 3 pages in parallel so we have a rich pool for that exact year
  const pagesToFetch =
    params.years && params.fid !== 1
      ? [baseOffset, baseOffset + 300, baseOffset + 600]
      : [baseOffset];

  const pageResults = await Promise.all(
    pagesToFetch.map((off) =>
      fetchSingleIedemPage({
        fid: params.fid,
        vc: params.vc,
        offset: off,
        years: params.years,
        genre: params.genre,
      }).catch(() => ({ rawList: [] as IedemVodItem[], hasNext: false }))
    )
  );

  const combinedRaw: IedemVodItem[] = [];
  let hasNext = false;
  for (const pr of pageResults) {
    combinedRaw.push(...pr.rawList);
    if (pr.hasNext) hasNext = true;
  }

  let items = normalizeItems(combinedRaw);
  if (params.only4k) {
    items = items.filter((x) => Boolean(x['4k']));
  }
  if (params.onlyRu) {
    items = items.filter((x) => isRussianIedemItem(x));
  } else if (params.excludeRu) {
    items = items.filter((x) => !isRussianIedemItem(x));
  }
  if (params.years) {
    items = items.filter((x) => matchesIedemYearFilter(x.year, params.years));
  }

  return { items: sortIedemItemsByYearDesc(items), hasMore: hasNext };
}

export async function searchIedemVod(query: string): Promise<IedemVodItem[]> {
  const clean = query.trim();
  if (!clean) return [];
  const qNorm = clean
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\bkstati\b/g, 'кстати')
    .replace(/\bzvezdy\b|\bzvezdi\b/g, 'звезды')
    .replace(/\btnt\b/g, 'тнт')
    .replace(/\bpiatnica\b|\bpiatnitsa\b|\bpyatnitsa\b|\bpyatnica\b/g, 'пятница')
    .replace(/\bvk\b/g, 'вк vk')
    .replace(/\bkvn\b/g, 'квн')
    .replace(/\bstendap\b|\bstandup\b/g, 'стендап stand up')
    .trim();
  const tokens = qNorm.split(/\s+/).filter(Boolean);

  const matchedCurated = CURATED_TOP_RUSSIAN_TV_SHOWS.filter((show) => {
    const haystack = `${show.title} ${show.networkBadge || ''} ${show.description || ''}`
      .toLowerCase()
      .replace(/ё/g, 'е');
    return tokens.every((tk) => haystack.includes(tk));
  });

  const sp = new URLSearchParams({
    cmd: 'search',
    query: clean,
  });
  let apiItems: IedemVodItem[] = [];
  try {
    const res = await fetch(`/api/iedem-vod?${sp.toString()}`);
    if (res.ok) {
      const data = (await res.json()) as { items?: IedemVodItem[] };
      apiItems = sortIedemItemsByYearDesc(
        normalizeItems(data.items || []).filter((x) => isRussianIedemItem(x))
      );
    }
  } catch {
    // ignore search error if curated matches exist
  }

  const seenFids = new Set(matchedCurated.map((x) => x.fid));
  return [...matchedCurated, ...apiItems.filter((x) => !seenFids.has(x.fid))];
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
