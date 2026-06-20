import os
from urllib.parse import urlencode

from fastapi import FastAPI, Request, Response
from ai_service import call_ai_for_recommendation

app = FastAPI(title="AI CDS Hooks Service")

LOOP_APP_URL = os.getenv("LOOP_APP_URL", "https://lohp.ryanbeland.dev").rstrip("/")

SANDBOX_ORIGIN = "https://sandbox.cds-hooks.org"


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
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, Accept"
    response.headers["Vary"] = "Origin"
    return response


@app.get("/")
def root():
    return {
        "status": "running",
        "message": "AI CDS Hooks Service is live. Use /cds-services for discovery.",
    }


@app.get("/cds-services")
def discovery():
    """
    CDS Hooks discovery endpoint.

    The sandbox calls this first to ask:
    'What CDS services do you support?'
    """

    return {
        "services": [
            {
                "hook": "patient-view",
                "id": "ai-followup-assistant",
                "title": "Loop — Open Loop Assistant",
                "description": "Surfaces ranked open loops when a patient chart is opened.",
                "prefetch": {
                    "patient": "Patient/{{context.patientId}}",
                    "conditions": "Condition?patient={{context.patientId}}",
                    "medications": "MedicationRequest?patient={{context.patientId}}",
                    "observations": "Observation?patient={{context.patientId}}",
                },
            }
        ]
    }


def build_loop_embed_url(cds_request: dict) -> str:
    """Link from a CDS card into the Loop frontend iframe."""
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


@app.post("/cds-services/ai-followup-assistant")
async def ai_followup_assistant(request: Request):
    """
    CDS Hooks service endpoint.

    The sandbox calls this when the patient-view hook fires.
    Your service returns CDS cards.
    """

    cds_request = await request.json()

    ai_result = call_ai_for_recommendation(cds_request)
    embed_url = build_loop_embed_url(cds_request)

    return {
        "cards": [
            {
                "summary": ai_result["summary"],
                "detail": ai_result["detail"],
                "indicator": ai_result["indicator"],
                "source": {
                    "label": "Loop"
                },
                "suggestions": [
                    {
                        "label": "Create follow-up review task",
                        "uuid": "create-followup-review-task"
                    }
                ],
                "links": [
                    {
                        "label": "Open Loop assistant",
                        "url": embed_url,
                        "type": "absolute"
                    }
                ]
            }
        ]
    }