# LoHop

**An AI safety net that lives inside the EHR.** LoHop detects clinical and admin tasks that have
stalled — an abnormal lab nobody reviewed, a test ordered but never resulted, a referral with no
reply, a rejected claim losing money — **ranks** them by risk, lets a clinician **run a workflow** to
**draft** the next action, and **writes it back** to the chart only after a human approves.

The demo embeds the real **CDS Hooks Sandbox** (a stand-in EHR) and shows LoHop as a **side panel on
the same screen** — not a separate app.

> Safety model: detection, ranking, and routing are **deterministic rules** (inspectable, no LLM).
> The LLM only drafts language. **Every chart write requires clinician approval** (a non-removable gate).

---

## Quick start

Prereqs: Docker, Python 3.11+, Node 18+.

```bash
# 1. one-shot: FHIR + Loop API (:8010) + CDS Hooks (:8000) + Next.js (:3000)
./scripts/start-stack.sh

# 2. (optional) load local demo data into HAPI
python data/load_synthea.py --count 20 && python data/inject_loops.py

# 3. expose it publicly for the CDS Sandbox embed (production build required)
./scripts/tunnel.sh            # prints a https://<name>.trycloudflare.com URL
```

Then open **`<tunnel>/sandbox?patientId=b61008f3-84e2-8e3f-abd9-995a23133d57`** — EHR on the left,
LoHop side panel on the right.

> Cloudflare *quick* tunnel URLs are random and change on every restart. For a stable URL, use a
> named tunnel or an ngrok static domain.

---

## Architecture

```
            CDS Hooks Sandbox (demo EHR, embedded in /sandbox)
                     │  patient-view hook
                     ▼
        cds-ai-service :8000  ──optional──▶  backend :8010
        (CDS Hooks JSON, cards)             (FHIR detect · rank · draft · approve · write-back)
                     │                                   │
        card "Open Loop assistant"                       ▼
                     ▼                          HAPI FHIR (local) or lohp FHIR
        Next.js :3000  /sandbox  ──▶  LoHop side panel (/embed) + workflow builder (/workflows)
```

A single Cloudflare tunnel → Next.js `:3000`, which proxies `/cds-services`→`:8000`, `/api/*`→`:8010`,
`/fhir/*`→FHIR (see `patient-workflow-visualization/next.config.mjs`).

---

## Project structure

```
backend/                        FastAPI — the Loop API (:8010)
  app/detectors.py              deterministic open-loop detection rules
  app/risk.py                   risk ranking
  app/llm.py                    pluggable drafting (anthropic | vertex | openai | fallback)
  app/playbooks.py              reusable workflow definitions (steps + edges), CRUD store
  app/writeback.py              approve → FHIR Task + CommunicationRequest + Provenance
  app/triage.py                 fax triage: unstructured fax → structured referral → FHIR
  app/phone.py, appointments.py AI phone-call + appointment booking (Twilio)
  API.md                        full REST API reference
cds-ai-service/                 FastAPI — CDS Hooks service (:8000): discovery + patient-view cards
data/                           Synthea loader + loop injector (load_synthea.py, inject_loops.py)
infra/                          docker-compose for HAPI FHIR R4
patient-workflow-visualization/ Next.js UI (:3000)
  app/sandbox/                  the demo: embedded EHR + LoHop side panel (front door; / redirects here)
  app/embed/                    the LoHop side panel itself (rendered in an iframe)
  app/workflows/                n8n-style node workflow builder
  app/triage/                   fax-triage inbox + review
  app/clinic/                   standalone ClinicOS dashboard (local-HAPI mode)
  components/workflow/          React Flow canvas, step nodes, runner
scripts/                        start-stack.sh, tunnel.sh, sandbox-url.sh, gcloud/vertex setup
docs/                           guides — see below
```

---

## Key routes (frontend)

| Route | What it is |
|-------|------------|
| `/sandbox` | **The demo.** Embedded CDS Hooks Sandbox + LoHop side panel (`/` redirects here). |
| `/embed` | The LoHop side panel (ranked open loops; opens the workflow pop-up). |
| `/workflows` | n8n-style workflow builder — add/connect/edit nodes (LLM prompt, Twilio SMS), save as a playbook. |
| `/triage` | Fax-triage inbox: unstructured fax → AI-extracted referral → approve → FHIR. |
| `/clinic` | Standalone clinic dashboard (local-HAPI detection mode). |

**CDS service:** `/sandbox` defaults its discovery URL to the hosted `https://lohp.ryanbeland.dev/cds-services`
(rich AI chart-review cards). Append `?cds=local` to use this repo's own `cds-ai-service` instead.

---

## Configuration

Copy `.env.example` → `.env`. The system runs with **no keys** (deterministic fallbacks). Optional:

- **LLM drafting:** `LLM_PROVIDER=anthropic|vertex|openai` + the matching key (else `fallback`).
- **Twilio (SMS notify + AI calls):** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`/`TWILIO_FROM_NUMBER`.
  Without these, the notify node **simulates** sends. (Twilio trial accounts can only message verified numbers.)
- **FHIR:** `FHIR_BASE=http://localhost:8080/fhir` (local HAPI) for real detect/approve, or a remote FHIR server.

`.env` files are gitignored — never commit secrets.

---

## API

Full reference in **`backend/API.md`**. Highlights:
`/api/loops` · `/api/clinic` · `/api/loops/{id}/draft` · `/api/loops/{id}/approve` ·
`/api/playbooks` (CRUD) · `/api/triage/*` · `/api/notify/sms` · `/api/reports`.

---

## Docs

- [`docs/TEAM-GUIDE.md`](docs/TEAM-GUIDE.md) — plain-English overview, glossary, demo script.
- [`docs/TEAMMATE_AGENT_HANDOFF.md`](docs/TEAMMATE_AGENT_HANDOFF.md) — product intent, pitfalls, scope.
- [`docs/NEXT_AGENT_SPEC.md`](docs/NEXT_AGENT_SPEC.md) — file-level integration task breakdown.
- [`docs/README_boot_cds_sandbox_demo.md`](docs/README_boot_cds_sandbox_demo.md) — booting the CDS sandbox + tunnel.
