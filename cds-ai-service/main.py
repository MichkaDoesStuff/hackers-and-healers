from fastapi import FastAPI, Request, Response
from ai_service import call_ai_for_recommendation

app = FastAPI(title="AI CDS Hooks Service")


@app.middleware("http")
async def add_cors_headers(request: Request, call_next):
    if request.method == "OPTIONS":
        response = Response(status_code=200)
    else:
        response = await call_next(request)

    response.headers["Access-Control-Allow-Origin"] = "https://sandbox.cds-hooks.org"
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
    "name": "ai-followup-assistant",
    "title": "AI Follow-up Assistant",
    "description": "AI follow-up suggestions.",
    "id": "ai-followup-assistant"
}
  ]
}


@app.post("/cds-services/ai-followup-assistant")
async def ai_followup_assistant(request: Request):
    """
    CDS Hooks service endpoint.

    The sandbox calls this when the patient-view hook fires.
    Your service returns CDS cards.
    """

    cds_request = await request.json()

    ai_result = call_ai_for_recommendation(cds_request)

    return {
        "cards": [
            {
                "summary": ai_result["summary"],
                "detail": ai_result["detail"],
                "indicator": ai_result["indicator"],
                "source": {
                    "label": "AI Follow-up Assistant"
                },
                "suggestions": [
                    {
                        "label": "Create follow-up review task",
                        "uuid": "create-followup-review-task"
                    }
                ],
                "links": [
                    {
                        "label": "Open AI follow-up assistant",
                        "url": "https://example.com/smart-app-placeholder",
                        "type": "absolute"
                    }
                ]
            }
        ]
    }