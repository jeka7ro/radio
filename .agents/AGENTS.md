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
3. Agentul are voie să ceară permisiunea utilizatorului pentru `git commit` / `git push` **DOAR** atunci când rezultatul auditului este **`🟢 VERDE — 100% SIGUR PENTRU PUSH`**. Dacă verdictul este **`🔴 BLOCAT`**, orice operațiune de commit/push este oprită până la remedierea tuturor vectorilor eșuați.


