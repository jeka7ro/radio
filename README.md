# AetherRadio — Radio Online Global (PWA)

Aplicație web modernă și responsivă (**mobile-first**) pentru ascultarea posturilor de radio live din toată lumea, organizate pe țări și genuri muzicale. Construită cu **React**, **TypeScript**, **Vite**, **Tailwind CSS**, **Zustand** și **hls.js**, folosind API-ul comunitar deschis **Radio Browser**.

---

## Funcționalități Principale

1. **Selector de Țară cu Detectare Automată**:
   - La prima deschidere, țara este detectată automat din fusul orar (`Intl.DateTimeFormat`) și limba browserului (`navigator.languages`), fiind salvată în `localStorage`.
   - Listă completă cu toate țările lumii (steag, nume localizat în RO/EN, cod ISO și număr de posturi), cu căutare rapidă atât din modalul global, cât și din pagina dedicată **Țări**.
2. **Listă de Posturi per Țară**:
   - Carduri cu logo pătrat și **fallback automat cu inițiale colorate** (contrast WCAG AA) când imaginea lipsește sau nu se încarcă.
   - Filtrare după gen muzical / tag-uri populare și căutare instantanee după nume.
   - Sortare după **Popularitate (Voturi)**, **În tendințe (Click-uri)**, **Calitate audio (Bitrate)** sau **Alfabetic (A–Z)**.
   - **Infinite Scroll** cu `IntersectionObserver` + buton accesibil de la tastatură („Încarcă mai multe posturi”).
3. **Player Audio Global Persistent**:
   - Redare continuă la navigarea între secțiuni, bazată pe **HTML5 Audio** și **hls.js** pentru stream-uri HLS (`.m3u8`).
   - Afișare stare (`loading`, `playing`, `paused`, `error`) și metadate live / ICY când sunt disponibile.
   - **Auto-retry** (cu încercare automată a variantei `https://` pentru stream-urile `http://`) și bară de recuperare în caz de eroare cu buton **„Încearcă alt post”**.
   - **Mini-player** fix jos + **Player Extins** (`<dialog closedby="any">`) pe mobil și desktop.
   - Integrare completă cu **Media Session API** (controale pe lock screen, notificări OS și butoanele căștilor).
4. **Favorite & Istoric**:
   - Salvare posturi favorite cu buton inimă, persistate în `localStorage`.
   - **Reordonare** prin Drag & Drop sau butoane accesibile Sus/Jos.
   - **Export și Import JSON** pentru backup-ul listei de favorite.
   - Secțiune **„Ascultate recent”** (ultimele 20 de posturi).
5. **Internaționalizare (RO / EN) & Temă (System / Dark / Light)**:
   - Interfață complet tradusă în **Română** și **Engleză**, extensibilă în `src/i18n/translations.ts`.
   - Temă adaptivă după sistem (`light-dark()` + `<meta name="color-scheme">`), fără FOUC la încărcare.
6. **PWA Instalabilă**:
   - Include `manifest.webmanifest`, iconițe vectoriale scalabile și Service Worker (`sw.js`) pentru instalare pe telefon (Android / iOS) și desktop.

---

## Cerințe & Rulare Locală

- **Node.js** `>= 18.0.0`
- **npm** `>= 9.0.0`

```bash
# 1. Instalează dependențele
npm install

# 2. Pornește serverul de dezvoltare (Vite)
npm run dev

# 3. Construiește versiunea de producție
npm run build

# 4. Previzualizează build-ul de producție local
npm run preview
```

Nu este necesară nicio cheie API (`.env`). Aplicația se conectează direct la serverele publice `api.radio-browser.info` cu **fallback automat** între `de1`, `all`, `de2`, `nl1` și `at1` și păstrează răspunsurile în cache timp de **1 oră (TTL)**.

---

## Instrucțiuni de Deploy

### Opțiunea 1: Deploy pe Vercel

1. Încarcă proiectul într-un repository Git (GitHub / GitLab / Bitbucket) sau folosește Vercel CLI:
   ```bash
   npx vercel
   ```
2. Setări de proiect în Vercel Dashboard (detectate automat pentru Vite):
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
3. Apasă **Deploy**. Certificatul HTTPS este configurat automat, activând Service Worker-ul și instalarea PWA.

### Opțiunea 2: Deploy pe Netlify

1. Conectează repository-ul în Netlify sau rulează din terminal:
   ```bash
   npx netlify-cli deploy --prod --dir=dist
   ```
2. Setări de build în Netlify:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
3. Aplicația fiind SPA cu stare gestionată în client, toate rutele sunt servite direct prin `index.html`.

---

## Structura Codului

- `src/components/` — Componente UI modulare (`layout/`, `player/`, `stations/`, `countries/`, `common/`)
- `src/views/` — Paginile principale (`HomeView`, `CountriesView`, `FavoritesView`, `SettingsView`)
- `src/hooks/` — Hook-uri custom (`useAudioPlayer`, `useCountries`, `useStations`, `useTheme`)
- `src/store/` — Store global Zustand cu persistență în `localStorage` (`useRadioStore`)
- `src/services/` — Clientul Radio Browser API cu fallback, cache-ul cu TTL 1h și detecția geografică
- `src/i18n/` — Sistemul de traduceri RO / EN

