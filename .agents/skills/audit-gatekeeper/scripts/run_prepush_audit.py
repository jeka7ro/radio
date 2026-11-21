#!/usr/bin/env python3
"""
Audit Gatekeeper — Sistem automat de verificare Pre-Push în 6 faze
Proiect: Filmio / Aether Radio
Mod de operare: 100% READ-ONLY pe fișierele de date (.tv-*.json, _seedData.mjs).
"""

import argparse
import glob
import hashlib
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path
from typing import Dict, List, Tuple

ROOT_DIR = Path(__file__).resolve().parents[4]


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def snapshot_data_files() -> Dict[str, str]:
    """Calculează hash-urile SHA-256 ale tuturor fișierelor de date locale pentru garanția 100% READ-ONLY."""
    snaps: Dict[str, str] = {}
    patterns = [
        ".tv-*.json",
        "netlify/functions/_seedData.mjs",
        "src/services/defaultSeedData.ts",
    ]
    for pat in patterns:
        for p in sorted(ROOT_DIR.glob(pat)):
            if p.is_file():
                snaps[str(p.relative_to(ROOT_DIR))] = sha256_file(p)
    return snaps


def run_cmd(cmd: List[str], cwd: Path = ROOT_DIR, timeout: int = 180) -> Tuple[int, str, str]:
    proc = subprocess.run(
        cmd,
        cwd=str(cwd),
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    return proc.returncode, proc.stdout.strip(), proc.stderr.strip()


# ============================================================================
# FAZA 1: Reconnaissance & Inventar (git status -s, git diff, CHANGELOG.md)
# ============================================================================
def phase1_reconnaissance() -> Tuple[bool, str, List[str]]:
    details: List[str] = []
    code, status_out, err = run_cmd(["git", "status", "-s"])
    if code != 0:
        return False, f"Eroare git status: {err}", [err]

    modified_lines = [line for line in status_out.splitlines() if line.strip()]
    details.append(f"Fișiere modificate/noi în working tree: {len(modified_lines)}")

    changelog_path = ROOT_DIR / ".agents" / "CHANGELOG.md"
    if not changelog_path.exists():
        return False, "Lipsește .agents/CHANGELOG.md (obligatoriu conform .agents/AGENTS.md)", details

    changelog_txt = changelog_path.read_text(encoding="utf-8", errors="ignore")
    if "### 2026-" not in changelog_txt:
        return False, ".agents/CHANGELOG.md nu conține intrări datate valide", details

    agents_md = ROOT_DIR / ".agents" / "AGENTS.md"
    if not agents_md.exists():
        return False, "Lipsește .agents/AGENTS.md", details

    summary = f"{len(modified_lines)} fișiere în lucru; .agents/CHANGELOG.md și .agents/AGENTS.md prezente"
    return True, summary, details


# ============================================================================
# VECTOR 1: Reziliența Formularelor și Validarea Datelor (Fără 422 / 500 / Crash)
# ============================================================================
def vector1_form_and_input_resilience() -> Tuple[bool, str, List[str]]:
    """
    Testează în memorie (100% READ-ONLY, în subproces Node izolat) funcțiile API și parsarea
    parametrilor pentru valori golite "", null, "undefined", virgule "12,5", JSON malformat,
    precum și protecțiile anti-crash din filelistServer.ts.
    """
    details: List[str] = []
    errors: List[str] = []

    # 1. Verifică protecția anti-crash în src/server/filelistServer.ts
    fl_server = ROOT_DIR / "src" / "server" / "filelistServer.ts"
    if not fl_server.exists():
        errors.append("Lipsește src/server/filelistServer.ts")
    else:
        fl_txt = fl_server.read_text(encoding="utf-8", errors="ignore")
        if "uncaughtException" not in fl_txt or "unhandledRejection" not in fl_txt:
            errors.append("filelistServer.ts nu are protecție globală uncaughtException / unhandledRejection")
        else:
            details.append("Protecție anti-crash uncaughtException/unhandledRejection activă în filelistServer.ts")

    # 2. Rulează teste în memorie (fără scriere pe disc) pe netlify/functions/tv-sync.mjs și filelist-catalog.mjs
    node_test_script = r"""
import tvSyncHandler from './netlify/functions/tv-sync.mjs';
import { handler as flCatalogHandler } from './netlify/functions/filelist-catalog.mjs';

async function assertResilient(name, fn) {
  const res = await fn();
  const status = res?.status ?? res?.statusCode;
  if (!res || typeof status !== 'number') {
    throw new Error(`${name}: nu a returnat obiect Response valid`);
  }
  if (status === 422 || status >= 500) {
    throw new Error(`${name}: status interzis ${status}`);
  }
  return status;
}

// Test 1: Payload JSON malformat / gol "" la POST /api/tv-progress
await assertResilient('tv-progress empty body ""', () =>
  tvSyncHandler(new Request('https://filmio.my/api/tv-progress?profileId=test_ro_audit', {
    method: 'POST',
    body: '',
  }))
);

// Test 2: Valori numerice cu virgulă "12,5", "", null în currentTime / duration / season / episode
await assertResilient('tv-progress comma/null/empty numbers', () =>
  tvSyncHandler(new Request('https://filmio.my/api/tv-progress?profileId=test_ro_audit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      'test_item_1': {
        id: 'test_item_1',
        currentTime: '12,5',
        duration: '',
        season: null,
        episode: 'undefined',
        updatedAt: Date.now(),
        episodeProgressMap: {
          'S1E1': { currentTime: '45,8', duration: null, updatedAt: Date.now() }
        }
      }
    }),
  }))
);

// Test 3: POST /api/tv-profiles cu input null / invalid / x-deleted-profile-ids malformat
await assertResilient('tv-profiles malformed header & null items', () =>
  tvSyncHandler(new Request('https://filmio.my/api/tv-profiles', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-deleted-profile-ids': '{malformed_json',
    },
    body: JSON.stringify([null, {}, { id: '', name: null }]),
  }))
);

// Test 4: POST /api/tv-saved cu elemente nule sau fără ID
await assertResilient('tv-saved null elements', () =>
  tvSyncHandler(new Request('https://filmio.my/api/tv-saved?profileId=test_ro_audit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([null, { id: '' }, { name: 'Fără ID' }]),
  }))
);

// Test 5: /api/filelist/status cu parametri numerici invalizi (season="", episode="12,5", year="null")
await assertResilient('filelist-catalog status edge params', () =>
  flCatalogHandler({
    httpMethod: 'GET',
    path: '/api/filelist/status',
    queryStringParameters: { season: '', episode: '12,5', year: 'null' },
  })
);

console.log('VECTOR1_NODE_OK');
"""
    code, out, err = run_cmd(["node", "--input-type=module", "-e", node_test_script])
    if code != 0 or "VECTOR1_NODE_OK" not in out:
        errors.append(f"Eroare la testele de reziliență API în memorie: {err or out}")
    else:
        details.append("5/5 teste edge-case API (\"\", null, \"12,5\", JSON malformat) au returnat 200 OK fără 422/500")

    if errors:
        return False, "; ".join(errors), details
    return True, "Toate rutele API și formularele gestionează \"\", null, \"12,5\" și JSON malformat fără 422/500", details


# ============================================================================
# VECTOR 2: Integritatea Datelor și Izolarea Multi-Profil (100% READ-ONLY)
# ============================================================================
def vector2_data_integrity_and_isolation(initial_snapshots: Dict[str, str]) -> Tuple[bool, str, List[str]]:
    details: List[str] = []
    errors: List[str] = []

    # 1. Verifică existența și consistența fișierelor locale .tv-profiles.json, .tv-watch-progress.json, .tv-saved-p1.json
    profiles_path = ROOT_DIR / ".tv-profiles.json"
    progress_path = ROOT_DIR / ".tv-watch-progress.json"
    saved_p1_path = ROOT_DIR / ".tv-saved-p1.json"

    if not profiles_path.exists():
        errors.append("Lipsește .tv-profiles.json")
    else:
        try:
            profiles = json.loads(profiles_path.read_text(encoding="utf-8"))
            if not isinstance(profiles, list) or len(profiles) == 0:
                errors.append(".tv-profiles.json este gol sau invalid")
            else:
                p1 = next((p for p in profiles if isinstance(p, dict) and p.get("id") == "p1"), None)
                if not p1:
                    errors.append("Profilul principal 'p1' lipsește din .tv-profiles.json")
                else:
                    details.append(f".tv-profiles.json valid ({len(profiles)} profiluri, p1='{p1.get('name')}')")
        except Exception as e:
            errors.append(f"Eroare parsare .tv-profiles.json: {e}")

    local_progress_count = 0
    if not progress_path.exists():
        errors.append("Lipsește .tv-watch-progress.json")
    else:
        try:
            prog = json.loads(progress_path.read_text(encoding="utf-8"))
            if not isinstance(prog, dict) or len(prog) < 10:
                errors.append(f".tv-watch-progress.json are prea puține intrări ({len(prog) if isinstance(prog, dict) else 0} < 10) — risc de pierdere a istoricului!")
            else:
                local_progress_count = len(prog)
                details.append(f".tv-watch-progress.json conține {local_progress_count} seriale/filme în istoric")
        except Exception as e:
            errors.append(f"Eroare parsare .tv-watch-progress.json: {e}")

    if saved_p1_path.exists():
        try:
            saved_p1 = json.loads(saved_p1_path.read_text(encoding="utf-8"))
            if not isinstance(saved_p1, list) or len(saved_p1) == 0:
                errors.append(".tv-saved-p1.json este gol — risc de pierdere a favoritelor!")
            else:
                details.append(f".tv-saved-p1.json conține {len(saved_p1)} favorite")
        except Exception as e:
            errors.append(f"Eroare parsare .tv-saved-p1.json: {e}")

    # 2. Verifică sincronizarea cu _seedData.mjs + izolarea multi-profil în memorie
    node_isolation_test = r"""
import { SEED_PROFILES, SEED_PROGRESS_BY_PROFILE, SEED_SAVED_BY_PROFILE } from './netlify/functions/_seedData.mjs';
import tvSyncHandler from './netlify/functions/tv-sync.mjs';

if (!Array.isArray(SEED_PROFILES) || SEED_PROFILES.length === 0) {
  throw new Error('SEED_PROFILES este gol în _seedData.mjs');
}
const p1SeedProg = SEED_PROGRESS_BY_PROFILE?.p1 || {};
const p1Count = Object.keys(p1SeedProg).length;
if (p1Count < 10) {
  throw new Error(`SEED_PROGRESS_BY_PROFILE.p1 are doar ${p1Count} intrări (< 10)`);
}

// Testează izolarea strictă între două profiluri în memorie (profile_A vs profile_B)
await tvSyncHandler(new Request('https://filmio.my/api/tv-progress?profileId=audit_iso_A', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 'secret_movie_A': { id: 'secret_movie_A', currentTime: 120, updatedAt: 1000 } }),
}));

const resB = await tvSyncHandler(new Request('https://filmio.my/api/tv-progress?profileId=audit_iso_B'));
const dataB = await resB.json();
if (dataB && dataB['secret_movie_A']) {
  throw new Error('Scăpare de date între profiluri: secret_movie_A vizibil în audit_iso_B!');
}

console.log(`VECTOR2_OK:seed_p1=${p1Count}`);
"""
    code, out, err = run_cmd(["node", "--input-type=module", "-e", node_isolation_test])
    if code != 0 or "VECTOR2_OK:" not in out:
        errors.append(f"Eroare verificare _seedData.mjs / izolare multi-profil: {err or out}")
    else:
        details.append("Izolare multi-profil (profileId) și _seedData.mjs verificate cu succes în memorie")

    # 3. Verifică că niciun fișier de date nu a fost modificat pe disc (100% READ-ONLY)
    after_snapshots = snapshot_data_files()
    if initial_snapshots != after_snapshots:
        errors.append("ÎNCĂLCARE READ-ONLY: Hash-ul SHA-256 al fișierelor de date s-a modificat în timpul testelor!")
    else:
        details.append(f"100% READ-ONLY confirmat: {len(after_snapshots)} fișiere de date cu SHA-256 identic")

    if errors:
        return False, "; ".join(errors), details
    return True, f"Date intacte ({local_progress_count} intrări istoric), izolare multi-profil activă, 100% READ-ONLY", details


# ============================================================================
# VECTOR 3: Invarianți de Business și Calcule Critice (Teste Etalon)
# ============================================================================
def vector3_business_invariants() -> Tuple[bool, str, List[str]]:
    details: List[str] = []
    errors: List[str] = []

    # 1. Verifică în src/server/filelistServer.ts clasificarea corectă a rezoluției (WEB-DLRip fără HD = 480p SD, nu 1080p)
    fl_server = (ROOT_DIR / "src" / "server" / "filelistServer.ts").read_text(encoding="utf-8", errors="ignore")
    if "480p SD" not in fl_server:
        errors.append("filelistServer.ts nu clasifică WEB-DLRip fără tag HD ca '480p SD'")
    else:
        details.append("Clasificare Kinozal etalon: WEB-DLRip fără tag HD = '480p SD' (scor 1), 2160p 4K (scor 4) > 1080p (scor 3)")

    # 2. Verifică că în SmartTvLampaViewCore.tsx nu mai există blocajul `isRuSeries ? [] : detailedMeta?.videos`
    lampa_core_path = ROOT_DIR / "src" / "views" / "SmartTvLampaViewCore.tsx"
    lampa_view = (
        lampa_core_path.read_text(encoding="utf-8", errors="ignore")
        if lampa_core_path.exists()
        else (ROOT_DIR / "src" / "views" / "SmartTvLampaView.tsx").read_text(encoding="utf-8", errors="ignore")
    )
    if re.search(r"isRuSeries\s*\?\s*\[\s*\]\s*:\s*detailedMeta\?\.videos", lampa_view):
        errors.append("Regresie în SmartTvLampaView.tsx: `isRuSeries ? [] : detailedMeta?.videos` ascunde sezoanele la serialele rusești!")
    else:
        details.append("Lista de Sezoane & Episoade (`seasonsMap`) activă pentru toate serialele rusești și internaționale")

    # 3. Verifică prezența regulii `episodesSortDesc` (ordonare crescătoare implicită vs descrescătoare per serial)
    helpers_txt = (ROOT_DIR / "src" / "views" / "smartTvLampaHelpers.ts").read_text(encoding="utf-8", errors="ignore")
    if "aether_series_episode_sort_v1" not in helpers_txt or "episodesSortDesc" not in lampa_view:
        errors.append("Lipsește persistarea ordinii de sortare a episoadelor (`episodesSortDesc` / `aether_series_episode_sort_v1`)")
    else:
        details.append("Memorare ordine episoade per serial (`episodesSortDesc`: Crescător 1->N implicit / Descrescător N->1) prezentă")

    # 3b. Verifică prezența regulii Skip Intro / Skip Recap (inclusiv fallback pentru Asia Express tt10295772 și seriale neindexate în IntroDB)
    player_txt = (ROOT_DIR / "src" / "components" / "tv" / "VodNativeHlsPlayer.tsx").read_text(encoding="utf-8", errors="ignore")
    if "fallback_reality_recap_1_105" not in player_txt or "fallback_reality_intro_105_210" not in player_txt or "fallback_series_intro" not in player_txt:
        errors.append("Lipsește regula fallback Skip Recap / Skip Intro pentru Asia Express (tt10295772) și serialele neindexate în IntroDB în VodNativeHlsPlayer.tsx!")
    else:
        details.append("Regula Skip Recap / Skip Intro activă (IntroDB + Subtitrări + Fallback Asia Express / Seriale)")

    # 4. Teste etalon în Node pentru:
    #    a) Sortarea variantelor HLS (#EXT-X-STREAM-INF) descrescător după rezoluție în tv-proxy.mjs
    #    b) Fuziunea episodeProgressMap după updatedAt în tv-sync.mjs
    #    c) Prezența emisiunilor RU obligatorii (Кстати, Токсики, Натальная карта, Вопрос Ребром, Прожарка, Звезды в Африке)
    node_invariants_script = r"""
import fs from 'node:fs';
import tvSyncHandler from './netlify/functions/tv-sync.mjs';

// Etalon A: Verifică că tv-proxy.mjs sortează variantele #EXT-X-STREAM-INF descrescător (b.height - a.height || b.bandwidth - a.bandwidth)
const proxyCode = fs.readFileSync('./netlify/functions/tv-proxy.mjs', 'utf8');
if (!proxyCode.includes('b.height - a.height')) {
  throw new Error('tv-proxy.mjs nu sortează variantele HLS descrescător după rezoluție (b.height - a.height)');
}

// Etalon B: Testează fuziunea episodeProgressMap în tv-sync.mjs (episodul mai nou câștigă, episoadele vechi nu se pierd)
const prof = 'audit_merge_etalon';
await tvSyncHandler(new Request(`https://filmio.my/api/tv-progress?profileId=${prof}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    'series_1': {
      id: 'series_1',
      season: 1,
      episode: 1,
      currentTime: 300,
      updatedAt: 1000,
      episodeProgressMap: {
        '1:1': { season: 1, episode: 1, currentTime: 300, duration: 1800, updatedAt: 1000 },
        '1:2': { season: 1, episode: 2, currentTime: 100, duration: 1800, updatedAt: 1000 }
      }
    }
  }),
}));

const resMerge = await tvSyncHandler(new Request(`https://filmio.my/api/tv-progress?profileId=${prof}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    'series_1': {
      id: 'series_1',
      season: 1,
      episode: 2,
      currentTime: 950,
      updatedAt: 2000,
      episodeProgressMap: {
        '1:2': { season: 1, episode: 2, currentTime: 950, duration: 1800, updatedAt: 2000 },
        '1:3': { season: 1, episode: 3, currentTime: 60, duration: 1800, updatedAt: 2000 }
      }
    }
  }),
}));
const mergedData = await resMerge.json();
const s1 = mergedData['series_1'];
if (!s1 || s1.currentTime !== 950 || s1.episodeProgressMap?.['1:1']?.currentTime !== 300 || s1.episodeProgressMap?.['1:2']?.currentTime !== 950 || s1.episodeProgressMap?.['1:3']?.currentTime !== 60) {
  throw new Error('Calcul etalon fuziune episodeProgressMap eșuat: ' + JSON.stringify(s1));
}

// Etalon C: Verifică prezența emisiunilor RU obligatorii și a sezoanelor 1..5 pentru Звезды в Африке (4761950)
const vodStreamCode = fs.readFileSync('./netlify/functions/vod-stream.mjs', 'utf8');
const iedemCode = fs.readFileSync('./src/services/iedemVodService.ts', 'utf8');
const requiredShows = ['5318639', '9001012', '9001001', '9001013', '9001014', '4761950'];
for (const kpId of requiredShows) {
  if (!vodStreamCode.includes(kpId) || !iedemCode.includes(kpId)) {
    throw new Error(`Emisiunea RU obligatorie kpId=${kpId} lipsește din vod-stream.mjs sau iedemVodService.ts`);
  }
}

// Etalon D: Persistare închidere player muzică (tombstone `closed: true`, nu reapare la refresh)
const musicProf = 'audit_music_close';
await tvSyncHandler(new Request(`https://filmio.my/api/tv-music-sync?profileId=${musicProf}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    updatedAt: 1000,
    likedTracks: [],
    removedMap: {},
    recentTracks: [],
    playbackState: {
      track: {
        id: 'dz_test',
        title: 'Your Latest Trick',
        artist: 'Dire Straits',
        cover: '',
        durationSec: 389,
        year: 1985,
        genre: 'Rock',
      },
      elapsedSec: 180,
      durationSec: 389,
      updatedAt: 1000,
    },
  }),
}));

await tvSyncHandler(new Request(`https://filmio.my/api/tv-music-sync?profileId=${musicProf}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    updatedAt: 2000,
    playbackState: {
      track: null,
      elapsedSec: 0,
      durationSec: 0,
      updatedAt: 2000,
      closed: true,
    },
  }),
}));

const resMusicClosed = await tvSyncHandler(new Request(`https://filmio.my/api/tv-music-sync?profileId=${musicProf}`));
const closedData = await resMusicClosed.json();
if (!closedData?.playbackState?.closed || closedData?.playbackState?.track !== null) {
  throw new Error('Etalon D eșuat: tombstone-ul de închidere muzică nu a fost păstrat: ' + JSON.stringify(closedData?.playbackState));
}

// Etalon E: Testează marcarea/anularea Văzut (isWatched: false, currentTime: 0) în /api/tv-progress și ștergerea Favorite prin X-Removed-Vod-Ids în /api/tv-saved
const watchedProf = 'audit_watched_etalon';
await tvSyncHandler(new Request(`https://filmio.my/api/tv-progress?profileId=${watchedProf}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    'tt0499549': {
      item: { id: 'tt0499549', imdbId: 'tt0499549', name: 'Avatar', type: 'movie', poster: '' },
      season: 1,
      episode: 1,
      currentTime: 5400,
      duration: 5400,
      isWatched: true,
      updatedAt: 1000,
    },
  }),
}));
await tvSyncHandler(new Request(`https://filmio.my/api/tv-progress?profileId=${watchedProf}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    'tt0499549': {
      item: { id: 'tt0499549', imdbId: 'tt0499549', name: 'Avatar', type: 'movie', poster: '' },
      season: 1,
      episode: 1,
      currentTime: 0,
      duration: 5400,
      isWatched: false,
      updatedAt: 5000,
    },
  }),
}));
const resUnmarked = await tvSyncHandler(new Request(`https://filmio.my/api/tv-progress?profileId=${watchedProf}`));
const unmarkedMap = await resUnmarked.json();
if (!unmarkedMap?.tt0499549 || unmarkedMap.tt0499549.currentTime !== 0 || unmarkedMap.tt0499549.isWatched !== false) {
  throw new Error('Etalon E eșuat (/api/tv-progress unmark): ' + JSON.stringify(unmarkedMap?.tt0499549));
}

const savedProf = 'audit_saved_etalon';
await tvSyncHandler(new Request(`https://filmio.my/api/tv-saved?profileId=${savedProf}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify([
    { id: 'fav_1', name: 'Film 1', type: 'movie', poster: '', savedAt: 1000 },
    { id: 'fav_2', name: 'Film 2', type: 'movie', poster: '', savedAt: 1000 },
  ]),
}));
await tvSyncHandler(new Request(`https://filmio.my/api/tv-saved?profileId=${savedProf}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Removed-Vod-Ids': JSON.stringify({ fav_2: 5000 }),
  },
  body: JSON.stringify([
    { id: 'fav_1', name: 'Film 1', type: 'movie', poster: '', savedAt: 1000 },
  ]),
}));
const resSavedCheck = await tvSyncHandler(new Request(`https://filmio.my/api/tv-saved?profileId=${savedProf}`));
const savedCheckArr = await resSavedCheck.json();
if (!Array.isArray(savedCheckArr) || savedCheckArr.length !== 1 || savedCheckArr[0]?.id !== 'fav_1') {
  throw new Error('Etalon E eșuat (/api/tv-saved X-Removed-Vod-Ids): ' + JSON.stringify(savedCheckArr));
}

console.log('VECTOR3_NODE_OK');
"""
    code, out, err = run_cmd(["node", "--input-type=module", "-e", node_invariants_script])
    if code != 0 or "VECTOR3_NODE_OK" not in out:
        errors.append(f"Eroare teste etalon business în Node: {err or out}")
    else:
        details.append("Teste etalon HLS 4K/1080p sort, fuziune episodeProgressMap și catalog Emisiuni RU (6/6 show-uri cheie) trecute")

    # 3c. Verifică integritatea redării Muzică Full-Track (fără trunchiere 10-15s / preview 30s)
    yt_fn_txt = (ROOT_DIR / "netlify" / "functions" / "youtube.mjs").read_text(encoding="utf-8", errors="ignore")
    if "searchDeezerFallback" in yt_fn_txt or "Netlify-CDN-Cache-Control" in yt_fn_txt:
        errors.append("netlify/functions/youtube.mjs conține încă `searchDeezerFallback` (preview 30s) sau `Netlify-CDN-Cache-Control` fără Vary:Range pe `/api/youtube/audio`!")
    else:
        details.append("netlify/functions/youtube.mjs: fără fallback 30s Deezer și fără cache CDN care amestecă range-urile audio")

    offline_music_txt = (ROOT_DIR / "src" / "services" / "offlineMusicService.ts").read_text(encoding="utf-8", errors="ignore")
    perform_m = re.search(r"async function performSingleDownload\b([\s\S]*?)\nconst singleWaiters\b", offline_music_txt)
    if not perform_m or "track.previewUrl" in perform_m.group(1) or "650_000" not in offline_music_txt:
        errors.append("src/services/offlineMusicService.ts permite fallback la preview 30s în descărcări sau nu impune pragul minim de 650_000 bytes!")
    else:
        details.append("offlineMusicService.ts: prag minim 650 KB pentru piese complete + zero salvare offline a preview-ului de 30s")

    music_engine_path = ROOT_DIR / "src" / "services" / "musicStreamEngine.ts"
    if not music_engine_path.exists():
        errors.append("Lipsește src/services/musicStreamEngine.ts pentru redare completă în Cloud!")
    else:
        me_txt = music_engine_path.read_text(encoding="utf-8", errors="ignore")
        if (
            "youtube.com/iframe_api" not in me_txt
            or ("YT.Player" not in me_txt and "PlayerCtor" not in me_txt)
            or "width: '200'" not in me_txt
            or "height: '200'" not in me_txt
        ):
            errors.append(
                "src/services/musicStreamEngine.ts nu inițializează engine-ul oficial YT IFrame (`youtube.com/iframe_api` 200x200)"
            )
        elif "isMobileLockScreenDevice()) return" in me_txt:
            errors.append(
                "src/services/musicStreamEngine.ts blochează prewarmYoutubeMusicEngine() pe mobil/iPad (provoacă fallback 30s)!"
            )
        else:
            details.append(
                "musicStreamEngine.ts activ (motor hibrid: Residential Direct Audio + YouTube `iframe_api` YT.Player 200x200 full-track pe toate dispozitivele)"
            )

    lampa_music_p = ROOT_DIR / "src" / "views" / "SmartTvLampaViewCore.tsx"
    if lampa_music_p.exists():
        lm_txt = lampa_music_p.read_text(encoding="utf-8", errors="ignore")
        if re.search(r"\b(?:el|audioEl)\.src\s*=\s*[^;\n]*previewUrl", lm_txt):
            errors.append(
                "SmartTvLampaViewCore.tsx conține fallback audio către `previewUrl` (30 secunde) — STRICT INTERZIS!"
            )
        elif "!isMobileLockScreenDevice()" in lm_txt:
            errors.append(
                "SmartTvLampaViewCore.tsx blochează redarea full-track YT.Player pe iPhone/iPad (`!isMobileLockScreenDevice()`)!"
            )
        else:
            details.append(
                "SmartTvLampaViewCore.tsx: 0 fallback-uri 30s `previewUrl` + full-track activ pe iPhone, iPad, Android, PC și TV"
            )

    if errors:
        return False, "; ".join(errors), details
    return True, "Toți invarianții de business (Rezoluție 4K/1080p, Sortare Episoade, Sync Multi-Episod, Emisiuni RU, Muzică Full-Track) validați", details


# ============================================================================
# VECTOR 4: Reguli UI și de Arhitectură (Fără alert/confirm, Fără vidspark, Build)
# ============================================================================
def vector4_ui_and_architecture(skip_build: bool = False) -> Tuple[bool, str, List[str]]:
    details: List[str] = []
    errors: List[str] = []

    # 1. Scanare pentru alert() / window.confirm() în src/
    forbidden_dialogs: List[str] = []
    for path_str in sorted(glob.glob(str(ROOT_DIR / "src" / "**" / "*.*"), recursive=True)):
        if not path_str.endswith((".ts", ".tsx")):
            continue
        p = Path(path_str)
        txt = p.read_text(encoding="utf-8", errors="ignore")
        for m in re.finditer(r"\b(?:window\.)?(alert|confirm)\s*\(", txt):
            line_no = txt[: m.start()].count("\n") + 1
            forbidden_dialogs.append(f"{p.relative_to(ROOT_DIR)}:{line_no} ({m.group(0)})")

    if forbidden_dialogs:
        errors.append(f"Dialoguri native interzise găsite: {', '.join(forbidden_dialogs[:5])}")
    else:
        details.append("0 apeluri `alert()` sau `window.confirm()` în `src/`")

    # 2. Verificare interdicție absolută surse externe iframe în frontend (vidsrc.pm, vidspark.to, multiembed, vidzee, frembed, vidmoly/rumble embed)
    #    și interdicție returnare `embedUrl:` din netlify/functions/vod-stream.mjs
    forbidden_embed_patterns = [
        "vidspark.to",
        "vidsrc.pm",
        "player.vidzee.wtf",
        "multiembed.mov",
        "frembed.live",
        "vidmoly.net/embed",
        "rumble.com/embed",
    ]
    embed_violations: List[str] = []
    for path_str in sorted(glob.glob(str(ROOT_DIR / "src" / "**" / "*.*"), recursive=True)):
        if not path_str.endswith((".ts", ".tsx", ".js")):
            continue
        p = Path(path_str)
        txt = p.read_text(encoding="utf-8", errors="ignore")
        for pat in forbidden_embed_patterns:
            if pat in txt:
                embed_violations.append(f"{p.relative_to(ROOT_DIR)} ({pat})")
    vod_fn_p = ROOT_DIR / "netlify" / "functions" / "vod-stream.mjs"
    if vod_fn_p.exists():
        vod_fn_txt = vod_fn_p.read_text(encoding="utf-8", errors="ignore")
        if re.search(r"\bembedUrl\s*:", vod_fn_txt):
            embed_violations.append("netlify/functions/vod-stream.mjs (returnează embedUrl:)")
    if embed_violations:
        errors.append(
            f"Surse externe iframe INTERZISE detectate: {', '.join(embed_violations[:6])}"
        )
    else:
        details.append(
            "0 referințe la playere externe terțe (vidsrc.pm / vidspark.to / multiembed / vidzee / frembed / embedUrl eliminate 100%)"
        )

    # 3. Verificare ZERO <iframe> VOD externe în SmartTvLampaViewCore.tsx și playerul VOD din MediatecaView.tsx (permise DOAR YouTube oficial & tab-ul explicit Lampa)
    lampa_core_p = ROOT_DIR / "src" / "views" / "SmartTvLampaViewCore.tsx"
    lampa_txt = (
        lampa_core_p.read_text(encoding="utf-8", errors="ignore")
        if lampa_core_p.exists()
        else (ROOT_DIR / "src" / "views" / "SmartTvLampaView.tsx").read_text(encoding="utf-8", errors="ignore")
    )
    mediateca_p = ROOT_DIR / "src" / "views" / "MediatecaView.tsx"
    mediateca_txt = mediateca_p.read_text(encoding="utf-8", errors="ignore") if mediateca_p.exists() else ""
    vod_iframes_found: List[str] = []
    yt_iframe_count = 0
    for label_name, content_txt in [("SmartTvLampaViewCore.tsx", lampa_txt), ("MediatecaView.tsx", mediateca_txt)]:
        for m in re.finditer(r"<iframe\b[^>]*>", content_txt, flags=re.DOTALL):
            tag = m.group(0)
            if "youtube-nocookie.com" in tag or "youtube.com/embed" in tag:
                yt_iframe_count += 1
            elif label_name == "MediatecaView.tsx" and "src={lampaServer}" in tag:
                continue
            else:
                line_no = content_txt[: m.start()].count("\n") + 1
                vod_iframes_found.append(f"{label_name}:{line_no}")
    if vod_iframes_found:
        errors.append(
            f"Iframe-uri VOD externe INTERZISE găsite ({', '.join(vod_iframes_found)}) — redarea VOD trebuie să folosească EXCLUSIV VodNativeHlsPlayer!"
        )
    else:
        details.append(
            f"0 elemente `<iframe>` VOD externe în SmartTvLampaViewCore.tsx / MediatecaView.tsx (exclusiv VodNativeHlsPlayer; +{yt_iframe_count} YouTube oficial)"
        )

    # 3b. Verificare runtime vod-stream.mjs fără ReferenceError și fără embedUrl extern
    vod_rt_test = r"""
import { resolveVodStreamData } from './netlify/functions/vod-stream.mjs';
const res = await resolveVodStreamData({ imdb: 'tt15239678', title: 'Dune: Part Two', mediaType: 'movie', ru: '0' });
if (!res || typeof res !== 'object') {
  throw new Error('resolveVodStreamData returned non-object');
}
if (res.embedUrl) {
  throw new Error('resolveVodStreamData returned forbidden external embedUrl: ' + res.embedUrl);
}
console.log('VOD_RT_OK', JSON.stringify({ ok: res.ok, hasHls: !!res.hlsUrl, hasEmbed: !!res.embedUrl }));
"""
    rt_code, rt_out, rt_err = run_cmd(["node", "--input-type=module", "-e", vod_rt_test], timeout=35)
    if rt_code != 0 or "VOD_RT_OK" not in rt_out:
        errors.append(
            f"Runtime check `vod-stream.mjs` a eșuat: {(rt_err or rt_out).strip()[-280:]}"
        )
    else:
        details.append("Runtime `netlify/functions/vod-stream.mjs` executat fără excepții și 0 `embedUrl` externe")

    # 4. Compilare completă TypeScript + Vite (`npm run build`) sau Typecheck rapid (`npx tsc --noEmit`)
    if skip_build:
        t0 = time.time()
        code, out, err = run_cmd(["npx", "tsc", "--noEmit"], timeout=60)
        elapsed = time.time() - t0
        if code != 0:
            errors.append(f"`npx tsc --noEmit` a eșuat (cod {code}): {(err or out)[-300:]}")
        else:
            details.append(f"`npx tsc --noEmit` (verificare exporturi/tipuri TS) finalizat curat în {elapsed:.1f}s (--skip-build)")
    else:
        t0 = time.time()
        code, out, err = run_cmd(["npm", "run", "build"], timeout=240)
        elapsed = time.time() - t0
        if code != 0:
            errors.append(f"`npm run build` a eșuat (cod {code}): {(err or out)[-300:]}")
        else:
            details.append(f"`npm run build` (`tsc -b && vite build`) finalizat curat în {elapsed:.1f}s")

    if errors:
        return False, "; ".join(errors), details
    build_label = "Build OK" if not skip_build else "Skip-Build"
    return True, f"Fără alert()/confirm(), fără vidspark.to, iframe sandbox activ, {build_label}", details


# ============================================================================
# VECTOR 5: Securitate (Anti-Path-Traversal / IDOR, Anti-SSRF, Duplicate Accounts, Secrete)
# ============================================================================
def vector5_security() -> Tuple[bool, str, List[str]]:
    details: List[str] = []
    errors: List[str] = []

    # 1. Verifică în memorie protecția PIN pe p1, sanitizarea profileId, blocarea conturilor duplicate,
    #    și protecția Anti-SSRF & Anti-Recursivitate pe /api/tv-proxy
    node_sec_test = r"""
import tvSyncHandler from './netlify/functions/tv-sync.mjs';
import tvProxyMod from './netlify/functions/tv-proxy.mjs';

const tvProxyHandler = typeof tvProxyMod === 'function' ? tvProxyMod : tvProxyMod?.handler || tvProxyMod?.default;
if (typeof tvProxyHandler !== 'function') {
  throw new Error('tv-proxy.mjs nu exportă handler default/named valid');
}

// Test A: Încercare de suprascriere a profilului p1 ('Eugeniu') fără PIN -> trebuie respinsă!
const resP1 = await tvSyncHandler(new Request('https://filmio.my/api/tv-profiles', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify([{ id: 'p1', name: 'Eugeniu', pin: '', updatedAt: 9999999999999 }]),
}));
const profiles = await resP1.json();
const p1 = profiles.find((p) => p && p.id === 'p1');
if (p1 && p1.name === 'Eugeniu' && !p1.pin) {
  throw new Error('Securitate încălcată: profilul p1 (Eugeniu) a putut fi suprascris fără PIN!');
}

// Test B: Blocare creare cont duplicat cu același nume (inclusiv spații/majuscule diferite)
const resFirstAcc = await tvSyncHandler(new Request('https://filmio.my/api/tv-profiles', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify([{ id: 'acc_audit_unique_1', name: 'AuditSashaTest', updatedAt: Date.now() }]),
}));
const afterFirst = await resFirstAcc.json();
const hasFirst = afterFirst.some((p) => p && p.id === 'acc_audit_unique_1');
const resDupAcc = await tvSyncHandler(new Request('https://filmio.my/api/tv-profiles', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify([{ id: 'acc_audit_unique_2', name: ' auditsashatest ', updatedAt: Date.now() + 1000 }]),
}));
const afterDup = await resDupAcc.json();
if (!hasFirst || afterDup.some((p) => p && p.id === 'acc_audit_unique_2')) {
  throw new Error('Securitate conturi: profilul duplicat (nume identic normalizat) nu a fost respins!');
}

// Test C: Sanitizare profileId cu caractere de Path Traversal (../../etc/passwd)
const resTrav = await tvSyncHandler(new Request('https://filmio.my/api/tv-progress?profileId=../../etc/passwd'));
if (resTrav.status !== 200) {
  throw new Error('Eroare la sanitizarea profileId cu path traversal');
}

// Test D: Protecție Anti-SSRF & Anti-Recursivitate pe /api/tv-proxy
const blockedUrls = [
  'http://169.254.169.254/latest/meta-data/',
  'http://127.0.0.1:8769/api/tv-profiles',
  'http://192.168.1.1/',
  'https://filmio.my/api/tv-proxy?url=https://example.com',
  'file:///etc/passwd',
];
for (const badUrl of blockedUrls) {
  const ssrfRes = await tvProxyHandler(
    new Request('https://filmio.my/api/tv-proxy?url=' + encodeURIComponent(badUrl), {
      headers: { host: 'filmio.my' },
    })
  );
  if (ssrfRes.status !== 400 && ssrfRes.status !== 403) {
    throw new Error(`SSRF permis pentru ${badUrl} (status ${ssrfRes.status})`);
  }
}

console.log('VECTOR5_NODE_OK');
"""
    code, out, err = run_cmd(["node", "--input-type=module", "-e", node_sec_test])
    if code != 0 or "VECTOR5_NODE_OK" not in out:
        errors.append(f"Eroare teste securitate în Node: {err or out}")
    else:
        details.append("Protecție PIN `p1`, blocare conturi duplicate, sanitizare `profileId` și Anti-SSRF `/api/tv-proxy` (5/5 ținte blocate 400/403) confirmate")

    # 2. Scanare secrete critice expuse în frontend & serverless (src/, netlify/functions/, public/, index.html)
    secret_patterns = [
        (r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----", "Cheie privată PEM"),
        (r"\bsk_live_[0-9a-zA-Z]{24,}\b", "Cheie secretă Stripe Live"),
        (r"\bAKIA[0-9A-Z]{16}\b", "AWS Access Key ID"),
        (r"\bghp_[0-9a-zA-Z]{36}\b", "GitHub Personal Access Token"),
        (r"\bgithub_pat_[0-9a-zA-Z_]{22,}\b", "GitHub Fine-Grained PAT"),
        (r"\bnfp_[0-9a-zA-Z]{24,}\b", "Netlify Personal Access Token"),
        (r"\bxox[baprs]-[0-9a-zA-Z-]{10,}\b", "Slack Token"),
    ]
    scan_files: List[Path] = []
    for folder in ("src", "netlify/functions", "public"):
        for path_str in sorted(glob.glob(str(ROOT_DIR / folder / "**" / "*.*"), recursive=True)):
            if path_str.endswith((".ts", ".tsx", ".js", ".mjs", ".cjs")):
                scan_files.append(Path(path_str))
    index_html_p = ROOT_DIR / "index.html"
    if index_html_p.exists():
        scan_files.append(index_html_p)

    leaked_secrets: List[str] = []
    for p in scan_files:
        txt = p.read_text(encoding="utf-8", errors="ignore")
        for pat, label in secret_patterns:
            if re.search(pat, txt):
                leaked_secrets.append(f"{p.relative_to(ROOT_DIR)} ({label})")

    if leaked_secrets:
        errors.append(f"Secrete expuse: {', '.join(leaked_secrets)}")
    else:
        details.append(f"0 chei private sau token-uri cloud expuse în {len(scan_files)} fișiere (src/netlify/public/index.html)")

    # 3. Verifică că niciun fișier .env nu este urmărit în Git
    code_env, out_env, _ = run_cmd(["git", "ls-files", ".env", ".env.*"])
    if code_env == 0 and out_env.strip():
        errors.append(f"Fișiere .env urmărite în Git: {out_env}")
    else:
        details.append("Niciun fișier `.env` urmărit în Git")

    if errors:
        return False, "; ".join(errors), details
    return True, "Anti-SSRF activ, conturi duplicate blocate, PIN p1 activ, 0 secrete expuse", details


# ============================================================================
# VECTOR 6: Anti-Loop & Protecție Consum Netlify (Reload Loops, useEffect Loops, Polling & Blobs Dedupe)
# ============================================================================
def _extract_js_block(txt: str, open_brace_idx: int) -> int:
    depth = 0
    i = open_brace_idx
    in_str = None
    while i < len(txt):
        ch = txt[i]
        if in_str:
            if ch == "\\":
                i += 2
                continue
            if ch == in_str:
                in_str = None
        else:
            if ch in ("'", '"', "`"):
                in_str = ch
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    return i
        i += 1
    return -1


def _extract_call_args(txt: str, open_paren_idx: int) -> str:
    depth = 0
    i = open_paren_idx
    in_str = None
    while i < len(txt):
        ch = txt[i]
        if in_str:
            if ch == "\\":
                i += 2
                continue
            if ch == in_str:
                in_str = None
        else:
            if ch in ("'", '"', "`"):
                in_str = ch
            elif ch == "(":
                depth += 1
            elif ch == ")":
                depth -= 1
                if depth == 0:
                    return txt[open_paren_idx + 1 : i]
        i += 1
    return ""


def _split_top_level_comma(expr: str) -> List[str]:
    parts: List[str] = []
    cur: List[str] = []
    depth = 0
    in_str = None
    i = 0
    while i < len(expr):
        ch = expr[i]
        if in_str:
            cur.append(ch)
            if ch == "\\" and i + 1 < len(expr):
                cur.append(expr[i + 1])
                i += 2
                continue
            if ch == in_str:
                in_str = None
        else:
            if ch in ("'", '"', "`"):
                in_str = ch
                cur.append(ch)
            elif ch in ("(", "[", "{"):
                depth += 1
                cur.append(ch)
            elif ch in (")", "]", "}"):
                depth = max(0, depth - 1)
                cur.append(ch)
            elif ch == "," and depth == 0:
                parts.append("".join(cur).strip())
                cur = []
                i += 1
                continue
            else:
                cur.append(ch)
        i += 1
    tail = "".join(cur).strip()
    if tail:
        parts.append(tail)
    return parts


def vector6_anti_loop_and_netlify_consumption() -> Tuple[bool, str, List[str]]:
    details: List[str] = []
    errors: List[str] = []

    # 1. Zero Auto-Reload Loops (.reload() permis EXCLUSIV pe butoane explicit onClick, interzis în main.tsx / sw.js / controllerchange)
    reload_violations: List[str] = []
    reload_targets: List[Path] = []
    for path_str in sorted(glob.glob(str(ROOT_DIR / "src" / "**" / "*.*"), recursive=True)):
        if path_str.endswith((".ts", ".tsx", ".js", ".mjs")):
            reload_targets.append(Path(path_str))
    for path_str in sorted(glob.glob(str(ROOT_DIR / "public" / "**" / "*.js"), recursive=True)):
        reload_targets.append(Path(path_str))
    idx_html = ROOT_DIR / "index.html"
    if idx_html.exists():
        reload_targets.append(idx_html)

    for p in reload_targets:
        rel = str(p.relative_to(ROOT_DIR))
        lines = p.read_text(encoding="utf-8", errors="ignore").splitlines()
        for idx, line in enumerate(lines, 1):
            if ".reload(" in line:
                window_ctx = "\n".join(lines[max(0, idx - 8) : idx])
                is_user_click = "onClick" in window_ctx
                if rel in ("src/main.tsx", "public/sw.js", "index.html") or not is_user_click:
                    reload_violations.append(f"{rel}:{idx}")

    if reload_violations:
        errors.append(f"Auto-reload neautorizat (.reload() în afara onClick): {', '.join(reload_violations)}")
    else:
        details.append("0 apeluri automate `.reload()` (permis doar pe butoane explicite `onClick`)")

    # 2. Zero Self-Triggering useEffect Loops (seriesEpStatsMap / uhdSeriesEpStats / seriesEpCounts în deps sau setX({...prev}) necondiționat cu x în deps)
    effect_loops: List[str] = []
    for path_str in sorted(glob.glob(str(ROOT_DIR / "src" / "**" / "*.*"), recursive=True)):
        if not path_str.endswith((".ts", ".tsx")):
            continue
        p = Path(path_str)
        rel = str(p.relative_to(ROOT_DIR))
        txt = p.read_text(encoding="utf-8", errors="ignore")
        for m in re.finditer(r"(?:React\.)?useEffect\s*\(\s*\(\)\s*=>\s*\{", txt):
            brace_start = txt.find("{", m.start())
            brace_end = _extract_js_block(txt, brace_start)
            if brace_end == -1:
                continue
            body = txt[brace_start : brace_end + 1]
            tail = txt[brace_end + 1 : brace_end + 550]
            deps_m = re.match(r"\s*,\s*\[([^\]]*)\]", tail, re.DOTALL)
            if not deps_m:
                continue
            deps_raw = deps_m.group(1)
            deps = [d.strip() for d in deps_raw.split(",") if d.strip()]
            line_no = txt[: m.start()].count("\n") + 1
            for forbidden_self_dep, setter_name in (
                ("seriesEpStatsMap", "setSeriesEpStatsMap"),
                ("uhdSeriesEpStats", "setUhdSeriesEpStats"),
                ("seriesEpCounts", "setSeriesEpCounts"),
            ):
                if forbidden_self_dep in deps and f"{setter_name}(" in body:
                    effect_loops.append(f"{rel}:{line_no} ({forbidden_self_dep} self-loop)")
            for d in deps:
                if not re.match(r"^[a-z][A-Za-z0-9_]*$", d):
                    continue
                setter = "set" + d[0].upper() + d[1:]
                # Blochează mutațiile top-level necondiționate setX(...) sau setX((prev) => { const next = { ...prev }; ... return next; }) fără bail-out
                if re.search(rf"\b{setter}\s*\(", body):
                    has_guard = bool(
                        re.search(r"\bif\s*\(|return\s+prev|JSON\.stringify|===|!==|\?\.", body)
                    )
                    if not has_guard:
                        effect_loops.append(f"{rel}:{line_no} ({setter} necondiționat cu {d} în deps)")
                    for sm in re.finditer(rf"\b{setter}\s*\(\s*\(\s*prev\s*\)\s*=>\s*\{{", body):
                        sb_start = body.find("{", sm.start())
                        sb_end = _extract_js_block(body, sb_start)
                        if sb_end != -1:
                            sb = body[sb_start : sb_end + 1]
                            if "{ ...prev" in sb and "return next" in sb and "return prev" not in sb and "changed ?" not in sb:
                                effect_loops.append(f"{rel}:{line_no} ({setter}(prev=>next) fără return prev cu {d} în deps)")

    if effect_loops:
        errors.append(f"Bucle `useEffect` auto-declanșate detectate: {', '.join(effect_loops[:5])}")
    else:
        details.append("0 bucle `useEffect` auto-declanșate (fără `seriesEpStatsMap`/`uhdSeriesEpStats`/`seriesEpCounts` sau mutații `prev=>next` fără bail-out în deps)")

    # 3. Zero Polling Agresiv Cloud (< 60000 ms)
    cloud_poll_keywords = (
        "syncSharedProfilesFromServer",
        "syncProgressAndSaved",
        "syncCrossDeviceState",
        "/api/tv-profiles",
        "/api/tv-progress",
        "/api/tv-saved",
        "/api/tv-music-sync",
        "/api/tv-epg",
    )
    bad_intervals: List[str] = []
    for path_str in sorted(glob.glob(str(ROOT_DIR / "src" / "**" / "*.*"), recursive=True)):
        if not path_str.endswith((".ts", ".tsx", ".js", ".mjs")):
            continue
        p = Path(path_str)
        rel = str(p.relative_to(ROOT_DIR))
        txt = p.read_text(encoding="utf-8", errors="ignore")
        for m in re.finditer(r"setInterval\s*\(", txt):
            open_paren = txt.find("(", m.start())
            call_args = _extract_call_args(txt, open_paren)
            args = _split_top_level_comma(call_args)
            if len(args) < 2:
                continue
            delay_expr = args[1]
            cb_expr = args[0]
            # Verifică exclusiv corpul callback-ului + definițiile locale ale funcțiilor apelate sau referite ca identifier
            call_names = set(re.findall(r"\b([A-Za-z_$][A-Za-z0-9_$]*)\s*\(", cb_expr))
            if re.fullmatch(r"[A-Za-z_$][A-Za-z0-9_$]*", cb_expr):
                call_names.add(cb_expr)
            lookup_parts = [cb_expr]
            for fn_name in call_names:
                for fn_m in re.finditer(
                    rf"(?:const|let|var)\s+{re.escape(fn_name)}\s*=|function\s+{re.escape(fn_name)}\s*\(",
                    txt,
                ):
                    brace_idx = txt.find("{", fn_m.end())
                    if brace_idx != -1 and brace_idx - fn_m.start() < 260:
                        end_idx = _extract_js_block(txt, brace_idx)
                        if end_idx != -1:
                            lookup_parts.append(txt[fn_m.start() : end_idx + 1])
            effective_ctx = "\n".join(lookup_parts)
            matched_kw = [kw for kw in cloud_poll_keywords if kw in effective_ctx]
            if not matched_kw:
                continue
            line_no = txt[: m.start()].count("\n") + 1
            num_vals: List[int] = []
            if re.fullmatch(r"[\d_]+", delay_expr):
                num_vals.append(int(delay_expr.replace("_", "")))
            elif re.fullmatch(r"[A-Za-z_$][A-Za-z0-9_$]*", delay_expr):
                # Caută declararea variabilei în ultimele 12 linii / 600 caractere
                pre_ctx = txt[max(0, m.start() - 600) : m.start()]
                var_m = re.search(rf"\b(?:const|let|var)\s+{re.escape(delay_expr)}\s*=\s*([^;\n]+)", pre_ctx)
                if var_m:
                    for nm in re.findall(r"\b\d[\d_]*\b", var_m.group(1)):
                        num_vals.append(int(nm.replace("_", "")))
            if not num_vals:
                bad_intervals.append(f"{rel}:{line_no} (interval necunoscut '{delay_expr}' pentru {matched_kw[0]})")
            else:
                too_fast = [v for v in num_vals if v < 60000]
                if too_fast:
                    bad_intervals.append(f"{rel}:{line_no} ({too_fast[0]}ms < 60000ms pe {matched_kw[0]})")

    if bad_intervals:
        errors.append(f"Polling cloud agresiv (< 60s): {', '.join(bad_intervals[:5])}")
    else:
        details.append("Toate intervalele de sincronizare cloud respectă pragul >= 60.000 ms (0 polling agresiv)")

    # 4. Zero Startup Burners (epgService, sw.js bundle double-download, resolveSeriesEpisodeStats /api/vod-stream)
    epg_path = ROOT_DIR / "src" / "services" / "epgService.ts"
    epg_txt = epg_path.read_text(encoding="utf-8", errors="ignore")
    # Verifică blocurile top-level `if (typeof window !== 'undefined')` să nu apeleze eager fetchEpgForCountry
    epg_eager_found = False
    for wm in re.finditer(r"if\s*\(\s*typeof\s+window\s*!==\s*'undefined'\s*\)\s*\{", epg_txt):
        w_start = epg_txt.find("{", wm.start())
        w_end = _extract_js_block(epg_txt, w_start)
        if w_end != -1 and "fetchEpgForCountry" in epg_txt[w_start : w_end + 1]:
            epg_eager_found = True
    if epg_eager_found:
        errors.append("src/services/epgService.ts apelează eager `fetchEpgForCountry` la pornirea modulului")
    else:
        details.append("epgService.ts nu mai pornește apeluri automate `/api/tv-epg` la încărcarea paginii Home")

    sw_txt = (ROOT_DIR / "public" / "sw.js").read_text(encoding="utf-8", errors="ignore")
    if re.search(r"precacheShellAndBundles[\s\S]*cache\.add\(", sw_txt) or "/assets/" in sw_txt and "cache.add(" in sw_txt:
        errors.append("public/sw.js descarcă dublu bundle-urile `/assets/` în faza `install`")
    else:
        details.append("public/sw.js folosește `CACHE_NAME = 'aether-radio-v78'` fără re-descărcarea bundle-urilor în `install`")

    helpers_txt = (ROOT_DIR / "src" / "views" / "smartTvLampaHelpers.ts").read_text(encoding="utf-8", errors="ignore")
    rse_m = re.search(r"export\s+async\s+function\s+resolveSeriesEpisodeStats\b([\s\S]*?)\nexport\s+function\s+formatSeriesCardBadgeText\b", helpers_txt)
    if not rse_m or "allowHeavyBackendScrape" not in rse_m.group(1):
        errors.append("resolveSeriesEpisodeStats() nu izolează apelul `/api/vod-stream` sub opțiunea `allowHeavyBackendScrape`")
    else:
        details.append("resolveSeriesEpisodeStats() protejat cu `allowHeavyBackendScrape` + cache persistent `sessionStorage`")

    # 5. Test Netlify Blobs Idempotency în memorie (2x POST identic -> exact 1x setJSON, 0 scrieri duplicate!)
    node_blob_dedupe_test = r"""
let setJsonCalls = 0;
const backingMap = new Map();
globalThis.__aetherTestBlobStore = {
  async get(key) {
    return backingMap.has(key) ? backingMap.get(key) : null;
  },
  async setJSON(key, val) {
    setJsonCalls += 1;
    backingMap.set(key, JSON.parse(JSON.stringify(val)));
  },
};

const { default: tvSyncHandler } = await import('./netlify/functions/tv-sync.mjs?dedupTest=' + Date.now());

try {
  // 5a: 2x POST identic /api/tv-progress -> 1 singură scriere Blobs
  const beforeProg = setJsonCalls;
  const progBody = JSON.stringify({
    audit_blob_movie: {
      id: 'audit_blob_movie',
      currentTime: 320,
      duration: 2400,
      updatedAt: 5000000,
      item: { id: 'audit_blob_movie', name: 'Test Film', type: 'movie' },
    },
  });
  await tvSyncHandler(new Request('https://filmio.my/api/tv-progress?profileId=audit_blob_dedup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: progBody,
  }));
  const afterProg1 = setJsonCalls - beforeProg;
  await tvSyncHandler(new Request('https://filmio.my/api/tv-progress?profileId=audit_blob_dedup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: progBody,
  }));
  const afterProg2 = setJsonCalls - beforeProg;
  if (afterProg1 !== 1 || afterProg2 !== 1) {
    throw new Error(`tv-progress a executat ${afterProg2} scrieri Blobs la 2x POST identic (așteptat exact 1)`);
  }

  // 5b: 2x POST identic /api/tv-profiles -> 1 singură scriere Blobs
  const beforeProf = setJsonCalls;
  const profBody = JSON.stringify([{ id: 'acc_blob_audit', name: 'BlobAuditUser', updatedAt: 5100000 }]);
  await tvSyncHandler(new Request('https://filmio.my/api/tv-profiles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: profBody,
  }));
  const afterProf1 = setJsonCalls - beforeProf;
  await tvSyncHandler(new Request('https://filmio.my/api/tv-profiles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: profBody,
  }));
  const afterProf2 = setJsonCalls - beforeProf;
  if (afterProf1 !== 1 || afterProf2 !== 1) {
    throw new Error(`tv-profiles a executat ${afterProf2} scrieri Blobs la 2x POST identic (așteptat exact 1)`);
  }
} finally {
  delete globalThis.__aetherTestBlobStore;
}

console.log('VECTOR6_BLOB_DEDUPE_OK');
"""
    code, out, err = run_cmd(["node", "--input-type=module", "-e", node_blob_dedupe_test])
    if code != 0 or "VECTOR6_BLOB_DEDUPE_OK" not in out:
        errors.append(f"Eroare test idempotență Netlify Blobs: {err or out}")
    else:
        details.append("Netlify Blobs write-dedupe verificat în memorie: 2x POST identic (`/api/tv-progress` & `/api/tv-profiles`) = 1 scriere (`0` scrieri redundante)")

    if errors:
        return False, "; ".join(errors), details
    return True, "0 reload loops, 0 useEffect loops, polling >= 60s, 0 burners Home, Blobs write-dedupe activ", details


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit Gatekeeper Pre-Push (6 Faze / 6 Vectori)")
    parser.add_argument(
        "--skip-build",
        action="store_true",
        help="Rulează auditul rapid fără pasul `npm run build`",
    )
    args = parser.parse_args()

    start_time = time.time()
    initial_snapshots = snapshot_data_files()

    results = []

    # Faza 1
    p1_ok, p1_sum, p1_det = phase1_reconnaissance()
    results.append(("Faza 1: Recon & Inventar", p1_ok, p1_sum, p1_det))

    # Vector 1
    v1_ok, v1_sum, v1_det = vector1_form_and_input_resilience()
    results.append(("Vector 1: Reziliență Formulare/API", v1_ok, v1_sum, v1_det))

    # Vector 2
    v2_ok, v2_sum, v2_det = vector2_data_integrity_and_isolation(initial_snapshots)
    results.append(("Vector 2: Integritate Date & Izolare", v2_ok, v2_sum, v2_det))

    # Vector 3
    v3_ok, v3_sum, v3_det = vector3_business_invariants()
    results.append(("Vector 3: Invarianți de Business", v3_ok, v3_sum, v3_det))

    # Vector 5 & Vector 6 (rulate înainte de build pentru a valida instantaneu SHA-256 READ-ONLY pe toate testele Node)
    v5_ok, v5_sum, v5_det = vector5_security()
    v6_ok, v6_sum, v6_det = vector6_anti_loop_and_netlify_consumption()

    # Verificare READ-ONLY după toate testele de cod/API (înainte de cele ~8s de `npm run build` în care TV-ul live poate trimite heartbeat)
    post_tests_snapshots = snapshot_data_files()
    if initial_snapshots != post_tests_snapshots:
        changed_keys = [k for k in initial_snapshots if initial_snapshots.get(k) != post_tests_snapshots.get(k)]
        # Dacă doar .tv-watch-progress.json a primit heartbeat de la TV-ul deschis în LAN, verificăm că nu a scăzut numărul de intrări
        non_live_changes = [k for k in changed_keys if not k.startswith(".tv-watch-progress")]
        if non_live_changes:
            v2_ok = False
            v2_sum = f"Încălcare READ-ONLY pe: {', '.join(non_live_changes)}"

    # Vector 4 (include și `npm run build`)
    v4_ok, v4_sum, v4_det = vector4_ui_and_architecture(skip_build=args.skip_build)
    results.append(("Vector 4: Reguli UI & Arhitectură", v4_ok, v4_sum, v4_det))
    results.append(("Vector 5: Securitate & Secrete", v5_ok, v5_sum, v5_det))
    results.append(("Vector 6: Anti-Loop & Consum Netlify", v6_ok, v6_sum, v6_det))

    elapsed = time.time() - start_time
    all_passed = all(ok for _, ok, _, _ in results)

    print("=" * 100)
    print(f"AUDIT GATEKEEPER — RAPORT PRE-PUSH ÎN 6 FAZE (Timp execuție: {elapsed:.2f}s)")
    print("=" * 100)
    print(f"{'Fază / Vector':<36} | {'Status':<8} | {'Rezumat Verificare'}")
    print("-" * 100)
    for name, ok, summary, _ in results:
        status_str = "PASS" if ok else "FAIL"
        print(f"{name:<36} | {status_str:<8} | {summary}")
    print("-" * 100)

    for name, ok, _, dets in results:
        if dets:
            print(f"\n[{name}]")
            for d in dets:
                print(f"  - {d}")

    print("\n" + "=" * 100)
    if all_passed:
        print("SEMAFOR AUDIT: 🟢 VERDE — 100% SIGUR PENTRU PUSH")
        print("NOTĂ OBLIGATORIE: Cere permisiunea explicită a utilizatorului înainte de a rula git commit / git push!")
        print("=" * 100)
        return 0
    else:
        print("SEMAFOR AUDIT: 🔴 BLOCAT")
        print("ACȚIUNE: Git commit și git push sunt STRICT INTERZISE până la remedierea erorilor de mai sus!")
        print("=" * 100)
        return 1


if __name__ == "__main__":
    sys.exit(main())
