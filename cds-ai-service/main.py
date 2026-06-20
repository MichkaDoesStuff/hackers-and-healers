import json
import os
import uuid
import urllib.error
import urllib.request
from urllib.parse import urlencode

import httpx
from fastapi import FastAPI, Request, Response
from ai_service import call_ai_for_recommendation

app = FastAPI(title="Loop CDS Hooks Service")

# Public URL of the Next.js app (serves /embed). Same host as BACKEND when using Next rewrites.
LOOP_APP_URL = os.getenv("LOOP_APP_URL", "http://localhost:3000").rstrip("/")
LOOP_BACKEND_URL = os.getenv("LOOP_BACKEND_URL", "http://localhost:8010").rstrip("/")

CREATE_FOLLOWUP_SUGGESTION = "create-followup-review-task"
_MAX_CARD_CONTEXT = 200

# CDS Hooks feedback only includes card/suggestion ids — cache hook context by card uuid.
_card_context: dict[str, dict] = {}

SANDBOX_ORIGIN = "https://sandbox.cds-hooks.org"

CORS_HEADERS = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
    "Access-Control-Expose-Headers": "Origin, Accept, Content-Location, Location, Content-Type",
    "Access-Control-Allow-Credentials": "true",
}

CDS_SERVICES = [
    {
        "hook": "patient-view",
        "id": "triage-assistant",
        "title": "Smart Triage Assistant",
        "description": "Surfaces ranked open loops when a patient chart is opened.",
        "prefetch": {
            "patient": "Patient/{{context.patientId}}",
            "conditions": "Condition?patient={{context.patientId}}",
            "observations": "Observation?patient={{context.patientId}}",
        },
    },
    {
        "hook": "patient-view",
        "id": "ai-followup-assistant",
        "title": "Loop — Open Loop Assistant",
        "description": "AI-assisted open loop review with workflow playbooks.",
        "prefetch": {
            "patient": "Patient/{{context.patientId}}",
            "conditions": "Condition?patient={{context.patientId}}",
            "medications": "MedicationRequest?patient={{context.patientId}}",
            "observations": "Observation?patient={{context.patientId}}",
        },
    },
]


@app.middleware("http")
async def add_cors_headers(request: Request, call_next):
    if request.method == "OPTIONS":
        response = Response(status_code=200)
    else:
        response = await call_next(request)

    origin = request.headers.get("origin", "")
    if origin in (SANDBOX_ORIGIN, "http://localhost:3000", "http://127.0.0.1:3000"):
        response.headers["Access-Control-Allow-Origin"] = origin
    else:
        response.headers["Access-Control-Allow-Origin"] = "*"
    for key, value in CORS_HEADERS.items():
        response.headers[key] = value
    response.headers["Vary"] = "Origin"
    return response


@app.get("/")
def root():
    return {
        "status": "running",
        "message": "Loop CDS service is live. Use /cds-services for discovery.",
        "embed_url": f"{LOOP_APP_URL}/embed",
    }


@app.get("/cds-services")
def discovery():
    return {"services": CDS_SERVICES}


def build_loop_embed_url(cds_request: dict) -> str:
    context = cds_request.get("context", {})
    query = urlencode(
        {
            "patientId": context.get("patientId", ""),
            "userId": context.get("userId", ""),
            "hook": cds_request.get("hook", "patient-view"),
            "source": "cds-hooks",
        }
    )
    return f"{LOOP_APP_URL}/embed?{query}"


def build_loop_bridge_url(cds_request: dict) -> str:
    """Opens in sandbox via window.open, then postMessages /sandbox to update the iframe."""
    context = cds_request.get("context", {})
    query = urlencode({"patientId": context.get("patientId", "")})
    return f"{LOOP_APP_URL}/embed-bridge?{query}"


def build_loop_demo_url(cds_request: dict) -> str:
    """EHR-style demo page with Loop in an iframe side panel."""
    context = cds_request.get("context", {})
    query = urlencode({"patientId": context.get("patientId", "")})
    return f"{LOOP_APP_URL}/demo?{query}"


def loops_card_payload(cds_request: dict) -> dict | None:
    """Ground the card in real detected loops from the Loop backend.

    Returns a {summary, detail, indicator} dict when the backend reports open
    loops, or None on any error/timeout or when there are no open loops (so the
    caller falls back to the AI/demo recommendation).
    """
    try:
        context = cds_request.get("context") or {}
        patient_id = (context.get("patientId") or "").replace("Patient/", "", 1)
        if not patient_id:
            return None

        resp = httpx.get(
            f"{LOOP_BACKEND_URL}/api/loops",
            params={"patient": patient_id},
            timeout=4.0,
        )
        resp.raise_for_status()
        data = resp.json()

        open_count = data.get("open", 0)
        if not open_count or open_count <= 0:
            return None

        loops = data.get("loops") or []
        bands = {(loop.get("band") or "").lower() for loop in loops}
        bullet_lines = []
        for loop in loops[:2]:
            title = loop.get("title", "Untitled loop")
            band = loop.get("band", "routine")
            bullet_lines.append(f"- **{title}** ({band})")
        detail = "\n".join(bullet_lines) if bullet_lines else "Open loops detected."

        indicator = "warning" if bands & {"critical", "high"} else "info"
        return {
            "summary": f"{open_count} open loop(s) — review in LoHop",
            "detail": detail,
            "indicator": indicator,
        }
    except Exception:
        return None


def build_cds_response(cds_request: dict) -> dict:
    card_payload = loops_card_payload(cds_request)
    if card_payload is None:
        card_payload = call_ai_for_recommendation(cds_request)
    card_uuid = str(uuid.uuid4())
    _remember_card_context(card_uuid, cds_request)

    return {
        "cards": [
            {
                "uuid": card_uuid,
                "summary": card_payload["summary"],
                "detail": card_payload["detail"],
                "indicator": card_payload["indicator"],
                "source": {"label": "Loop"},
                "suggestions": [
                    {
                        "label": "Create follow-up review task",
                        "uuid": CREATE_FOLLOWUP_SUGGESTION,
                    }
                ],
                "links": [
                    {
                        "label": "Open Loop assistant",
                        "url": build_loop_bridge_url(cds_request),
                        "type": "absolute",
                    }
                ],
            }
        ]
    }


def _remember_card_context(card_uuid: str, cds_request: dict) -> None:
    context = cds_request.get("context") or {}
    _card_context[card_uuid] = {
        "patientId": context.get("patientId", ""),
        "userId": context.get("userId"),
    }
    if len(_card_context) > _MAX_CARD_CONTEXT:
        for key in list(_card_context)[: len(_card_context) - _MAX_CARD_CONTEXT]:
            del _card_context[key]


async def handle_patient_view_hook(request: Request) -> dict:
    cds_request = await request.json()
    return build_cds_response(cds_request)


def _call_backend_followup_task(patient_id: str, user_id: str | None) -> dict:
    payload = json.dumps({
        "patient_id": patient_id.replace("Patient/", ""),
        "user_id": user_id,
    }).encode()
    req = urllib.request.Request(
        f"{LOOP_BACKEND_URL}/api/cds/followup-task",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=45) as resp:
        return json.loads(resp.read().decode())


def _feedback_card(summary: str, detail: str, indicator: str = "info") -> dict:
    return {
        "cards": [{
            "summary": summary,
            "detail": detail,
            "indicator": indicator,
            "source": {"label": "LoHop"},
        }]
    }


def _context_for_feedback(body: dict, card_uuid: str | None) -> dict:
    if card_uuid and card_uuid in _card_context:
        return _card_context[card_uuid]
    return body.get("context") or {}


def _iter_followup_acceptances(body: dict):
    """Yield card_uuid for each accepted create-follow-up-review-task suggestion."""
    feedback = body.get("feedback")

    if isinstance(feedback, list):
        for entry in feedback:
            if entry.get("outcome") != "accepted":
                continue
            card_uuid = entry.get("card")
            for sug in entry.get("acceptedSuggestions") or []:
                if sug.get("id") == CREATE_FOLLOWUP_SUGGESTION:
                    yield card_uuid
        return

    if isinstance(feedback, dict):
        if feedback.get("outcome", "accepted") != "accepted":
            return
        suggestion = feedback.get("suggestion") or {}
        if suggestion.get("uuid") == CREATE_FOLLOWUP_SUGGESTION:
            yield feedback.get("card")


async def handle_cds_feedback(request: Request) -> dict:
    body = await request.json()
    acceptances = list(_iter_followup_acceptances(body))
    if not acceptances:
        return {"cards": []}

    card_uuid = acceptances[0]
    context = _context_for_feedback(body, card_uuid)
    patient_id = context.get("patientId") or ""
    user_id = context.get("userId")

    if not patient_id:
        return _feedback_card(
            "Could not create task",
            "No patient id in CDS hook context.",
            "warning",
        )

    try:
        result = _call_backend_followup_task(patient_id, user_id)
    except urllib.error.HTTPError as exc:
        err_body = exc.read().decode(errors="replace")[:300]
        return _feedback_card(
            "Follow-up task failed",
            f"Backend returned {exc.code}: {err_body}",
            "critical",
        )
    except Exception as exc:
        return _feedback_card(
            "Follow-up task failed",
            str(exc),
            "critical",
        )

    task_id = result.get("task_id", "?")
    loop_id = result.get("loop_id")
    demo = result.get("demo")
    detail = f"Wrote Task/{task_id} for patient {patient_id.replace('Patient/', '')}."
    if loop_id:
        detail += f" Linked to open loop {loop_id}."
    if demo:
        detail += " (Demo mode — lohp FHIR is read-only; task saved locally.)"
    return _feedback_card("Follow-up review task created", detail, "info")


@app.post("/cds-services/triage-assistant")
@app.post("/cds-services/ai-followup-assistant")
async def patient_view_hook(request: Request):
    return await handle_patient_view_hook(request)


@app.post("/cds-services/triage-assistant/feedback")
@app.post("/cds-services/ai-followup-assistant/feedback")
async def patient_view_feedback(request: Request):
    return await handle_cds_feedback(request)
