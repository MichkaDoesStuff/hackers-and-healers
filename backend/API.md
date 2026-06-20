# Loop API

FastAPI backend. Detects stalled clinical/admin tasks ("open loops") from FHIR,
risk-ranks them, drafts follow-up actions, and—on clinician approval—writes the
action back to FHIR with provenance.

Base URL (dev): `http://localhost:8010`
Interactive docs: `http://localhost:8010/docs` (OpenAPI/Swagger, auto-generated)

All responses are JSON. CORS allows `localhost:3000` (frontend) and `localhost:5173`.

---

## Health

### `GET /health`
Liveness + FHIR connectivity.
```json
{ "status": "ok", "fhir": true }
```

---

## Loops (the worklist)

### `GET /api/loops`
Detect open loops, risk-ranked (critical → routine).

Query params:
- `patient` (optional) — scope to one patient (the SMART launch context). Omit for the whole population.

```json
{
  "open": 4,
  "patient": null,
  "patient_name": null,
  "loops": [
    {
      "id": "abn-9662",
      "type": "abnormal_result",
      "title": "Robert B. - Potassium 6.1 mmol/L",
      "subtitle": "Critical result, unreviewed 19 days",
      "patient_id": "1000",
      "patient_name": "Robert B.",
      "focus": [{ "resourceType": "Observation", "id": "9662" }],
      "detected_days_ago": 19,
      "money_at_risk": null,
      "why": ["interpretation HH (CRITICAL)", "unacknowledged 19 days (>7)", "no follow-up Task found"],
      "score": 128,
      "band": "critical"
    }
  ]
}
```

**Loop types:** `abnormal_result`, `ordered_not_resulted`, `referral_no_response`, `billing_unreconciled`.
**Bands:** `critical`, `high`, `medium`, `routine`. Risk + band are deterministic (no LLM).

---

## Clinic view (patients + issues)

### `GET /api/clinic`
Same detection, shaped for the patients UI: patients with demographics, conditions,
medications, and their issues. Includes some "all clear" patients.

```json
{
  "open": 4,
  "patients": [
    {
      "id": "1000", "name": "Robert B.", "age": 67, "sex": "M", "mrn": "MRN-...",
      "conditions": ["Hypertension", "CKD stage 3"], "medications": ["Lisinopril 20mg"],
      "lastSeen": "May 02, 2019",
      "issues": [
        { "id": "abn-9662", "title": "Potassium 6.1 mmol/L", "summary": "Critical result, unreviewed 19 days",
          "severity": "critical", "category": "lab", "ageDays": 19, "source": "loop-summary", "detail": "..." }
      ]
    }
  ]
}
```
`severity`: `critical | warning | routine`. `category`: `lab | referral | billing | medication | follow-up | screening`.

---

## Draft + approve

### `POST /api/loops/{loop_id}/draft`
Generate the action draft (LLM if a key is set, else deterministic fallback). Preview only — no write.

Body (optional): `{ "playbook_id": "pb-critical-lab-recall" }` — uses that playbook's AI-step prompt.
```json
{ "loop_id": "abn-9662", "model": "claude-sonnet-4-6", "draft": "Recommend urgent review of K+ 6.1 ..." }
```

### `POST /api/loops/{loop_id}/approve`
Approve a loop: draft (if `message` not supplied), then write **Task + CommunicationRequest + Provenance**
to FHIR and close the loop. Idempotent per loop focus.

Body (all optional):
```json
{ "playbook_id": "pb-critical-lab-recall", "message": "clinician-edited text overrides the draft", "approver": "Dr. Chen" }
```
Response:
```json
{
  "status": "actioned",
  "written": [
    { "resourceType": "Task", "id": "9666" },
    { "resourceType": "CommunicationRequest", "id": "9667" },
    { "resourceType": "Provenance", "id": "9668" }
  ],
  "loop_id": "abn-9662", "closed": true, "model": "fallback",
  "message": "..."
}
```
`status` is `actioned` or `already_actioned`. Gates: every clinical write requires this approval — the LLM cannot write to FHIR.

---

## Playbooks (reusable workflows)

A playbook is a reusable workflow for one `loop_type`. Steps use the frontend's
vocabulary: `trigger | detect | draft | order | notify | decision | resolve`.
Clinical-action steps (`order`, `notify`) carry a non-removable approval `gated` flag.

### `GET /api/playbooks`
Prebuilt library + user-defined. Filter for reuse: `?loop_type=billing_unreconciled`.
```json
{ "playbooks": [ { "id": "pb-critical-lab-recall", "title": "Critical lab recall",
  "loop_type": "abnormal_result", "version": 1, "builtin": true, "steps": [...], "edges": [...] } ] }
```

**Prebuilt:** `pb-critical-lab-recall`, `pb-result-published-followup`, `pb-referral-chase`, `pb-billing-reconciliation`.

### `GET /api/playbooks/{id}`
One playbook (404 if missing).

### `POST /api/playbooks`
Define / save a reusable workflow. Builtins are copied to a new id (never overwritten);
re-saving a user playbook bumps its `version`. Body = a Playbook object (see GET shape; `id` may be empty to create).

### `DELETE /api/playbooks/{id}`
Delete a user-defined playbook. `{ "deleted": true }`.

---

## Reports (cost + impact)

### `GET /api/reports`
Money recovered, time saved, detection accuracy, run cost. Every figure ships with its assumption.
```json
{
  "generated_at": "...",
  "loops": { "open": 4, "by_severity": {...}, "by_type": {...} },
  "money": { "currency": "CAD", "at_risk_total": 1240.0, "recoverable_if_actioned": 1240.0,
             "would_be_lost_unactioned": 124.0, "assumption": "unreconciled claims lose ~10%" },
  "impact": { "loops_actionable": 4, "admin_minutes_saved": 24, "admin_dollars_saved": 14.0,
              "assumption": "6 min saved per loop @ $35.0/hr" },
  "detection_quality": { "available": true, "injected": 4, "detected_of_injected": 4, "recall": 1.0 },
  "run_cost": { "detection_cost": 0.0, "detection_note": "rules, no LLM, $0",
                "llm_model": "claude-sonnet (drafting)", "est_total_usd": 0.042 }
}
```

---

## Notes for integrators

- **Risk/path/detection are deterministic;** the LLM only writes language (drafts) and never writes FHIR, sets risk, or skips a gate.
- **Closure** is tracked in Loop's own store (`data/actioned.json`) for immediate consistency — HAPI indexes searches asynchronously. The FHIR `Task`/`Provenance` remain the system of record.
- **LLM is optional.** Without a key the system uses a deterministic fallback so the full flow works offline. Configure via `.env` (`LLM_PROVIDER=anthropic|openai`, `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`).
