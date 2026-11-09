---
name: audit-gatekeeper
description: Sistem automat de verificare Pre-Push în 6 faze (inspirat din cloudflare/security-audit-skill), extins cu regulile de business, reziliența formularelor/API, integritatea datelor multi-profil, UI și securitatea proiectului Filmio (aether-radio). Rulează OBLIGATORIU înainte de orice git commit, git push sau deploy.
---

# Audit Gatekeeper — Sistem Pre-Push în 6 Faze (Filmio / Aether Radio)

Acest skill definește arhitectura obligatorie de audit Pre-Push în **6 faze**, inspirată din `cloudflare/security-audit-skill` și adaptată specific pentru arhitectura **Filmio (`aether-radio`)**:
- **Frontend**: React 18 + TypeScript + Vite 6 + Tailwind CSS + Zustand (`src/views/`, `src/components/tv/`, `src/services/`, `src/store/`)
- **Backend Local & Serverless**: Middleware Vite/Node (`vite.config.ts`, `src/server/filelistServer.ts`, `src/server/youtubeServer.ts`) + Netlify Functions (`netlify/functions/*.mjs`)
- **Persistență & Sincronizare Multi-Profil**: `.tv-profiles.json`, `.tv-watch-progress*.json`, `.tv-saved*.json` + `netlify/functions/_seedData.mjs` și `src/services/defaultSeedData.ts`

> **REGULĂ DE AUR (100% READ-ONLY & ZERO PUSH NEAUTORIZAT):**
> 1. Auditul este **100% READ-ONLY** asupra bazei de date locale (`.tv-*.json`) și a fișierelor de seed (nu execută scrieri pe disc sau `db.commit()`, verificând hash-ul SHA-256 al fișierelor de date înainte și după rulare).
> 2. Niciun agent nu are voie să ruleze `git commit`, `git push` sau `netlify deploy` fără rularea prealabilă a scriptului `.agents/skills/audit-gatekeeper/scripts/run_prepush_audit.py`, obținerea verdictului `🟢 VERDE — 100% SIGUR PENTRU PUSH` și **acordul explicit al utilizatorului**.

---

## Arhitectura în 6 Faze

### Faza 1: Reconnaissance & Inventar (`git status -s`, `git diff`)
1. Inventariază toate fișierele modificate sau adăugate (`git status -s`, `git diff --stat`, `git branch -a`, `git log --all --oneline -5`).
2. Verifică sincronizarea cu `.agents/CHANGELOG.md` conform regulii Paperclip din `.agents/AGENTS.md`.
3. Calculează amprenta SHA-256 inițială a tuturor fișierelor de date (`.tv-*.json`, `netlify/functions/_seedData.mjs`) pentru a garanta că auditul este **100% READ-ONLY**.

### Faza 2: Hunting pe 5 Vectori Critici

#### Vector 1: Reziliența Formularelor și Validarea Datelor (Fără 422 / 500 / Crash)
- Testează parsarea și sanitizarea inputurilor numerice și text din formulare și query-uri API (`season`, `episode`, `year`, `currentTime`, `duration`, `start`, `audio`, `profileId`):
  - Valori goale `""`, `null`, `"undefined"`, `"NaN"`
  - Numere zecimale cu virgulă `"12,5"` sau spații `" 2026 "`
  - Payload-uri JSON malformate sau incomplete trimise la `/api/tv-sync` (`tv-profiles`, `tv-progress`, `tv-saved`), `/api/vod-stream`, `/api/filelist/*` și `/api/tv-proxy`
- Verifică existența protecțiilor anti-crash (`uncaughtException`, `unhandledRejection` și validare `new URL()`) în `src/server/filelistServer.ts`.

#### Vector 2: Integritatea Datelor și Izolarea Multi-Tenant / Multi-Profil (DB & Sync)
- Verifică izolarea strictă pe `profileId` (`p1`, `p2`, `p3`, `acc_*`) în `netlify/functions/tv-sync.mjs` și `vite.config.ts`.
- Previne dispariția sau regresia datelor la sincronizarea dintre Local (`.tv-watch-progress.json`, `.tv-saved-p1.json`, `.tv-profiles.json`) și Cloud (`netlify/functions/_seedData.mjs`, `src/services/defaultSeedData.ts`):
  - Verifică prezența profilurilor valide (minim profilul principal `p1` / `Eugeniu`).
  - Verifică faptul că istoricul de vizionare (`watch-progress`) și `episodeProgressMap` nu sunt golite accidental și păstrează cel puțin pragul minim de intrări validate.
  - Confirmă la final că hash-urile SHA-256 ale fișierelor `.tv-*.json` sunt neschimbate (**100% READ-ONLY**).

#### Vector 3: Invarianți de Business și Calcule Critice (Teste Etalon)
Rulează teste etalon deterministe cu valori cunoscute pentru regulile de business ale proiectului:
1. **Ierarhia Surselor și Clasificarea Rezoluției Maximale (`4K UHD > 1080p Full HD > 720p HD > 480p SD`)**:
   - `WEB-DLRip` fără tag HD explicit trebuie clasificat drept `480p SD` (scor `1`), **niciodată** `1080p Full HD`.
   - `2160p / 4K UHD` (scor `4`) > `1080p Full HD` (scor `3`) > `720p HD` (scor `2`) > `480p SD` (scor `1`).
   - Sortarea variantelor HLS `#EXT-X-STREAM-INF` în `netlify/functions/tv-proxy.mjs` și `vite.config.ts` pune întotdeauna rezoluția cea mai mare (`3840x2160` / `1920x1080`) pe prima poziție.
2. **Ordinea Episoadelor per Serial (`episodesSortDesc`)**:
   - **Crescător (implicit, `episodesSortDesc = false`)**: pentru `[1, 2, 3, ..., 120]`, după `Ep. 5` urmează `Ep. 6`.
   - **Descrescător (`episodesSortDesc = true`)**: când lista este ordonată descrescător `[120, 119, 118, ..., 1]`, după `Ep. 120` urmează `Ep. 119` (`Ep. X - 1`).
3. **Fuziunea Progresului pe Episoade (`episodeProgressMap` & `updatedAt`)**:
   - La sincronizarea a două stări pentru același serial, episodul cu `updatedAt` mai nou câștigă fără a șterge progresul celorlalte episoade din `episodeProgressMap`.
4. **Catalogul Emisiuni RU & Sezoane/Episoade**:
   - Verifică prezența emisiunilor cerute în `src/services/iedemVodService.ts` și `netlify/functions/vod-stream.mjs` (*Кстати*, *Токсики*, *Натальная карта*, *Вопрос Ребром*, *Прожарка*, *Звезды в Африке* cu toate cele 5 sezoane etc.) și faptul că `seasonsMap` din `src/views/SmartTvLampaView.tsx` nu golește `detailedMeta?.videos` pentru serialele rusești.

#### Vector 4: Reguli UI și de Arhitectură
- **Zero dialoguri blocante native**: Interzis `alert(...)` sau `window.confirm(...)` în codul `src/`.
- **Zero surse cu pop-up-uri publicitare**: Interzis `vidspark.to` în `src/views/smartTvLampaHelpers.ts` și `src/views/SmartTvLampaView.tsx`.
- **Protecție Sandbox pe Iframe-uri**: Toate elementele `<iframe` din playerul VOD trebuie să aibă atributul `sandbox` fără `allow-popups` (blocând reclamele tip Booking / AliExpress).
- **Compilare curată**: `npm run build` (`tsc -b && vite build`) trebuie să se finalizeze cu cod `0` (poate fi omis doar în modul rapid `--skip-build`).

#### Vector 5: Securitate (Auth, Anti-IDOR, Anti-SSRF, Secrete)
- **Sanitizare `profileId` (Anti-IDOR / Path Traversal)**: Verifică sanitizarea `profileId.replace(/[^a-zA-Z0-9_-]/g, '')` în `netlify/functions/tv-sync.mjs` și `vite.config.ts` (un `profileId` malițios precum `../../etc/passwd` nu poate accesa fișiere din afara profilului).
- **Protecție PIN Profil Principal (`p1`)**: În `netlify/functions/tv-sync.mjs`, un payload neautorizat fără PIN nu poate suprascrie profilul `p1` (`Eugeniu`).
- **Fără secrete / chei private expuse în Frontend (`src/`)**: Scanează `src/` pentru chei private (`BEGIN PRIVATE KEY`), token-uri secrete (`sk_live_`, `ghp_`, `AKIA`, `xoxb-`) sau fișiere `.env` urmărite în Git.

---

### Faza 3: Independent QA Verification (Sub-Agent Review)
Pentru modificări arhitecturale majore (peste 5 fișiere critice modificate sau schimbări în logica de streaming/sincronizare), agentul poate invoca sub-agentul `research` (read-only) pentru a verifica independent dif-urile (`git diff`) față de rezultatul scriptului `run_prepush_audit.py`.

---

### Fazele 4–6: Clasificare, Remediere & Raportare cu Semafor

Orice rulare a auditului se încheie cu tabelul standardizat de raportare și Semaforul final:

| Vector / Fază | Descriere Verificare | Status | Detalii |
| :--- | :--- | :--- | :--- |
| **Faza 1** | Reconnaissance & Inventar Git + CHANGELOG | `PASS` / `FAIL` | Fișiere modificate & verificare `.agents/CHANGELOG.md` |
| **Vector 1** | Reziliență Formulare & Validare Input (`""`, `null`, `"12,5"`) | `PASS` / `FAIL` | Teste edge-case API & parsare numerică fără 422/500 |
| **Vector 2** | Integritate Date & Izolare Multi-Profil (100% READ-ONLY) | `PASS` / `FAIL` | Integritate `.tv-*.json`, `_seedData.mjs` & SHA-256 intact |
| **Vector 3** | Invarianți Business (Rezoluție 4K/1080p, Sortare Ep., Sync) | `PASS` / `FAIL` | Teste etalon rezoluție, HLS sort, `episodesSortDesc`, Emisiuni RU |
| **Vector 4** | Reguli UI & Arhitectură (Fără `alert()`, Fără `vidspark`, Build) | `PASS` / `FAIL` | Scanare AST/Regex UI + `sandbox` iframe + `npm run build` |
| **Vector 5** | Securitate (Anti-Path-Traversal, PIN `p1`, Fără Secrete) | `PASS` / `FAIL` | Sanitizare `profileId`, protecție PIN, scanare secrete |

#### Verdict Semafor:
- Dacă **toți** vectorii sunt `PASS`:
  **`🟢 VERDE — 100% SIGUR PENTRU PUSH`** *(Agentul prezintă raportul și cere permisiunea expresă a utilizatorului înainte de orice commit/push).*
- Dacă **orice** vector este `FAIL`:
  **`🔴 BLOCAT`** *(Push-ul și commit-ul sunt strict interzise până la remedierea tuturor problemelor raportate).*

---

## Cum se rulează

- **Audit complet (inclusiv compilare `tsc -b && vite build`):**
  ```bash
  python3 .agents/skills/audit-gatekeeper/scripts/run_prepush_audit.py
  ```
- **Audit rapid (fără pasul de build, ~1 secundă):**
  ```bash
  python3 .agents/skills/audit-gatekeeper/scripts/run_prepush_audit.py --skip-build
  ```

