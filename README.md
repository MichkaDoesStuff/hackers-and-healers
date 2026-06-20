# Loop

An AI safety net for primary care. Loop detects clinical and admin tasks that have
stalled ("open loops") — an abnormal result nobody reviewed, a test ordered but never
resulted, a referral with no reply, a rejected claim losing money — ranks them by risk,
drafts the follow-up, and writes it back to the chart once a clinician approves.

See `TEAM-GUIDE.md` for the plain-English overview and `backend/API.md` for the full API.

## Architecture

```
Synthea + injected loops ─▶ HAPI FHIR ─▶ backend (detect · rank · draft · write-back)
                                              │  REST /api/*
                                              ▼
                                   Next.js UI (ClinicOS shell + Loop panel + workflow builder)
```

- **Detection, risk, and workflow paths are deterministic rules** — inspectable, no LLM.
- **The LLM only drafts language** (the message text). It never sets risk, picks the path, or writes to FHIR.
- **Every clinical write needs clinician approval** (a non-removable gate); approved actions are written as FHIR `Task` + `CommunicationRequest` + `Provenance`.
- Runs entirely on synthetic data, locally. "On top of FHIR" via HAPI — works with any FHIR R4 EMR.

## Layout

```
infra/        docker-compose — HAPI FHIR R4 server
data/         Synthea loader + loop injector (writes ground_truth.json)
backend/      FastAPI: FHIR client, detectors, risk, playbooks, reports, draft/approve, eval
              backend/API.md — full API reference
patient-workflow-visualization/  Next.js UI (frontend)
```

## Quick start

Prereqs: Docker, Python 3.11+, Node 18+.

### 1. FHIR server
```bash
cd infra && docker compose up -d
# wait for http://localhost:8080/fhir/metadata -> 200
```

### 2. Data
```bash
python -m venv .venv && source .venv/Scripts/activate   # Windows Git Bash
pip install -r data/requirements.txt -r backend/requirements.txt
python data/load_synthea.py --count 20
python data/inject_loops.py
```

### 3. Backend  (port 8010)
```bash
uvicorn app.main:app --app-dir backend --port 8010
# worklist: http://localhost:8010/api/loops   ·   docs: http://localhost:8010/docs
```

### 4. Frontend  (port 3000)
```bash
cd patient-workflow-visualization
npm install
npm run dev          # http://localhost:3000   (NEXT_PUBLIC_API_BASE defaults to :8010)
```

### Evaluate detection
```bash
python backend/eval.py     # precision/recall + confusion matrix vs injected ground truth
```

## LLM (optional)

The system runs with no key (deterministic fallback for drafts). To enable real drafting,
copy `.env.example` to `.env` and set `LLM_PROVIDER=anthropic` (or `openai`) plus the key.

## Endpoints

`/health` · `/api/loops` · `/api/clinic` · `/api/loops/{id}/draft` · `/api/loops/{id}/approve`
· `/api/playbooks` (CRUD) · `/api/reports`. Full reference in `backend/API.md`.
