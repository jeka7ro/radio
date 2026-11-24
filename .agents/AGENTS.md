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


