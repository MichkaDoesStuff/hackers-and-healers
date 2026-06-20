# LoHop — Next Agent Handoff Spec

**Branch:** `main` (integration branch)  
**Product name:** **LoHop** — Human-in-the-loop clinical open-loop assistant (`Lo` + emphasized `H` + `op`).

> **Start here for full context:** [`docs/TEAMMATE_AGENT_HANDOFF.md`](./TEAMMATE_AGENT_HANDOFF.md) — product vision, two-frontend merge situation, events vs data, tunnel pitfalls, and who does what next.

This document is the **file-level task list** for the next agent to make LoHop work end-to-end: webhooks → FHIR → workflow modal.

---

## Current state (what works)

| Area | Status | Notes |
|------|--------|-------|
| CDS Sandbox embed workaround | ✅ | `/sandbox` iframes real sandbox + LoHop `/embed`; card links → `/embed-bridge` → `localStorage` |
| LoHop side panel UI | ✅ | Flat list rows, LoHop branding, hide/show panel (`?panel=0`) |
| CDS Hooks service | ✅ | `cds-ai-service/` on `:8000` — discovery + `patient-view` hooks + `/feedback` |
| CDS follow-up task suggestion | ✅ | Spec-compliant feedback; demo Task fallback when lohp read-only |
| Loop backend API | ✅ | `backend/` on `:8010` — detect, rank, draft, approve, playbooks |
| Vertex Gemini (CDS + draft) | ✅ | `LLM_PROVIDER=vertex` + ADC; see `scripts/setup-gcloud-vertex.sh` |
| Next.js proxy | ✅ | `/cds-services` → `:8000`, `/api/*` → `:8010`, `/fhir/*` → lohp FHIR |
| Production tunnel | ✅ | `start-stack.sh` + `tunnel.sh`; **never** tunnel `next dev` |
| Workflow modal UI | 🟡 | `WorkflowRunner` building-blocks; draft/approve wired; sandbox IDs are demo-only |
| Live FHIR loops in embed | 🟡 | `fetchLoops` exists; lohp slow; sandbox uses static `sandbox-data.ts` |
| Webhook → live loops | ❌ | CDS card text is LLM-only; not wired to `GET /api/loops?patient=` |
| Playbooks from backend | 🟡 | API exists; frontend falls back to `lib/workflows.ts` |

**Start stack:** `./scripts/start-stack.sh` (8010 + 8000 + production 3000). Tunnel: `./scripts/tunnel.sh` (separate terminal).

**Demo patient (sandbox):** `b61008f3-84e2-8e3f-abd9-995a23133d57` (Afton Greenholt).

---

## Architecture (target)

```
CDS Sandbox / EHR
  │  POST patient-view hook
  ▼
cds-ai-service (:8000)          ← webhook entry (CDS Hooks JSON in/out)
  │  optional: call backend for loop count + summary
  │  card link → /embed-bridge or /embed
  ▼
Next.js (:3000) /embed
  │  GET /api/loops?patient=…   (preferred: fast, scoped)
  │  or GET /api/clinic         (slow on lohp — avoid for embed)
  ▼
backend (:8010)
  │  FHIR read (lohp or local HAPI)
  │  deterministic detect + rank
  ▼
User clicks issue → WorkflowOverlay
  │  GET /api/playbooks?loop_type=…
  │  POST /api/loops/{id}/draft
  │  clinician edits → POST /api/loops/{id}/approve
  ▼
FHIR write-back (Task + CommunicationRequest + Provenance)
```

---

## Priority 1 — Webhook / CDS Hooks integration

**Goal:** When the sandbox fires `patient-view`, the CDS card reflects **real detected loops**, not generic LLM fluff.

### Tasks

1. **In `cds-ai-service/main.py`**, after receiving the hook:
   - Extract `patientId` from `context`.
   - HTTP call to Loop backend: `GET http://localhost:8010/api/loops?patient={id}` (or via env `LOOP_BACKEND_URL`).
   - Build CDS card from results:
     - `summary`: e.g. `"3 open loops — review in LoHop"`
     - `detail`: bullet list of top 2 loop titles + bands (or Vertex summary **grounded in** loop list).
   - Keep `links[0].url` → `build_loop_bridge_url()` for sandbox shell compatibility.

2. **Prefetch usage:** Parse `prefetch.patient`, `observations`, etc. from the hook payload and pass into LLM context **and/or** forward to backend (future). Today backend re-reads FHIR; prefetch can reduce latency later.

3. **Env vars** (add to `cds-ai-service/.env`):
   ```env
   LOOP_BACKEND_URL=http://localhost:8010
   LLM_PROVIDER=vertex
   GOOGLE_CLOUD_PROJECT=...
   LOOP_APP_URL=https://<tunnel>
   ```

4. **Failure modes:** If backend unreachable, fall back to current `demo_fallback()` — never return empty CDS response.

5. **Tests:** Extend `cds-ai-service/test-cds.sh` to assert card mentions loop count when backend is up.

### Acceptance criteria

- [ ] Sandbox patient-view shows CDS card with loop count matching `GET /api/loops?patient=…`
- [ ] Clicking card still updates LoHop panel via embed-bridge
- [ ] Works through tunnel (single public URL on `:3000`)

---

## Priority 2 — FHIR integration (embed + backend)

**Goal:** LoHop panel shows **live detected loops** for the chart patient, not only `lib/sandbox-data.ts`.

### Problem

- `FHIR_BASE` in `backend/.env` points at `https://lohp.ryanbeland.dev/fhir` — full clinic scan is **>90s**.
- Embed calls `fetchClinic()` which hits `/api/clinic` (whole population) — wrong for scoped embed.

### Tasks

1. **Add frontend API helper** in `lib/api.ts`:
   ```ts
   fetchLoops(patientId: string): Promise<{ open: number; loops: LoopCard[] }>
   ```
   → `GET /api/loops?patient={id}`

2. **Map backend loop → frontend `Issue`** (new `lib/map-loops.ts`):
   - `loop.id` → `issue.id`
   - `loop.band` → `severity` (`critical` | `warning` | `routine`)
   - `loop.title`, `loop.subtitle`, `loop.detected_days_ago`, etc.

3. **Update `embed-loop.tsx`:**
   - Prefer `fetchLoops(patientId)` over `fetchClinic()`.
   - Keep `sandboxIssuesForPatient()` as demo fallback for sandbox test patient only.
   - Show loading / error states clearly.

4. **Backend performance (pick one for hackathon):**
   - **Option A (recommended):** Cache `/api/loops` per patient 60s in memory.
   - **Option B:** Limit detectors to single-patient queries only when `?patient=` set (audit `backend/app/detectors.py`).
   - **Option C:** Local HAPI + Synthea for demos (`infra/docker-compose.yml`, `data/load_synthea.py`).

5. **Align IDs:** Sandbox uses UUID patients on lohp; backend loop `patient_id` must match FHIR `Patient.id` for approve/write-back.

### Acceptance criteria

- [ ] `/embed?patientId=b61008f3-…` loads issues from API within 15s (or shows explicit error)
- [ ] ClinicOS `/` still uses `/api/clinic` or switch to paginated loops — document choice
- [ ] `GET /health` shows `fhir: true`

---

## Priority 3 — Workflow modal (mechanism)

**Goal:** Clicking an issue → **Run workflow** drafts text, shows approval gate, writes back on approve.

### Current gaps

- `WorkflowOverlay` — "Run workflow" button has **no handler**.
- `draftLoopMessage()` posts wrong body; backend returns `{ draft, model, loop_id }` not `{ text }`.
- Issue IDs in sandbox sample (`sb-afton-a1c`) **don't exist** in backend — workflow API calls will 404 unless using live loops.
- Playbooks: backend has `GET /api/playbooks?loop_type=`; frontend ignores them.

### Tasks

1. **Fix `lib/api.ts`:**
   ```ts
   export async function draftLoop(loopId: string, playbookId?: string) {
     const res = await fetch(`${API_BASE}/api/loops/${loopId}/draft`, {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ playbook_id: playbookId ?? undefined }),
     })
     return res.json() as { draft: string; model: string; loop_id: string }
   }

   export async function approveLoop(loopId: string, body: { message?: string; playbook_id?: string; approver?: string }) {
     const res = await fetch(`${API_BASE}/api/loops/${loopId}/approve`, { method: "POST", ... })
     return res.json()
   }

   export async function fetchPlaybooks(loopType?: string) { ... }
   ```

2. **Map `Issue.category` → backend `loop_type`:**
   | Issue category | loop_type |
   |----------------|-----------|
   | lab | abnormal_result |
   | follow-up | ordered_not_resulted |
   | referral | referral_no_response |
   | billing | billing_unreconciled |
   | medication | abnormal_result (or extend backend) |

   Store backend `loop_id` on `Issue` when mapping from API (add optional `loopId` field to type).

3. **WorkflowOverlay state machine:**
   ```
   idle → running (POST draft) → preview (show draft in panel) → approving → done | error
   ```
   - Replace or supplement React Flow canvas with a **step runner** for hackathon MVP:
     - Step 1: Show detected context (read-only)
     - Step 2: AI draft (editable textarea)
     - Step 3: Approve button → `POST approve` → show `written` FHIR resources
   - Keep React Flow as visual playbook editor for v2; wire `buildWorkflow(issue)` to `GET /api/playbooks/{id}` when available.

4. **Draft step node:** When user clicks a `draft` node in canvas, call `draftLoop` with that node's `prompt` (via playbook).

5. **Human-in-the-loop gate:** Disable approve until user checks "I reviewed this draft" (matches LoHop brand).

6. **Compact embed mode:** Workflow overlay is full-screen in iframe — ensure footer buttons visible, test Escape to close.

### Acceptance criteria

- [ ] Open live loop from API → Run workflow → draft appears (Vertex or fallback)
- [ ] Approve writes back (check backend logs or FHIR Task on lohp/local HAPI)
- [ ] Sandbox sample issues show friendly message if `loop_id` missing: "Connect live detection to run workflow"

---

## Priority 4 — Polish & ops (lower priority)

- Rebrand remaining "Loop" strings in CDS service discovery to "LoHop" where user-visible.
- `README.md` quick start: mention `./scripts/start-stack.sh` + `/sandbox` URL.
- Playwright: `scripts/test-sandbox.mjs` — assert panel list + workflow open.
- Merge `prototype3` / `my-react-app` into `main` when stable — see `TEAMMATE_AGENT_HANDOFF.md` §2.

---

## Key files reference

| Path | Purpose |
|------|---------|
| `cds-ai-service/main.py` | CDS webhook handlers, card links |
| `cds-ai-service/ai_service.py` | LLM for card detail (Vertex) |
| `backend/app/main.py` | Loop API routes |
| `backend/app/detectors.py` | FHIR detection rules |
| `backend/app/writeback.py` | Approve → FHIR |
| `backend/API.md` | Full API contract |
| `patient-workflow-visualization/components/embed-loop.tsx` | Side panel data loading |
| `patient-workflow-visualization/components/workflow/workflow-overlay.tsx` | Modal shell — wire actions here |
| `patient-workflow-visualization/lib/api.ts` | Frontend → backend client |
| `patient-workflow-visualization/next.config.mjs` | Proxy rules |
| `scripts/start-stack.sh` | Dev orchestration |

---

## Suggested implementation order (one session)

1. `fetchLoops` + map to `Issue` + embed-loop (30 min)
2. CDS service calls backend for card summary (20 min)
3. Fix `draftLoop` / `approveLoop` + minimal workflow runner UI (45 min)
4. End-to-end test on `/sandbox` with live patient (15 min)

---

## Environment checklist

```bash
# Terminal 1
./scripts/start-stack.sh

# Terminal 2 (public demo)
./scripts/tunnel.sh
# Update LOOP_APP_URL in cds-ai-service/.env + patient-workflow-visualization/.env.local

# Vertex ADC (once per machine)
./scripts/setup-gcloud-vertex.sh
```

```env
# backend/.env
FHIR_BASE=https://lohp.ryanbeland.dev/fhir
LLM_PROVIDER=vertex
GOOGLE_CLOUD_PROJECT=project-0a4fffd1-40be-4d34-9a9

# cds-ai-service/.env
LOOP_BACKEND_URL=http://localhost:8010
LOOP_APP_URL=https://<tunnel>
LLM_PROVIDER=vertex
```

---

## Non-goals (this sprint)

- Replacing lohp team's CDS service in production
- Full SMART on FHIR launch (use query-param `patientId` for now)
- Real-time FHIR subscriptions / Signal webhooks

---

*Last updated: `main` after sandbox embed, CDS feedback, and production tunnel fixes. See `TEAMMATE_AGENT_HANDOFF.md`.*
