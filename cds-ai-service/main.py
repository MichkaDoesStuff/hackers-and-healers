import os
from urllib.parse import urlencode

from fastapi import FastAPI, Request, Response
from ai_service import call_ai_for_recommendation

app = FastAPI(title="Loop CDS Hooks Service")

# Public URL of the Next.js app (serves /embed). Same host as BACKEND when using Next rewrites.
LOOP_APP_URL = os.getenv("LOOP_APP_URL", "http://localhost:3000").rstrip("/")

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


def build_cds_response(cds_request: dict) -> dict:
    ai_result = call_ai_for_recommendation(cds_request)

    return {
        "cards": [
            {
                "summary": ai_result["summary"],
                "detail": ai_result["detail"],
                "indicator": ai_result["indicator"],
                "source": {"label": "Loop"},
                "suggestions": [
                    {
                        "label": "Create follow-up review task",
                        "uuid": "create-followup-review-task",
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


async def handle_patient_view_hook(request: Request) -> dict:
    cds_request = await request.json()
    return build_cds_response(cds_request)


@app.post("/cds-services/triage-assistant")
@app.post("/cds-services/ai-followup-assistant")
async def patient_view_hook(request: Request):
    return await handle_patient_view_hook(request)
