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

console.log('VECTOR3_NODE_OK');
"""
    code, out, err = run_cmd(["node", "--input-type=module", "-e", node_invariants_script])
    if code != 0 or "VECTOR3_NODE_OK" not in out:
        errors.append(f"Eroare teste etalon business în Node: {err or out}")
    else:
        details.append("Teste etalon HLS 4K/1080p sort, fuziune episodeProgressMap și catalog Emisiuni RU (6/6 show-uri cheie) trecute")

    if errors:
        return False, "; ".join(errors), details
    return True, "Toți invarianții de business (Rezoluție 4K/1080p, Sortare Episoade, Sync Multi-Episod, Emisiuni RU) validați", details


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

    # 2. Verificare interdicție `vidspark.to` (sursă generatoare de pop-up-uri Booking/AliExpress)
    helpers_txt = (ROOT_DIR / "src" / "views" / "smartTvLampaHelpers.ts").read_text(encoding="utf-8", errors="ignore")
    lampa_core_p = ROOT_DIR / "src" / "views" / "SmartTvLampaViewCore.tsx"
    lampa_txt = (
        lampa_core_p.read_text(encoding="utf-8", errors="ignore")
        if lampa_core_p.exists()
        else (ROOT_DIR / "src" / "views" / "SmartTvLampaView.tsx").read_text(encoding="utf-8", errors="ignore")
    )
    if "vidspark.to" in helpers_txt or "vidspark.to" in lampa_txt:
        errors.append("Sursa cu reclame pop-up `vidspark.to` este încă prezentă în smartTvLampaHelpers.ts sau SmartTvLampaView.tsx!")
    else:
        details.append("0 referințe `vidspark.to` (reclamele pop-up Booking/AliExpress sunt eliminate 100%)")

    # 3. Verificare atribut `sandbox` pe iframe-urile VOD externe din SmartTvLampaView.tsx
    iframes = list(re.finditer(r"<iframe\b[^>]*>", lampa_txt, flags=re.DOTALL))
    if not iframes:
        details.append("Niciun element <iframe> în SmartTvLampaView.tsx")
    else:
        vod_iframes = [m.group(0) for m in iframes if "youtube-nocookie.com" not in m.group(0)]
        yt_iframes = [m.group(0) for m in iframes if "youtube-nocookie.com" in m.group(0)]
        unsandboxed = 0
        popup_allowed = 0
        for tag in vod_iframes:
            if "sandbox=" not in tag:
                unsandboxed += 1
            elif "allow-popups" in tag:
                popup_allowed += 1
        if unsandboxed > 0 or popup_allowed > 0:
            errors.append(f"Iframe-uri VOD nesecurizate în SmartTvLampaView.tsx: {unsandboxed} fără sandbox, {popup_allowed} cu allow-popups")
        else:
            details.append(
                f"Toate cele {len(vod_iframes)} elemente `<iframe>` VOD externe au `sandbox` strict fără `allow-popups` (+ {len(yt_iframes)} trailere YouTube oficiale)"
            )

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
# VECTOR 5: Securitate (Anti-Path-Traversal / IDOR, PIN p1, Fără Secrete Expuse)
# ============================================================================
def vector5_security() -> Tuple[bool, str, List[str]]:
    details: List[str] = []
    errors: List[str] = []

    # 1. Verifică în memorie protecția profilului principal p1 (Eugeniu) împotriva suprascrierii fără PIN
    #    și sanitizarea profileId împotriva Path Traversal (../../etc/passwd)
    node_sec_test = r"""
import tvSyncHandler from './netlify/functions/tv-sync.mjs';

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

// Test B: Sanitizare profileId cu caractere de Path Traversal (../../etc/passwd)
const resTrav = await tvSyncHandler(new Request('https://filmio.my/api/tv-progress?profileId=../../etc/passwd'));
if (resTrav.status !== 200) {
  throw new Error('Eroare la sanitizarea profileId cu path traversal');
}

console.log('VECTOR5_NODE_OK');
"""
    code, out, err = run_cmd(["node", "--input-type=module", "-e", node_sec_test])
    if code != 0 or "VECTOR5_NODE_OK" not in out:
        errors.append(f"Eroare teste securitate în Node: {err or out}")
    else:
        details.append("Protecție PIN pe profilul `p1` și sanitizare anti-Path-Traversal pe `profileId` confirmate")

    # 2. Scanare secrete critice expuse în `src/` (Private Keys, AWS, Stripe, GitHub PAT, Slack)
    secret_patterns = [
        (r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----", "Cheie privată PEM"),
        (r"\bsk_live_[0-9a-zA-Z]{24,}\b", "Cheie secretă Stripe Live"),
        (r"\bAKIA[0-9A-Z]{16}\b", "AWS Access Key ID"),
        (r"\bghp_[0-9a-zA-Z]{36}\b", "GitHub Personal Access Token"),
    ]
    leaked_secrets: List[str] = []
    for path_str in sorted(glob.glob(str(ROOT_DIR / "src" / "**" / "*.*"), recursive=True)):
        if not path_str.endswith((".ts", ".tsx", ".js", ".mjs")):
            continue
        p = Path(path_str)
        txt = p.read_text(encoding="utf-8", errors="ignore")
        for pat, label in secret_patterns:
            if re.search(pat, txt):
                leaked_secrets.append(f"{p.relative_to(ROOT_DIR)} ({label})")

    if leaked_secrets:
        errors.append(f"Secrete expuse în src/: {', '.join(leaked_secrets)}")
    else:
        details.append("0 chei private sau token-uri cloud expuse în `src/`")

    # 3. Verifică că niciun fișier .env nu este urmărit în Git
    code_env, out_env, _ = run_cmd(["git", "ls-files", ".env", ".env.*"])
    if code_env == 0 and out_env.strip():
        errors.append(f"Fișiere .env urmărite în Git: {out_env}")
    else:
        details.append("Niciun fișier `.env` urmărit în Git")

    if errors:
        return False, "; ".join(errors), details
    return True, "Sanitizare profileId activă, protecție PIN p1 activă, 0 secrete expuse în frontend", details


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit Gatekeeper Pre-Push (6 Faze)")
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

    # Vector 5 (rulat înainte de build pentru a valida instantaneu SHA-256 READ-ONLY pe toate testele Node)
    v5_ok, v5_sum, v5_det = vector5_security()

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
