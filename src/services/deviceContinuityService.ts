export interface SharedTvProfile {
  id: string;
  name: string;
  avatarEmoji: string;
  avatar?: string;
  avatarUrl?: string;
  avatarBg: string;
  pin?: string; // Optional 4-digit PIN e.g. "1234"
  isKids?: boolean;
  allowAdultContent?: boolean; // Managed exclusively by Admin profile JEKA
  allowIedemContent?: boolean; // Managed exclusively by Admin profile JEKA
  uiLang?: 'ro' | 'en' | 'ru';
  defaultAudioPref?: 'original' | 'ro' | 'ru' | 'uk' | 'first';
  defaultSubLang?: 'ro' | 'ru' | 'en' | 'es' | 'fr' | 'de' | 'off';
  defaultSubFontSize?: 'normal' | 'large' | 'xlarge';
  defaultSubFontPx?: number;
  tvTheme?: 'dark' | 'ambient';
  updatedAt?: number;
}

export function isAdminJekaProfile(
  profile?: Partial<SharedTvProfile> | null
): boolean {
  if (!profile) return false;
  return (
    profile.id === 'p1' ||
    String(profile.name || '')
      .trim()
      .toUpperCase() === 'JEKA'
  );
}

export function canProfileAccessAdult(
  profile?: Partial<SharedTvProfile> | null
): boolean {
  if (!profile || profile.isKids) return false;
  if (typeof profile.allowAdultContent === 'boolean') {
    return profile.allowAdultContent;
  }
  return isAdminJekaProfile(profile);
}

export function canProfileAccessIedem(
  profile?: Partial<SharedTvProfile> | null
): boolean {
  if (!profile || profile.isKids) return false;
  if (typeof profile.allowIedemContent === 'boolean') {
    return profile.allowIedemContent;
  }
  return isAdminJekaProfile(profile);
}

export type TvUserProfile = SharedTvProfile;

export interface PhotoAvatarPreset {
  id: string;
  label: string;
  emoji: string;
  bg: string;
  avatarUrl: string;
}

function makeNetflixKidsAvatarDataUri(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240">
    <defs>
      <linearGradient id="s1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#15803d"/><stop offset="100%" stop-color="#4ade80"/></linearGradient>
      <linearGradient id="s2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f59e0b"/><stop offset="100%" stop-color="#fde047"/></linearGradient>
      <linearGradient id="s3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ec4899"/><stop offset="100%" stop-color="#f472b6"/></linearGradient>
      <linearGradient id="s4" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ef4444"/><stop offset="100%" stop-color="#fb7185"/></linearGradient>
      <linearGradient id="s5" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#60a5fa"/><stop offset="100%" stop-color="#2563eb"/></linearGradient>
      <filter id="sh" x="-15%" y="-15%" width="130%" height="130%">
        <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000" flood-opacity="0.28"/>
      </filter>
    </defs>
    <rect x="0" y="0" width="48" height="240" fill="url(#s1)"/>
    <rect x="48" y="0" width="48" height="240" fill="url(#s2)"/>
    <rect x="96" y="0" width="48" height="240" fill="url(#s3)"/>
    <rect x="144" y="0" width="48" height="240" fill="url(#s4)"/>
    <rect x="192" y="0" width="48" height="240" fill="url(#s5)"/>
    <g filter="url(#sh)">
      <rect x="22" y="80" width="196" height="80" rx="40" fill="#ffffff"/>
      <text x="120" y="137" font-family="'Arial Rounded MT Bold', 'Nunito', 'Trebuchet MS', system-ui, sans-serif" font-size="68" font-weight="900" fill="#e50914" text-anchor="middle" letter-spacing="-2">kids</text>
    </g>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function makeNetflixCharacterAvatarDataUri(
  variant:
    | 'astronaut'
    | 'bunny'
    | 'popstar'
    | 'retro_purple'
    | 'classic_red'
    | 'classic_blue'
    | 'cyber_teal'
    | 'lion_gold'
    | 'wolf_night'
    | 'dj_cyan'
    | 'supercar_red'
    | 'panda_green'
    | 'cinema_amber'
    | 'fox_orange'
    | 'samurai_emerald'
): string {
  let inner = '';
  switch (variant) {
    case 'astronaut':
      inner = `
        <rect width="240" height="240" fill="#34d399"/>
        <circle cx="120" cy="110" r="95" fill="#10b981" opacity="0.55"/>
        <!-- Astronaut Suit Shoulders -->
        <path d="M32 240 C32 172 70 154 120 154 C170 154 208 172 208 240 Z" fill="#f4f4f5" stroke="#d4d4d8" stroke-width="4"/>
        <rect x="52" y="182" width="136" height="58" rx="16" fill="#e4e4e7"/>
        <rect x="78" y="198" width="52" height="24" rx="5" fill="#18181b"/>
        <text x="104" y="214" font-family="system-ui, sans-serif" font-size="12" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="1">VIP</text>
        <!-- Neck Ring -->
        <ellipse cx="120" cy="158" rx="46" ry="12" fill="#71717a"/>
        <!-- Ears -->
        <circle cx="58" cy="102" r="20" fill="#78350f"/>
        <circle cx="58" cy="102" r="12" fill="#d97706"/>
        <circle cx="182" cy="102" r="20" fill="#78350f"/>
        <circle cx="182" cy="102" r="12" fill="#d97706"/>
        <!-- Head -->
        <ellipse cx="120" cy="100" rx="56" ry="58" fill="#5c2808"/>
        <!-- Hair tuft -->
        <path d="M84 52 Q120 26 156 52 Q138 42 120 46 Q102 42 84 52 Z" fill="#3b1704"/>
        <!-- Face mask -->
        <ellipse cx="120" cy="108" rx="44" ry="38" fill="#d99b66"/>
        <ellipse cx="102" cy="94" rx="16" ry="15" fill="#d99b66"/>
        <ellipse cx="138" cy="94" rx="16" ry="15" fill="#d99b66"/>
        <!-- Eyes -->
        <circle cx="102" cy="94" r="6.5" fill="#18181b"/>
        <circle cx="104" cy="92" r="2" fill="#ffffff"/>
        <circle cx="138" cy="94" r="6.5" fill="#18181b"/>
        <circle cx="140" cy="92" r="2" fill="#ffffff"/>
        <!-- Brows -->
        <path d="M88 80 Q102 74 114 80" fill="none" stroke="#3b1704" stroke-width="4" stroke-linecap="round"/>
        <path d="M126 80 Q138 74 152 80" fill="none" stroke="#3b1704" stroke-width="4" stroke-linecap="round"/>
        <!-- Nose & Confident Smile -->
        <ellipse cx="120" cy="108" rx="8" ry="5" fill="#b47340"/>
        <path d="M100 126 Q120 135 140 124" fill="none" stroke="#451a03" stroke-width="4" stroke-linecap="round"/>
      `;
      break;
    case 'bunny':
      inner = `
        <rect width="240" height="240" fill="#facc15"/>
        <circle cx="120" cy="120" r="98" fill="#eab308" opacity="0.45"/>
        <!-- Pink Bunny Ears -->
        <ellipse cx="86" cy="48" rx="24" ry="52" transform="rotate(-10 86 48)" fill="#f472b6"/>
        <ellipse cx="154" cy="48" rx="24" ry="52" transform="rotate(10 154 48)" fill="#f472b6"/>
        <!-- Pink Hood -->
        <ellipse cx="120" cy="134" rx="74" ry="64" fill="#f472b6"/>
        <!-- White Flower on Hood -->
        <g transform="translate(64, 88)">
          <circle cx="0" cy="-12" r="10" fill="#ffffff"/>
          <circle cx="12" cy="-4" r="10" fill="#ffffff"/>
          <circle cx="7" cy="10" r="10" fill="#ffffff"/>
          <circle cx="-7" cy="10" r="10" fill="#ffffff"/>
          <circle cx="-12" cy="-4" r="10" fill="#ffffff"/>
          <circle cx="0" cy="0" r="8" fill="#facc15"/>
        </g>
        <!-- White Face -->
        <ellipse cx="120" cy="142" rx="52" ry="42" fill="#ffffff"/>
        <!-- Eyes -->
        <ellipse cx="96" cy="138" rx="7" ry="9" fill="#27272a"/>
        <circle cx="94" cy="135" r="2.5" fill="#ffffff"/>
        <ellipse cx="144" cy="138" rx="7" ry="9" fill="#27272a"/>
        <circle cx="142" cy="135" r="2.5" fill="#ffffff"/>
        <!-- Blush & Nose -->
        <ellipse cx="82" cy="148" rx="8" ry="4.5" fill="#fda4af"/>
        <ellipse cx="158" cy="148" rx="8" ry="4.5" fill="#fda4af"/>
        <ellipse cx="120" cy="144" rx="6" ry="4" fill="#facc15"/>
        <!-- Body -->
        <path d="M68 240 C68 196 172 196 172 240 Z" fill="#fbcfe8"/>
      `;
      break;
    case 'popstar':
      inner = `
        <rect width="240" height="240" fill="#10b981"/>
        <circle cx="120" cy="115" r="95" fill="#34d399" opacity="0.4"/>
        <!-- Shoulders -->
        <path d="M36 240 C42 178 82 166 120 166 C158 166 198 178 204 240 Z" fill="#ffffff"/>
        <!-- Long Blonde/Rose Gold Hair Back -->
        <path d="M52 96 C44 155 48 215 62 240 L178 240 C192 215 196 155 188 96 C182 48 154 34 120 34 C86 34 58 48 52 96 Z" fill="#f59e0b"/>
        <!-- Neck & Face -->
        <rect x="104" y="142" width="32" height="36" rx="12" fill="#fed7aa"/>
        <ellipse cx="120" cy="108" rx="44" ry="50" fill="#ffedd5"/>
        <!-- Hair Bangs -->
        <path d="M66 94 C72 52 104 42 124 44 C148 42 172 60 174 102 C160 76 142 66 122 64 C98 66 78 78 66 94 Z" fill="#fbbf24"/>
        <!-- Eyes & Lashes -->
        <ellipse cx="102" cy="108" rx="6" ry="4.5" fill="#1c1917"/>
        <circle cx="100" cy="107" r="1.8" fill="#ffffff"/>
        <ellipse cx="138" cy="108" rx="6" ry="4.5" fill="#1c1917"/>
        <circle cx="136" cy="107" r="1.8" fill="#ffffff"/>
        <path d="M92 98 Q102 93 112 98" fill="none" stroke="#92400e" stroke-width="3" stroke-linecap="round"/>
        <path d="M128 98 Q138 93 148 98" fill="none" stroke="#92400e" stroke-width="3" stroke-linecap="round"/>
        <!-- Lips -->
        <path d="M108 134 Q120 142 132 134 Q120 138 108 134 Z" fill="#f43f5e" stroke="#e11d48" stroke-width="3" stroke-linejoin="round"/>
      `;
      break;
    case 'retro_purple':
      inner = `
        <rect width="240" height="240" fill="#1e3a8a"/>
        <circle cx="120" cy="110" r="92" fill="#2563eb" opacity="0.45"/>
        <!-- Jacket & Collar -->
        <path d="M34 240 C42 178 78 164 120 164 C162 164 198 178 206 240 Z" fill="#1e293b"/>
        <path d="M88 164 L120 208 L152 164 Z" fill="#f8fafc"/>
        <!-- Neck & Face -->
        <rect x="104" y="140" width="32" height="36" rx="12" fill="#e2b897"/>
        <ellipse cx="120" cy="106" rx="45" ry="52" fill="#f1cfa8"/>
        <!-- Stylish Short Hair -->
        <path d="M68 98 C64 52 92 34 126 36 C158 38 178 60 172 102 C164 76 146 68 118 68 C94 68 78 80 68 98 Z" fill="#451a03"/>
        <!-- Eyes -->
        <circle cx="102" cy="106" r="5.5" fill="#1e293b"/>
        <circle cx="104" cy="104" r="1.8" fill="#ffffff"/>
        <circle cx="138" cy="106" r="5.5" fill="#1e293b"/>
        <circle cx="140" cy="104" r="1.8" fill="#ffffff"/>
        <path d="M90 94 Q102 89 114 93" fill="none" stroke="#451a03" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M126 93 Q138 89 150 94" fill="none" stroke="#451a03" stroke-width="3.5" stroke-linecap="round"/>
        <!-- Subtle Smile -->
        <path d="M108 134 Q120 140 132 133" fill="none" stroke="#7c2d12" stroke-width="3.5" stroke-linecap="round"/>
      `;
      break;
    case 'classic_red':
      inner = `
        <rect width="240" height="240" fill="#e50914"/>
        <rect width="240" height="240" fill="url(#rGrad)" opacity="0.4"/>
        <defs><radialGradient id="rGrad" cx="30%" cy="25%" r="75%"><stop offset="0%" stop-color="#ff6b6b"/><stop offset="100%" stop-color="#7f1d1d"/></radialGradient></defs>
        <circle cx="76" cy="92" r="14" fill="#ffffff"/>
        <circle cx="164" cy="92" r="14" fill="#ffffff"/>
        <path d="M64 148 Q126 192 180 140" fill="none" stroke="#ffffff" stroke-width="14" stroke-linecap="round"/>
      `;
      break;
    case 'classic_blue':
      inner = `
        <rect width="240" height="240" fill="#0284c7"/>
        <circle cx="76" cy="92" r="14" fill="#ffffff"/>
        <circle cx="164" cy="92" r="14" fill="#ffffff"/>
        <path d="M64 148 Q126 192 180 140" fill="none" stroke="#ffffff" stroke-width="14" stroke-linecap="round"/>
      `;
      break;
    case 'cyber_teal':
      inner = `
        <rect width="240" height="240" fill="#0d9488"/>
        <path d="M36 240 C44 176 80 162 120 162 C160 162 196 176 204 240 Z" fill="#0f172a"/>
        <ellipse cx="120" cy="104" rx="48" ry="54" fill="#fcd34d"/>
        <path d="M66 86 C70 42 170 42 174 86 Z" fill="#1e293b"/>
        <!-- Visor Sunglasses -->
        <rect x="68" y="84" width="104" height="28" rx="10" fill="#06b6d4" stroke="#ffffff" stroke-width="3"/>
        <path d="M78 90 L108 90 L96 106 L74 106 Z" fill="#67e8f9" opacity="0.6"/>
        <path d="M104 134 Q120 144 138 132" fill="none" stroke="#0f172a" stroke-width="4" stroke-linecap="round"/>
      `;
      break;
    case 'lion_gold':
      inner = `
        <rect width="240" height="240" fill="#d97706"/>
        <!-- Mane -->
        <circle cx="120" cy="122" r="78" fill="#78350f"/>
        <!-- Crown -->
        <path d="M82 54 L96 26 L120 46 L144 26 L158 54 Z" fill="#fde047" stroke="#ca8a04" stroke-width="3"/>
        <!-- Face -->
        <circle cx="120" cy="122" r="52" fill="#fbbf24"/>
        <circle cx="100" cy="110" r="6.5" fill="#1c1917"/>
        <circle cx="140" cy="110" r="6.5" fill="#1c1917"/>
        <polygon points="112,124 128,124 120,134" fill="#78350f"/>
        <path d="M104 142 Q120 152 136 142" fill="none" stroke="#78350f" stroke-width="4" stroke-linecap="round"/>
      `;
      break;
    case 'wolf_night':
      inner = `
        <rect width="240" height="240" fill="#1e293b"/>
        <circle cx="120" cy="120" r="92" fill="#0f172a" opacity="0.5"/>
        <!-- Ears -->
        <polygon points="64,92 80,36 108,76" fill="#64748b"/>
        <polygon points="176,92 160,36 132,76" fill="#64748b"/>
        <!-- Head -->
        <polygon points="120,56 178,116 154,186 86,186 62,116" fill="#94a3b8"/>
        <polygon points="120,116 154,186 86,186" fill="#e2e8f0"/>
        <!-- Glowing Cyan Eyes -->
        <polygon points="86,112 108,118 92,126" fill="#38bdf8"/>
        <polygon points="154,112 132,118 148,126" fill="#38bdf8"/>
        <polygon points="110,154 130,154 120,168" fill="#0f172a"/>
      `;
      break;
    case 'dj_cyan':
      inner = `
        <rect width="240" height="240" fill="#0891b2"/>
        <!-- Headphones Arch -->
        <path d="M52 120 A68 68 0 0 1 188 120" fill="none" stroke="#18181b" stroke-width="14"/>
        <rect x="38" y="102" width="24" height="48" rx="12" fill="#22d3ee" stroke="#18181b" stroke-width="5"/>
        <rect x="178" y="102" width="24" height="48" rx="12" fill="#22d3ee" stroke="#18181b" stroke-width="5"/>
        <circle cx="120" cy="124" r="52" fill="#fde047"/>
        <rect x="82" y="106" width="76" height="22" rx="11" fill="#18181b"/>
        <path d="M102 146 Q120 158 138 146" fill="none" stroke="#18181b" stroke-width="5" stroke-linecap="round"/>
      `;
      break;
    case 'supercar_red':
      inner = `
        <rect width="240" height="240" fill="#dc2626"/>
        <!-- Racing Helmet -->
        <circle cx="120" cy="120" r="66" fill="#ffffff" stroke="#18181b" stroke-width="6"/>
        <rect x="112" y="54" width="16" height="132" fill="#ef4444"/>
        <path d="M68 102 L172 102 L162 138 L78 138 Z" fill="#18181b"/>
        <path d="M78 108 L130 108 L120 130 L78 130 Z" fill="#38bdf8" opacity="0.65"/>
      `;
      break;
    case 'panda_green':
      inner = `
        <rect width="240" height="240" fill="#059669"/>
        <circle cx="72" cy="70" r="24" fill="#18181b"/>
        <circle cx="168" cy="70" r="24" fill="#18181b"/>
        <circle cx="120" cy="124" r="64" fill="#ffffff"/>
        <ellipse cx="94" cy="116" rx="16" ry="20" transform="rotate(-15 94 116)" fill="#18181b"/>
        <ellipse cx="146" cy="116" rx="16" ry="20" transform="rotate(15 146 116)" fill="#18181b"/>
        <circle cx="96" cy="114" r="5" fill="#ffffff"/>
        <circle cx="144" cy="114" r="5" fill="#ffffff"/>
        <ellipse cx="120" cy="138" rx="10" ry="7" fill="#18181b"/>
        <path d="M106 154 Q120 164 134 154" fill="none" stroke="#18181b" stroke-width="4" stroke-linecap="round"/>
      `;
      break;
    case 'cinema_amber':
      inner = `
        <rect width="240" height="240" fill="#e11d48"/>
        <circle cx="76" cy="92" r="14" fill="#fde047"/>
        <circle cx="164" cy="92" r="14" fill="#fde047"/>
        <path d="M64 148 Q126 192 180 140" fill="none" stroke="#fde047" stroke-width="14" stroke-linecap="round"/>
      `;
      break;
    case 'fox_orange':
      inner = `
        <rect width="240" height="240" fill="#ea580c"/>
        <polygon points="62,92 76,36 112,78" fill="#9a3412"/>
        <polygon points="178,92 164,36 128,78" fill="#9a3412"/>
        <polygon points="120,58 182,122 120,192 58,122" fill="#fb923c"/>
        <polygon points="120,126 168,142 120,192 72,142" fill="#ffffff"/>
        <circle cx="96" cy="118" r="6.5" fill="#18181b"/>
        <circle cx="144" cy="118" r="6.5" fill="#18181b"/>
        <circle cx="120" cy="176" r="9" fill="#18181b"/>
      `;
      break;
    case 'samurai_emerald':
      inner = `
        <rect width="240" height="240" fill="#10b981"/>
        <circle cx="76" cy="92" r="14" fill="#ffffff"/>
        <circle cx="164" cy="92" r="14" fill="#ffffff"/>
        <path d="M64 148 Q126 192 180 140" fill="none" stroke="#ffffff" stroke-width="14" stroke-linecap="round"/>
      `;
      break;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240">${inner}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const PHOTO_AVATAR_GALLERY: PhotoAvatarPreset[] = [
  {
    id: 'av_cinema',
    label: 'Astronaut VIP',
    emoji: 'VIP',
    bg: 'from-emerald-500 to-teal-800',
    avatarUrl: makeNetflixCharacterAvatarDataUri('astronaut'),
  },
  {
    id: 'av_king',
    label: 'Kawaii Bunny',
    emoji: 'GL',
    bg: 'from-amber-400 to-yellow-600',
    avatarUrl: makeNetflixCharacterAvatarDataUri('bunny'),
  },
  {
    id: 'av_queen',
    label: 'Pop Star',
    emoji: 'SQ',
    bg: 'from-emerald-400 to-teal-700',
    avatarUrl: makeNetflixCharacterAvatarDataUri('popstar'),
  },
  {
    id: 'av_wolf',
    label: 'Classic Blue',
    emoji: 'NW',
    bg: 'from-blue-600 to-blue-900',
    avatarUrl: makeNetflixCharacterAvatarDataUri('retro_purple'),
  },
  {
    id: 'av_kids',
    label: 'Kids Rainbow',
    emoji: 'JR',
    bg: 'from-lime-500 via-pink-500 to-blue-500',
    avatarUrl: makeNetflixKidsAvatarDataUri(),
  },
  {
    id: 'av_racer',
    label: 'Netflix Red Smile',
    emoji: 'GT',
    bg: 'from-red-600 to-rose-900',
    avatarUrl: makeNetflixCharacterAvatarDataUri('classic_red'),
  },
  {
    id: 'av_astro',
    label: 'Netflix Blue Smile',
    emoji: 'EX',
    bg: 'from-sky-500 to-blue-900',
    avatarUrl: makeNetflixCharacterAvatarDataUri('classic_blue'),
  },
  {
    id: 'av_cyber',
    label: 'Cyber Visor',
    emoji: 'PR',
    bg: 'from-teal-500 to-emerald-900',
    avatarUrl: makeNetflixCharacterAvatarDataUri('cyber_teal'),
  },
  {
    id: 'av_popcorn',
    label: 'Golden Lion',
    emoji: 'FM',
    bg: 'from-amber-500 to-orange-800',
    avatarUrl: makeNetflixCharacterAvatarDataUri('lion_gold'),
  },
  {
    id: 'av_eagle',
    label: 'Night Wolf',
    emoji: 'FL',
    bg: 'from-slate-600 to-zinc-900',
    avatarUrl: makeNetflixCharacterAvatarDataUri('wolf_night'),
  },
  {
    id: 'av_music',
    label: 'Live DJ',
    emoji: 'DJ',
    bg: 'from-cyan-500 to-sky-800',
    avatarUrl: makeNetflixCharacterAvatarDataUri('dj_cyan'),
  },
  {
    id: 'av_panda',
    label: 'Panda',
    emoji: 'LG',
    bg: 'from-emerald-600 to-zinc-900',
    avatarUrl: makeNetflixCharacterAvatarDataUri('panda_green'),
  },
  {
    id: 'av_cat',
    label: 'Racer Helmet',
    emoji: 'ST',
    bg: 'from-red-500 to-rose-800',
    avatarUrl: makeNetflixCharacterAvatarDataUri('supercar_red'),
  },
  {
    id: 'av_fox',
    label: 'Clever Fox',
    emoji: 'PM',
    bg: 'from-orange-500 to-amber-900',
    avatarUrl: makeNetflixCharacterAvatarDataUri('fox_orange'),
  },
  {
    id: 'av_detective',
    label: 'Crimson Smile',
    emoji: '4K',
    bg: 'from-rose-600 to-red-950',
    avatarUrl: makeNetflixCharacterAvatarDataUri('cinema_amber'),
  },
  {
    id: 'av_samurai',
    label: 'Emerald Smile',
    emoji: 'DR',
    bg: 'from-emerald-500 to-teal-900',
    avatarUrl: makeNetflixCharacterAvatarDataUri('samurai_emerald'),
  },
];

export const DEFAULT_SHARED_PROFILES: SharedTvProfile[] = [
  {
    id: 'p1',
    name: 'JEKA',
    avatarEmoji: 'E',
    avatarUrl: PHOTO_AVATAR_GALLERY[0].avatarUrl,
    avatarBg: 'from-emerald-500 to-teal-700',
    pin: '1155',
    isKids: false,
    allowAdultContent: true,
    allowIedemContent: true,
    uiLang: 'ro',
  },
  {
    id: 'acc_1793971115106',
    name: 'Emma',
    avatarEmoji: 'DJ',
    avatarUrl: PHOTO_AVATAR_GALLERY[10].avatarUrl,
    avatarBg: 'from-cyan-500 to-sky-800',
    pin: '1212',
    isKids: false,
    allowAdultContent: false,
    allowIedemContent: false,
    uiLang: 'ro',
    updatedAt: 1793971138770,
  },
  {
    id: 'p2',
    name: 'Family',
    avatarEmoji: 'F',
    avatarUrl: PHOTO_AVATAR_GALLERY[1].avatarUrl,
    avatarBg: 'from-amber-500 to-orange-700',
    isKids: false,
    allowAdultContent: false,
    allowIedemContent: false,
    uiLang: 'en',
  },
  {
    id: 'p3',
    name: 'Guest',
    avatarEmoji: 'G',
    avatarUrl: PHOTO_AVATAR_GALLERY[2].avatarUrl,
    avatarBg: 'from-sky-500 to-blue-700',
    isKids: false,
    allowAdultContent: false,
    allowIedemContent: false,
    uiLang: 'en',
  },
  {
    id: 'p4',
    name: 'Kids',
    avatarEmoji: 'K',
    avatarUrl: PHOTO_AVATAR_GALLERY[4].avatarUrl,
    avatarBg: 'from-lime-500 to-emerald-700',
    isKids: true,
    allowAdultContent: false,
    allowIedemContent: false,
    uiLang: 'ro',
  },
];

export const TV_PROFILES_STORAGE_KEY = 'aether_smart_tv_profiles_v1';
export const ACTIVE_TV_PROFILE_STORAGE_KEY = 'aether_smart_tv_active_profile_v1';
export const REMEMBERED_PROFILES_STORAGE_KEY = 'aether_remembered_accounts_v1';
export const DELETED_PROFILES_STORAGE_KEY = 'aether_deleted_profile_ids_v1';
export const CURRENT_DEVICE_ID_STORAGE_KEY = 'aether_device_instance_id_v1';

export function loadDeletedProfileIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_PROFILES_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((x) => typeof x === 'string'));
    }
  } catch {
    // ignore
  }
  return new Set();
}

export function markProfileDeleted(profileId: string): void {
  if (!profileId || profileId === 'p1') return;
  try {
    const set = loadDeletedProfileIds();
    set.add(profileId);
    localStorage.setItem(
      DELETED_PROFILES_STORAGE_KEY,
      JSON.stringify(Array.from(set))
    );
  } catch {
    // ignore
  }
}

export function unmarkProfileDeleted(profileId: string): void {
  if (!profileId) return;
  try {
    const set = loadDeletedProfileIds();
    if (set.delete(profileId)) {
      localStorage.setItem(
        DELETED_PROFILES_STORAGE_KEY,
        JSON.stringify(Array.from(set))
      );
    }
  } catch {
    // ignore
  }
}

export function getOrCreateCurrentDeviceId(): string {
  if (typeof window === 'undefined') return 'dev_server';
  try {
    let id = localStorage.getItem(CURRENT_DEVICE_ID_STORAGE_KEY);
    if (!id) {
      id = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      localStorage.setItem(CURRENT_DEVICE_ID_STORAGE_KEY, id);
    }
    return id;
  } catch {
    return 'dev_local';
  }
}

export function detectCurrentDeviceName(): string {
  if (typeof navigator === 'undefined') return 'Dispozitiv';
  const ua = navigator.userAgent || '';
  if (/Web0S|WebOS|NetCast|SmartTV|Tizen|Large Screen|MSX|BRAVIA|AFT/i.test(ua)) {
    return 'Smart TV';
  }
  if (
    /iPad/i.test(ua) ||
    (/Macintosh/i.test(ua) && navigator.maxTouchPoints && navigator.maxTouchPoints > 1)
  ) {
    return 'iPad';
  }
  if (/iPhone|iPod/i.test(ua)) {
    return 'iPhone';
  }
  if (/Android/i.test(ua)) {
    return /Mobile/i.test(ua) ? 'Telefon Android' : 'Tabletă Android';
  }
  if (/Macintosh|Mac OS X/i.test(ua)) {
    return 'Mac / Laptop';
  }
  if (/Windows|Linux/i.test(ua)) {
    return 'Laptop / PC';
  }
  return 'Dispozitiv Web';
}

export function normalizeProfile(p: Partial<SharedTvProfile>, idx = 0): SharedTvProfile {
  const cleanName = (p.name || 'Utilizator').trim();
  const isKidsProf =
    Boolean(p.isKids) || cleanName.toLowerCase() === 'kids';
  const kidsPreset =
    PHOTO_AVATAR_GALLERY.find((g) => g.id === 'av_kids') ||
    PHOTO_AVATAR_GALLERY[4];
  const fallbackPreset = isKidsProf
    ? kidsPreset
    : PHOTO_AVATAR_GALLERY[idx % PHOTO_AVATAR_GALLERY.length];
  const cleanInitial = cleanName.slice(0, 1).toUpperCase() || 'U';
  const rawEmoji = (p.avatarEmoji || p.avatar || '').replace(/[^\w\d]/g, '').toUpperCase();
  const matchedPreset = isKidsProf
    ? kidsPreset
    : PHOTO_AVATAR_GALLERY.find((g) => g.emoji === rawEmoji) || fallbackPreset;
  // Upgrade any old monogram SVG data URI (with CINEMA VIP / GOLD VIP / font-size="44") to Netflix character avatars
  const hasOldMonogramSvg =
    typeof p.avatarUrl === 'string' &&
    p.avatarUrl.startsWith('data:image/svg+xml') &&
    (p.avatarUrl.includes('font-size%3D%2244%22') ||
      p.avatarUrl.includes('dominant-baseline%3D%22middle%22'));
  return {
    id: p.id || `p_${Date.now()}_${idx}`,
    name: cleanName,
    avatarEmoji: rawEmoji || cleanInitial,
    avatarUrl:
      !p.avatarUrl || hasOldMonogramSvg
        ? matchedPreset.avatarUrl
        : isKidsProf && p.avatarUrl.startsWith('data:image/svg+xml')
          ? kidsPreset.avatarUrl
          : p.avatarUrl,
    avatarBg: p.avatarBg || matchedPreset.bg,
    pin: p.pin
      ? String(p.pin).trim()
      : p.id === 'p1' && p.pin === undefined
        ? '1155'
        : undefined,
    isKids: isKidsProf,
    allowAdultContent: isKidsProf
      ? false
      : typeof p.allowAdultContent === 'boolean'
        ? p.allowAdultContent
        : isAdminJekaProfile(p),
    allowIedemContent: isKidsProf
      ? false
      : typeof p.allowIedemContent === 'boolean'
        ? p.allowIedemContent
        : isAdminJekaProfile(p),
    uiLang: p.uiLang || 'ro',
    defaultAudioPref: p.defaultAudioPref,
    defaultSubLang: p.defaultSubLang,
    defaultSubFontSize: p.defaultSubFontSize,
    defaultSubFontPx:
      typeof p.defaultSubFontPx === 'number' &&
      Number.isFinite(p.defaultSubFontPx)
        ? Math.max(14, Math.min(48, Math.round(p.defaultSubFontPx)))
        : undefined,
    tvTheme:
      p.tvTheme === 'ambient'
        ? 'ambient'
        : p.tvTheme === 'dark'
          ? 'dark'
          : undefined,
    updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : undefined,
  };
}

/**
 * Detects whether the app is running on the user's Local Home Server (localhost / LAN 192.168.x.x)
 * vs. a public Cloud host (Netlify, Cloudflare Pages, etc.).
 * Option B: On Cloud hosts, local-only API polling and heavy stream proxying are automatically skipped
 * so Netlify bandwidth & function invocations stay at 0 (100% Free).
 */
export function isLocalHomeServer(): boolean {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname.toLowerCase();
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '0.0.0.0' ||
    h.startsWith('192.168.') ||
    h.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(h) ||
    h.endsWith('.local')
  );
}

export function loadSharedProfiles(): SharedTvProfile[] {
  try {
    const raw = localStorage.getItem(TV_PROFILES_STORAGE_KEY);
    if (!raw) return DEFAULT_SHARED_PROFILES;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const deletedIds = loadDeletedProfileIds();
      const filtered = parsed.filter(
        (p) => p && typeof p.id === 'string' && !deletedIds.has(p.id)
      );
      if (filtered.length === 0) return DEFAULT_SHARED_PROFILES;
      const normalized = filtered.map((p, idx) => {
        // Auto-upgrade legacy un-pinned p1 default "Eugeniu" profile to JEKA (PIN 1155) without losing custom profiles
        if (idx === 0 && p.id === 'p1' && p.name === 'Eugeniu' && !p.pin) {
          return normalizeProfile(DEFAULT_SHARED_PROFILES[0], 0);
        }
        return normalizeProfile(p, idx);
      });
      // Always ensure Emma is present if not explicitly deleted
      const hasEmma = normalized.some(
        (p) =>
          p.id === 'acc_1793971115106' ||
          p.name.trim().toLowerCase() === 'emma'
      );
      if (!hasEmma && !deletedIds.has('acc_1793971115106')) {
        normalized.splice(1, 0, normalizeProfile(DEFAULT_SHARED_PROFILES[1], 1));
      } else {
        // Place Emma right after JEKA so both primary profiles are always first
        const emmaIdx = normalized.findIndex(
          (p) =>
            p.id === 'acc_1793971115106' ||
            p.name.trim().toLowerCase() === 'emma'
        );
        if (emmaIdx > 1) {
          const [emmaProf] = normalized.splice(emmaIdx, 1);
          normalized.splice(1, 0, emmaProf);
        }
      }
      return normalized;
    }
    return DEFAULT_SHARED_PROFILES;
  } catch {
    return DEFAULT_SHARED_PROFILES;
  }
}

export function mergeSharedProfiles(
  localProfiles: SharedTvProfile[],
  remoteProfiles: SharedTvProfile[]
): SharedTvProfile[] {
  const deletedIds = loadDeletedProfileIds();
  const byId = new Map<string, SharedTvProfile>();

  const addOrMerge = (p: Partial<SharedTvProfile>, idx: number, isLocal: boolean) => {
    const norm = normalizeProfile(p, idx);
    if (!norm.id || deletedIds.has(norm.id)) return;
    if (norm.id === 'p1' && norm.name === 'Eugeniu' && !norm.pin) {
      return;
    }
    const existing = byId.get(norm.id);
    if (!existing) {
      byId.set(norm.id, norm);
      return;
    }
    const existingTs = existing.updatedAt || 0;
    const incomingTs = norm.updatedAt || 0;
    if (incomingTs > existingTs || (isLocal && incomingTs >= existingTs)) {
      byId.set(norm.id, {
        ...existing,
        ...norm,
        defaultAudioPref: norm.defaultAudioPref || existing.defaultAudioPref,
        defaultSubLang: norm.defaultSubLang || existing.defaultSubLang,
        defaultSubFontSize:
          norm.defaultSubFontSize || existing.defaultSubFontSize,
        defaultSubFontPx: norm.defaultSubFontPx || existing.defaultSubFontPx,
        tvTheme: norm.tvTheme || existing.tvTheme,
        updatedAt: Math.max(existingTs, incomingTs) || undefined,
      });
    } else {
      byId.set(norm.id, {
        ...norm,
        ...existing,
        defaultAudioPref: existing.defaultAudioPref || norm.defaultAudioPref,
        defaultSubLang: existing.defaultSubLang || norm.defaultSubLang,
        defaultSubFontSize:
          existing.defaultSubFontSize || norm.defaultSubFontSize,
        defaultSubFontPx: existing.defaultSubFontPx || norm.defaultSubFontPx,
        tvTheme: existing.tvTheme || norm.tvTheme,
        updatedAt: Math.max(existingTs, incomingTs) || undefined,
      });
    }
  };

  remoteProfiles.forEach((p, idx) => addOrMerge(p, idx, false));
  localProfiles.forEach((p, idx) => addOrMerge(p, idx, true));

  const merged = Array.from(byId.values());
  if (merged.length === 0) return DEFAULT_SHARED_PROFILES;
  const emmaIdx = merged.findIndex(
    (p) =>
      p.id === 'acc_1793971115106' || p.name.trim().toLowerCase() === 'emma'
  );
  if (emmaIdx > 1) {
    const [emmaProf] = merged.splice(emmaIdx, 1);
    merged.splice(1, 0, emmaProf);
  }
  return merged;
}

export function saveSharedProfiles(
  profiles: SharedTvProfile[],
  options?: { allowShrink?: boolean }
): void {
  const deletedIds = loadDeletedProfileIds();
  let finalProfiles = profiles
    .filter((p) => p && !deletedIds.has(p.id))
    .map((p, idx) => normalizeProfile(p, idx));

  if (!options?.allowShrink) {
    try {
      const existingLocal = loadSharedProfiles();
      finalProfiles = mergeSharedProfiles(finalProfiles, existingLocal);
    } catch {
      // ignore
    }
  }

  try {
    localStorage.setItem(TV_PROFILES_STORAGE_KEY, JSON.stringify(finalProfiles));
  } catch {
    // ignore
  }
  try {
    fetch('/api/tv-profiles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Deleted-Profile-Ids': JSON.stringify(Array.from(deletedIds)),
      },
      body: JSON.stringify(finalProfiles),
    }).catch(() => {});
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('aether:profiles-updated', { detail: finalProfiles })
    );
  }
}

export async function syncSharedProfilesFromServer(): Promise<SharedTvProfile[]> {
  const local = loadSharedProfiles();
  try {
    const res = await fetch('/api/tv-profiles');
    if (!res.ok) return local;
    const remote = await res.json();
    if (!Array.isArray(remote) || remote.length === 0) return local;
    const merged = mergeSharedProfiles(local, remote);
    try {
      localStorage.setItem(TV_PROFILES_STORAGE_KEY, JSON.stringify(merged));
    } catch {
      // ignore
    }
    // If local had custom or newer profiles missing on the server, push merged back to server
    const remoteIds = new Set(remote.map((r: SharedTvProfile) => r?.id));
    const hasUnsyncedLocal = merged.some((m) => !remoteIds.has(m.id));
    if (hasUnsyncedLocal) {
      fetch('/api/tv-profiles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Deleted-Profile-Ids': JSON.stringify(
            Array.from(loadDeletedProfileIds())
          ),
        },
        body: JSON.stringify(merged),
      }).catch(() => {});
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('aether:profiles-updated', { detail: merged })
      );
    }
    return merged;
  } catch {
    return local;
  }
}

export function loadSharedActiveProfileId(): string {
  try {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlProfile = params.get('profile');
      if (urlProfile && /^[a-zA-Z0-9_-]+$/.test(urlProfile)) {
        localStorage.setItem(ACTIVE_TV_PROFILE_STORAGE_KEY, urlProfile);
        return urlProfile;
      }
    }
    return localStorage.getItem(ACTIVE_TV_PROFILE_STORAGE_KEY) || 'p1';
  } catch {
    return 'p1';
  }
}

export function saveSharedActiveProfileId(profileId: string): void {
  try {
    localStorage.setItem(ACTIVE_TV_PROFILE_STORAGE_KEY, profileId);
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('aether:active-profile-changed', { detail: profileId })
    );
  }
}

/**
 * Checks if a PIN-protected profile has already been unlocked & remembered on this device.
 * Once the user enters the PIN the first time on TV, iPad, or Laptop, it remembers it automatically!
 */
export const SESSION_PROFILE_PICKED_KEY = 'filmio_session_profile_picked_v2';

export function isProfileRememberedOnDevice(profile: SharedTvProfile): boolean {
  try {
    const expectedPin = (profile.pin || '').trim();
    const pickedId = sessionStorage.getItem(SESSION_PROFILE_PICKED_KEY);
    if (pickedId === profile.id) {
      if (!expectedPin) return true;
      const sessionVerified = sessionStorage.getItem(
        `smartcinema_pin_verified_${profile.id}`
      );
      if (sessionVerified === expectedPin) return true;
    }

    // Also honor persistent localStorage remember-state across page refreshes (F5 / Cmd+R)
    const activeId = localStorage.getItem(ACTIVE_TV_PROFILE_STORAGE_KEY);
    const rawRemembered = localStorage.getItem(REMEMBERED_PROFILES_STORAGE_KEY);
    if (activeId === profile.id && rawRemembered) {
      const map: Record<string, string> = JSON.parse(rawRemembered);
      const savedToken = map[profile.id];
      if (savedToken) {
        if (!expectedPin && savedToken === 'unlocked') {
          sessionStorage.setItem(SESSION_PROFILE_PICKED_KEY, profile.id);
          return true;
        }
        if (expectedPin && savedToken === expectedPin) {
          sessionStorage.setItem(SESSION_PROFILE_PICKED_KEY, profile.id);
          sessionStorage.setItem(
            `smartcinema_pin_verified_${profile.id}`,
            expectedPin
          );
          return true;
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}

export function rememberProfileOnDevice(profile: SharedTvProfile): void {
  try {
    const raw = localStorage.getItem(REMEMBERED_PROFILES_STORAGE_KEY);
    const map: Record<string, string> = raw ? JSON.parse(raw) : {};
    map[profile.id] = (profile.pin || '').trim() || 'unlocked';
    localStorage.setItem(REMEMBERED_PROFILES_STORAGE_KEY, JSON.stringify(map));
    sessionStorage.setItem(SESSION_PROFILE_PICKED_KEY, profile.id);
    if (profile.pin && profile.pin.trim()) {
      sessionStorage.setItem(
        `smartcinema_pin_verified_${profile.id}`,
        profile.pin.trim()
      );
    }
  } catch {
    // ignore
  }
}

export function forgetProfileOnDevice(profileId: string): void {
  try {
    sessionStorage.removeItem(SESSION_PROFILE_PICKED_KEY);
    sessionStorage.removeItem(`smartcinema_pin_verified_${profileId}`);
    const raw = localStorage.getItem(REMEMBERED_PROFILES_STORAGE_KEY);
    if (!raw) return;
    const map: Record<string, string> = JSON.parse(raw);
    delete map[profileId];
    localStorage.setItem(REMEMBERED_PROFILES_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

/**
 * Compresses any user-uploaded photo (from iPad/iPhone/Laptop camera or gallery)
 * into a crisp 220x220 square JPEG Data URL (~18KB) so it syncs across Smart TV, iPad & Laptop.
 */
export function compressUploadedAvatarImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Nu am putut citi imaginea'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Format imagine invalid'));
      img.onload = () => {
        try {
          const size = 220;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(String(reader.result));
            return;
          }
          const minSide = Math.min(img.width, img.height);
          const sx = Math.max(0, (img.width - minSide) / 2);
          const sy = Math.max(0, (img.height - minSide) / 2);
          ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.84);
          resolve(dataUrl);
        } catch (e) {
          reject(e);
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

let cachedLanOrigin: string | null = null;

export async function getLanServerOrigin(): Promise<string> {
  if (cachedLanOrigin) return cachedLanOrigin;
  if (isLocalHomeServer()) {
    try {
      const res = await fetch('/api/lan-info');
      if (res.ok) {
        const data = (await res.json()) as { lanOrigin?: string };
        if (data.lanOrigin) {
          cachedLanOrigin = data.lanOrigin;
          return data.lanOrigin;
        }
      }
    } catch {
      // ignore
    }
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://192.168.1.245:8769';
}

export interface ProfileMediaPreferences {
  defaultAudioPref: 'original' | 'ro' | 'ru' | 'uk' | 'first';
  defaultSubLang: 'ro' | 'ru' | 'en' | 'es' | 'fr' | 'de' | 'off';
  defaultSubFontSize: 'normal' | 'large' | 'xlarge';
  defaultSubFontPx: number;
  tvTheme?: 'dark' | 'ambient';
}

const PROFILE_SETTINGS_BASE_KEY = 'aether_smart_tv_settings_v2';

function getProfileSettingsKey(profileId: string): string {
  return !profileId || profileId === 'p1'
    ? PROFILE_SETTINGS_BASE_KEY
    : `${PROFILE_SETTINGS_BASE_KEY}_${profileId}`;
}

export function getActiveProfileMediaPrefs(
  explicitProfileId?: string
): ProfileMediaPreferences {
  const profileId = explicitProfileId || loadSharedActiveProfileId() || 'p1';
  const profiles = loadSharedProfiles();
  const prof = profiles.find((p) => p.id === profileId) || profiles[0];

  let settingsParsed: Record<string, unknown> = {};
  try {
    const raw = localStorage.getItem(getProfileSettingsKey(profileId));
    if (raw) {
      settingsParsed = JSON.parse(raw) || {};
    }
  } catch {
    // ignore
  }

  const audioPref = (prof?.defaultAudioPref ||
    settingsParsed.defaultAudioPref ||
    'original') as ProfileMediaPreferences['defaultAudioPref'];

  const subLang = (prof?.defaultSubLang ||
    settingsParsed.defaultSubLang ||
    'ro') as ProfileMediaPreferences['defaultSubLang'];

  const subFontSize = (prof?.defaultSubFontSize ||
    settingsParsed.defaultSubFontSize ||
    'large') as ProfileMediaPreferences['defaultSubFontSize'];

  let subFontPx =
    typeof prof?.defaultSubFontPx === 'number'
      ? prof.defaultSubFontPx
      : typeof settingsParsed.defaultSubFontPx === 'number'
        ? (settingsParsed.defaultSubFontPx as number)
        : 0;

  if (!subFontPx || !Number.isFinite(subFontPx)) {
    try {
      const legacyPx = Number(
        localStorage.getItem(`aether_tv_sub_font_px_${profileId}`) ||
          localStorage.getItem('aether_tv_sub_font_px')
      );
      if (Number.isFinite(legacyPx) && legacyPx >= 14 && legacyPx <= 48) {
        subFontPx = legacyPx;
      }
    } catch {
      // ignore
    }
  }

  if (!subFontPx || !Number.isFinite(subFontPx)) {
    subFontPx =
      subFontSize === 'xlarge' ? 32 : subFontSize === 'normal' ? 20 : 26;
  }

  let explicitTheme: string | null = null;
  try {
    explicitTheme = localStorage.getItem(`aether_tv_theme_${profileId}`);
  } catch {
    // ignore
  }
  const resolvedTheme: 'dark' | 'ambient' =
    explicitTheme === 'ambient' || explicitTheme === 'dark'
      ? explicitTheme
      : settingsParsed.tvTheme === 'ambient' || settingsParsed.tvTheme === 'dark'
        ? (settingsParsed.tvTheme as 'dark' | 'ambient')
        : prof?.tvTheme === 'ambient' || prof?.tvTheme === 'dark'
          ? prof.tvTheme
          : 'dark';

  return {
    defaultAudioPref: audioPref,
    defaultSubLang: subLang,
    defaultSubFontSize: subFontSize,
    defaultSubFontPx: Math.max(14, Math.min(48, Math.round(subFontPx))),
    tvTheme: resolvedTheme,
  };
}

export function saveActiveProfileMediaPrefs(
  partial: Partial<ProfileMediaPreferences>,
  explicitProfileId?: string
): ProfileMediaPreferences {
  const profileId = explicitProfileId || loadSharedActiveProfileId() || 'p1';
  const current = getActiveProfileMediaPrefs(profileId);
  const next: ProfileMediaPreferences = {
    ...current,
    ...partial,
  };

  if (typeof partial.defaultSubFontPx === 'number') {
    const px = Math.max(14, Math.min(48, Math.round(partial.defaultSubFontPx)));
    next.defaultSubFontPx = px;
    if (!partial.defaultSubFontSize) {
      next.defaultSubFontSize =
        px >= 30 ? 'xlarge' : px >= 23 ? 'large' : 'normal';
    }
  } else if (partial.defaultSubFontSize && !partial.defaultSubFontPx) {
    next.defaultSubFontPx =
      partial.defaultSubFontSize === 'xlarge'
        ? 32
        : partial.defaultSubFontSize === 'normal'
          ? 20
          : 26;
  }

  // 1. Save into per-profile SmartTvSettings in localStorage
  try {
    const settingsKey = getProfileSettingsKey(profileId);
    const raw = localStorage.getItem(settingsKey);
    const parsed = raw ? JSON.parse(raw) : {};
    const resolvedTheme =
      next.tvTheme === 'ambient' || next.tvTheme === 'dark'
        ? next.tvTheme
        : parsed.tvTheme === 'ambient'
          ? 'ambient'
          : 'dark';
    next.tvTheme = resolvedTheme;
    const updatedSettings = {
      ...parsed,
      defaultAudioPref: next.defaultAudioPref,
      defaultSubLang: next.defaultSubLang,
      defaultSubFontSize: next.defaultSubFontSize,
      defaultSubFontPx: next.defaultSubFontPx,
      tvTheme: resolvedTheme,
    };
    localStorage.setItem(settingsKey, JSON.stringify(updatedSettings));
    localStorage.setItem(`aether_tv_theme_${profileId}`, resolvedTheme);
    localStorage.setItem(
      `aether_tv_sub_font_px_${profileId}`,
      String(next.defaultSubFontPx)
    );
    localStorage.setItem(
      'aether_tv_sub_font_px',
      String(next.defaultSubFontPx)
    );
    localStorage.setItem('aether_tv_sub_font_size', next.defaultSubFontSize);
  } catch {
    // ignore
  }

  // 2. Save directly onto the active SharedTvProfile object & sync to /api/tv-profiles
  try {
    const profiles = loadSharedProfiles();
    const updatedProfiles = profiles.map((p) =>
      p.id === profileId
        ? {
            ...p,
            defaultAudioPref: next.defaultAudioPref,
            defaultSubLang: next.defaultSubLang,
            defaultSubFontSize: next.defaultSubFontSize,
            defaultSubFontPx: next.defaultSubFontPx,
            tvTheme: next.tvTheme || p.tvTheme || 'dark',
            updatedAt: Date.now(),
          }
        : p
    );
    saveSharedProfiles(updatedProfiles);
  } catch {
    // ignore
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('aether:profile-media-prefs-changed', {
        detail: { profileId, prefs: next },
      })
    );
  }

  return next;
}
