# LoHop — Teammate & Agent Handoff (June 2026)

**Read this first** if you are joining with an AI coding agent. It captures product intent, repo reality, known pitfalls from live debugging, and a deliberate scope cut for the hackathon.

**Primary branch:** `main`  
**Product name:** **LoHop** (Human-in-the-loop open-loop assistant)

---

## 1. What we are building (one paragraph)

Clinicians lose patients in the gap between **information** and **action** — labs that nobody reviewed, referrals with no reply, billing that never reconciled. LoHop **detects** these open loops from FHIR, **ranks** them, lets the clinician **run a workflow** (building blocks / React Flow steps) to **draft** the next action, and **approve** write-back to the chart. For the hackathon demo we embed the **real CDS Hooks Sandbox** (fake EMR) in our page and show LoHop in a **side panel on the same screen** — not a separate tab.

---

## 2. The hard problem: two parallel frontends

We literally have **two frontends** in flight. This is the merge conflict your teammate is resolving.

| Track | Location | Approach |
|-------|----------|----------|
| **A — Embed sandbox (Vishnu / main)** | `patient-workflow-visualization/` (Next.js) | `/sandbox` iframes `sandbox.cds-hooks.org` + LoHop `/embed` side panel. CDS Hooks card links stay in-page via `/embed-bridge` + `localStorage`. |
| **B — Standalone app (other teammate)** | `origin/prototype3` → `my-react-app/` (Vite + React) | Separate dashboard UI, own `backend/` layout. **Not** the sandbox embed model. |

### Merge guidance (for the person resolving conflicts)

**Do not try to run both UIs as equals.** Pick one shell for the demo:

1. **Keep `main` as source of truth** for:
   - `backend/` (FastAPI loop detection, draft, approve, playbooks)
   - `cds-ai-service/` (CDS Hooks webhook)
   - `patient-workflow-visualization/` (sandbox embed + workflow modal)
   - `scripts/start-stack.sh`, `scripts/tunnel.sh`
   - `data/inject_loops.py`, `infra/` (local FHIR)

2. **Cherry-pick from `prototype3` / `my-react-app`** only what improves LoHop:
   - Visual polish (dashboard layout, typography, hero)
   - Any reusable React components **if** they port cleanly to Next.js
   - **Do not** duplicate backend logic from `prototype3/backend/` — `main/backend/` is more complete (detectors, write-back, eval, CDS follow-up task)

3. **After merge, delete or archive** the unused duplicate (`my-react-app/` or redundant backend) so the next agent is not confused.

4. **Single public URL:** Cloudflare tunnel → Next.js `:3000` only. CDS discovery at `{tunnel}/cds-services`, FHIR proxy at `{tunnel}/fhir/*`, Loop API at `{tunnel}/api/*`.

---

## 3. Architecture (how the pieces connect)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  /sandbox  (Next.js page — SAME browser tab)                            │
│  ┌──────────────────────────────┐  ┌──────────────────────────────────┐ │
│  │ iframe: sandbox.cds-hooks.org │  │ iframe: /embed?patientId=…      │ │
│  │  • FHIR: lohp.ryanbeland.dev  │  │  • Issue list (LoHop panel)     │ │
│  │  • Discovery: {tunnel}/cds-   │  │  • Click issue → workflow modal │ │
│  │    services                   │  │  • draft / approve → backend      │ │
│  │  • Fires patient-view hook ───┼──┼──► CDS card + suggestions       │ │
│  └──────────────────────────────┘  └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
         │ POST hook                              ▲
         ▼                                          │ GET /api/loops?patient=
┌─────────────────────┐                    ┌─────────────────────┐
│ cds-ai-service :8000 │ ──optional───────► │ backend :8010        │
│ CDS Hooks JSON in/out│   LOOP_BACKEND_URL │ FHIR detect/rank     │
│ /feedback for tasks  │                    │ draft/approve/write  │
└─────────────────────┘                    └──────────┬──────────┘
                                                      │
                                                      ▼
                                           lohp FHIR (read-only demo)
                                           or local HAPI + Synthea
```

### Three interfaces to understand

| Interface | Protocol | Purpose |
|-----------|----------|---------|
| **CDS Hooks** (`cds-ai-service`) | JSON webhook `patient-view` + `/feedback` | Sandbox EMR triggers cards; "Create follow-up review task" suggestion creates a Task |
| **FHIR** | REST R4 | Read patient data for detection; write Task/Communication on approve |
| **Loop REST API** (`backend`) | `/api/loops`, `/api/loops/{id}/draft`, `/approve` | Powers the side panel and workflow runner |

The sandbox EMR **does not call our Loop API directly**. Flow is: sandbox → CDS hook → (optional) backend → user sees issues in **our** embed iframe.

---

## 4. What works on `main` today (verified)

| Feature | Status | Notes |
|---------|--------|-------|
| `/sandbox` embed layout | ✅ | Real CDS Sandbox left, LoHop `/embed` right |
| Hide/show panel | ✅ | URL `?panel=0`; works without JS via link navigation |
| CDS card "Open Loop assistant" | ✅ | `/embed-bridge` → `localStorage` broadcast → sandbox updates iframe in-place |
| Issue list in embed | ✅ | Static demo issues for sandbox patient; background `fetchLoops` when backend fast enough |
| Workflow modal | 🟡 | `WorkflowRunner` building-blocks UI exists; draft/approve wired; **sandbox sample IDs (`sb-afton-*`) are not real backend loop IDs** |
| CDS "Create follow-up review task" | ✅ | `/feedback` endpoint + `backend/app/cds_followup.py`; lohp FHIR read-only → demo fallback writes `data/cds_tasks.json` |
| Production tunnel | ✅ | **Must** use `npm run build && start`, not `next dev` — see §6 |
| Live FHIR loops on lohp | 🟡 | Slow/timeouts; prefetch from sandbox returns **405** (lohp rejects POST `_search`) |
| CDS card grounded in real loops | ❌ | Card text still mostly LLM; not yet calling `GET /api/loops?patient=` |

**Demo patient:** `b61008f3-84e2-8e3f-abd9-995a23133d57` (Afton Greenholt on lohp)

**Start:**
```bash
./scripts/start-stack.sh    # production Next.js by default
./scripts/tunnel.sh         # separate terminal; uses 127.0.0.1:3000
./scripts/sandbox-url.sh    # prints sandbox URL with discovery endpoint
```

---

## 5. Known pitfalls (save hours of debugging)

### 5.1 Tunnel + `next dev` = broken UI

Cloudflare quick tunnels **cannot proxy** Next.js HMR WebSockets. Symptom: `webpack-hmr` errors in console, **clicks do nothing**, hide panel stuck.

**Fix:** Production only through tunnel. `start-stack.sh` defaults to build+start. `tunnel.sh` auto-kills dev server. Verify:

```bash
curl -s http://127.0.0.1:3000/sandbox | grep -E 'webpack-hmr|browser_dev_hmr' && echo BAD || echo OK
```

### 5.2 502 Bad Gateway during restarts

When `start-stack.sh` kills `:3000` to rebuild, the tunnel shows **502** for 1–2 minutes. Wait for `Stack is up` before sharing the URL.

### 5.3 FHIR prefetch 405 in sandbox console

Sandbox POSTs to `https://lohp.ryanbeland.dev/fhir/Observation/_search` etc. Server returns **405**. Hooks still fire; prefetch is empty. **Harmless for demo** but weakens CDS card context.

### 5.4 lohp FHIR is read-only

`POST /Task` → 405. Approve/write-back and CDS follow-up task use **local demo fallback** (`data/cds_tasks.json`). For real write-back demo, use **local HAPI** (`infra/docker-compose.yml`).

### 5.5 Two kinds of issue IDs

| ID source | Example | Works with `POST /api/loops/{id}/draft`? |
|-----------|---------|------------------------------------------|
| Sandbox static | `sb-afton-a1c` | ❌ 404 — demo-only |
| Backend detector | UUID from `GET /api/loops` | ✅ |

Workflow runner shows **demo mode** when `issue.loopId` is missing.

### 5.6 CDS feedback JSON shape

Sandbox sends spec-compliant feedback (array), not a flat object:

```json
{
  "feedback": [{
    "card": "<card-uuid-from-hook-response>",
    "outcome": "accepted",
    "acceptedSuggestions": [{ "id": "create-followup-review-task" }],
    "outcomeTimestamp": "2026-06-20T12:00:00Z"
  }]
}
```

Cards **must** include `uuid` or sandbox never sends feedback. Context is cached server-side by card uuid (`cds-ai-service/main.py`).

---

## 6. The events problem — why simulation is hard

**Data ≠ events.** We have FHIR **snapshots** (Patient, Observation, ServiceRequest) but open loops are really **stories over time**:

- Appointment completed → lab ordered → result arrived → **nobody acknowledged** ← loop
- Referral sent → 10 days → **no reply** ← loop
- Claim submitted → rejected → **not reconciled** ← loop

The CDS Sandbox only gives us a **patient-view** moment. It does not simulate the passage of time or new results arriving. lohp FHIR is a static-ish public server — we cannot inject events there.

### Hackathon decision: **pick ONE loop type and nail it**

| Option | Demo strength | Simulation path |
|--------|---------------|-----------------|
| **Abnormal lab, nobody acknowledged** ⭐ | Highest clinical drama | `data/inject_loops.py` on local HAPI; detector `detect_abnormal_unacked` |
| Ordered, not resulted | Good | Inject old ServiceRequest, no Observation |
| Referral no response | Good | Inject ServiceRequest + old date |
| Billing unreconciled | Money story | Inject Claim with extensions |

**Recommendation:** **Abnormal unacked lab** for the “patient safety” beat; keep billing as stretch.

**Two demo modes (both valid):**

1. **CDS Sandbox + lohp** — polished integration story, **static** issues in `lib/sandbox-data.ts`, workflow in demo mode.
2. **Local HAPI + Synthea** — real detection, real loop IDs, real draft/approve — show on `/embed?patientId={hapi-id}&source=cds-hooks` or ClinicOS `/`.

Do **not** block the sandbox demo on solving full event simulation this weekend.

---

## 7. What to build next (prioritized)

### For merge teammate (conflict resolution)

- [ ] Resolve `prototype3` vs `main`; keep one frontend shell (Next.js embed path recommended for CDS demo)
- [ ] Ensure `my-react-app` assets either ported or removed — no duplicate `backend/`
- [ ] Confirm `main` builds: `cd patient-workflow-visualization && npm run build`
- [ ] Run `cds-ai-service/test-cds.sh http://127.0.0.1:3000`

### For integration agent (after merge)

**P1 — Wire CDS card to real loops** (`cds-ai-service/main.py`)

```python
# On patient-view hook:
# GET {LOOP_BACKEND_URL}/api/loops?patient={patientId}
# summary = f"{n} open loops — review in LoHop"
# detail = top 2 loop titles (Vertex may polish, but must cite real list)
```

**P2 — Live loops in embed** (partially done)

- `fetchLoops` + `map-loops.ts` exist in `embed-loop.tsx`
- Add patient-scoped cache in backend (60s) if lohp is slow
- Fallback: keep `sandbox-data.ts` for demo patient only

**P3 — End-to-end workflow on ONE real loop**

- Local HAPI patient with injected abnormal lab
- Click issue → `WorkflowRunner` → draft → approve → verify Task in HAPI
- Map `Issue.loopId` from API (not `sb-afton-*`)

**P4 — Polish**

- Playbooks from `GET /api/playbooks?loop_type=` (frontend still has hardcoded `lib/workflows.ts` fallback)
- Playwright smoke test for `/sandbox`

See also `docs/NEXT_AGENT_SPEC.md` for file-level task breakdown.

---

## 8. What Vishnu can do **while merge is in progress**

These tasks **do not depend** on the other frontend landing:

| Task | Why |
|------|-----|
| **Local HAPI demo path** | `docker compose up` in `infra/`, `load_synthea.py`, `inject_loops.py`, point `backend/.env` `FHIR_BASE=http://localhost:8080/fhir` |
| **One patient E2E script** | Document patient ID + curl draft/approve; proves workflow without sandbox |
| **CDS card ← backend loops** | Small change in `cds-ai-service/main.py`; big demo credibility win |
| **Event narrative doc** | 1-page clinician script: what happened before patient-view (for judges) |
| **Synthea CSV → story** | `synthea_sample_data_csv_latest/` is in repo — pick one patient row, write the “abnormal K+” story for pitch |
| **Do not** fight sandbox FHIR prefetch | Out of scope unless we host a POST-capable FHIR proxy |

---

## 9. Key files (agent quick reference)

| Path | Role |
|------|------|
| `patient-workflow-visualization/components/sandbox-shell.tsx` | Sandbox iframe + LoHop panel layout |
| `patient-workflow-visualization/components/embed-loop.tsx` | Issue list, `fetchLoops`, workflow URL `?loop=` |
| `patient-workflow-visualization/components/embed-bridge.tsx` | CDS card click → update sandbox without new tab |
| `patient-workflow-visualization/components/workflow/workflow-runner.tsx` | Building-blocks workflow, draft/approve |
| `patient-workflow-visualization/lib/sandbox-data.ts` | Static demo issues (not backend IDs) |
| `patient-workflow-visualization/lib/map-loops.ts` | Backend loop → Issue |
| `patient-workflow-visualization/next.config.mjs` | Proxy `/cds-services`, `/api`, `/fhir` |
| `cds-ai-service/main.py` | Hooks, feedback, card uuid cache |
| `backend/app/detectors.py` | Deterministic open-loop rules |
| `backend/app/cds_followup.py` | CDS suggestion → Task |
| `data/inject_loops.py` | Plant known loops for eval/demo |
| `scripts/start-stack.sh` | Orchestration (production default) |
| `scripts/tunnel.sh` | Cloudflare; forces production |

---

## 10. Environment

```bash
# backend/.env
FHIR_BASE=https://lohp.ryanbeland.dev/fhir   # or http://localhost:8080/fhir for local
LLM_PROVIDER=vertex
GOOGLE_CLOUD_PROJECT=...

# cds-ai-service/.env
LOOP_BACKEND_URL=http://localhost:8010
LOOP_APP_URL=https://<your-tunnel>.trycloudflare.com
LLM_PROVIDER=vertex
```

```bash
# Smoke test
cds-ai-service/test-cds.sh http://127.0.0.1:3000 triage-assistant b61008f3-84e2-8e3f-abd9-995a23133d57
```

---

## 11. Non-goals this weekend

- Full event stream / FHIR subscriptions
- Simulating appointments, insurance forms, physio referrals in sandbox
- Replacing lohp production CDS
- SMART on FHIR launch (query-param `patientId` is fine)
- Running two competing frontends in production

---

## 12. 20-second demo script (embed path)

1. Open `{tunnel}/sandbox?patientId=b61008f3-…` — sandbox EMR left, LoHop right.
2. Patient view fires → CDS card: open loops / follow-up suggestion.
3. Click **Open Loop assistant** — panel highlights patient (same page).
4. Click top issue → workflow modal → building blocks → draft → approve.
5. Optional: accept **Create follow-up review task** on CDS card → confirmation card.

---

*Last updated: 2026-06-20 after CDS feedback fix, production tunnel hardening, and sandbox embed integration on `main`.*
