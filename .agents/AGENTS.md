# REGULĂ CONTINUĂ — Sincronizare cu alți agenți (Paperclip)

În acest proiect pot lucra și alți agenți (din Paperclip) în afara acestei sesiuni. La începutul FIECĂREI sesiuni sau al fiecărui task, înainte de orice modificare:

1. Rulează `git status`, `git branch -a`, `git log --all --oneline -10` și citește `.agents/CHANGELOG.md`.
2. Dacă există modificări sau commit-uri noi care nu sunt cunoscute în conversația curentă, spune-i utilizatorului exact ce s-a schimbat ÎNAINTE de a continua.
3. Nu suprascrie și nu pierde aceste modificări.
4. După fiecare modificare făcută de tine aici, adaugă o intrare nouă în `.agents/CHANGELOG.md` (data, autor „Antigravity”, ce, de ce, fișiere).

---

# REGULĂ OBLIGATORIE PRE-PUSH — Audit Gatekeeper (6 Faze)

1. **ESTE STRICT INTERZIS** să rulezi `git commit`, `git push` sau `netlify deploy` fără acordul explicit al utilizatorului.
2. Înainte de a propune sau executa orice `git commit` / `git push`, agentul **TREBUIE OBLIGATORIU** să ruleze scriptul de audit:
   ```bash
   python3 .agents/skills/audit-gatekeeper/scripts/run_prepush_audit.py
   ```
   *(sau cu `--skip-build` pentru verificări intermediare rapide).*
3. Agentul are voie să ceară permisiunea utilizatorului pentru `git commit` / `git push` **DOAR** atunci când rezultatul auditului este **`🟢 VERDE — 100% SIGUR PENTRU PUSH`** și toți cei 6 vectori au trecut (inclusiv **Vector 5: Securitate & Anti-SSRF** și **Vector 6: Anti-Loop & Protecție Consum Netlify** — zero bucle de refresh, zero bucle `useEffect`, polling cloud `>= 60s`, fără `.reload()` automat și fără scrieri redundante în `@netlify/blobs`). Dacă verdictul este **`🔴 BLOCAT`**, orice operațiune de commit/push este oprită până la remedierea tuturor vectorilor eșuați.

---

# REGULĂ PERMANENTĂ DE CODARE — Karpathy Guidelines (`multica-ai/andrej-karpathy-skills`)

Regula completă se află în `.agents/rules/karpathy-guidelines.md` (activă permanent pentru Antigravity și Paperclip):

1. **Think Before Coding:** Nu face presupuneri tăcute. Dacă ceva e neclar sau are mai multe interpretări, oprește-te și întreabă; semnalează compromisurile.
2. **Simplicity First:** Scrie minimul de cod necesar pentru cerință. Fără funcționalități necerute, abstracții speculative sau supra-inginerie.
3. **Surgical Changes:** Modifică strict liniile legate direct de cerința utilizatorului. Nu refactoriza, nu reformata și nu „îmbunătăți” cod adiacent care funcționează. Curăță doar importurile/variabilele rămase orfane din propriile modificări.
4. **Goal-Driven Execution:** Transformă task-ul într-un criteriu clar de verificare și validează rezultatul cap-coadă înainte să îl declari rezolvat.

---

# SKILL-URI ACTIVE ÎN PROIECT (`.agents/skills/` — Antigravity & Paperclip)

Pe lângă `audit-gatekeeper`, în `.agents/skills/` sunt instalate următoarele skill-uri obligatorii pe contextul lor:

1. **`systematic-debugging`** (`.agents/skills/systematic-debugging/SKILL.md`, din `obra/superpowers`): **Fără patch-uri „la ghici”**. La orice bug, crash, blocaj de redare video sau regresie, investighează mai întâi cauza rădăcină (loguri + reproducere) înainte de a propune sau aplica o modificare.
2. **`verification-before-completion`** (`.agents/skills/verification-before-completion/SKILL.md`, din `obra/superpowers`): **Dovadă înainte de afirmații**. Nu declara nimic „rezolvat” sau „funcțional” fără să rulezi o verificare proaspătă **după ultima modificare** și să citești output-ul complet.
3. **`web-design-guidelines`** (`.agents/skills/web-design-guidelines/SKILL.md` + `references/command.md`, din `vercel-labs/agent-skills`): Checklist UI/CSS/Safari iOS/iPadOS (ex. `font-size >= 16px` pe `<input>`, `min-width: 0`, `tabular-nums`, `touch-action: manipulation`, safe-areas, ținte tactile `>= 44×44px`).
4. **`webapp-testing`** (`.agents/skills/webapp-testing/SKILL.md`, din `anthropics/skills`): Testare headless reală cu Playwright (fără a depinde de Chrome-ul personal). Pentru verificări rapide multi-ecran pe Filmio (`iPhone 390×844`, `iPad Landscape 1180×820`, `Smart TV 1920×1080`), rulează:
   ```bash
   python3 .agents/skills/webapp-testing/scripts/verify_filmio_viewports.py
   ```
5. **`apple-design`** (`.agents/skills/apple-design/SKILL.md`, din `dickwu/apple-design-skill`): Audit și design UI/UX bazat pe Apple HIG 2026 (iOS, iPadOS, macOS, tvOS, Liquid Glass, accesibilitate).
6. **`frontend-design`** (`.agents/skills/frontend-design/SKILL.md`, din `anthropics/skills`): Direcție vizuală distinctivă, tipografie și compoziție intenționată pentru ecrane/componente noi (fără aspect generic de template AI).
7. **`improve-codebase-architecture`** (`.agents/skills/improve-codebase-architecture/SKILL.md`, din `mattpocock/skills`): Scanare arhitecturală pentru identificarea modulelor adânci/testabile (ex. spargere treptată și sigură din `SmartTvLampaViewCore.tsx` / `VodNativeHlsPlayer.tsx` / `filelistServer.ts`).
8. **`code-review`** (`.agents/skills/code-review/SKILL.md`, din `mattpocock/skills`): Review pe 2 axe în paralel (conformitate cu regulile proiectului + conformitate cu cerința exactă) înainte de commit-uri/refactorizări mari.
9. **`tdd`** (`.agents/skills/tdd/SKILL.md`, din `mattpocock/skills`): Dezvoltare red → green → refactor pentru bug-uri critice și reguli de business (scrii mai întâi testul care reproduce bug-ul, apoi fix-ul).



