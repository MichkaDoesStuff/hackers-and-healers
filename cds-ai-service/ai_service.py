import os

from dotenv import load_dotenv

load_dotenv()

SYSTEM_PROMPT = (
    "You are a clinical workflow assistant for a hackathon prototype. "
    "Use only the provided synthetic FHIR context. "
    "Return concise, non-diagnostic workflow support."
)

PROVIDER = os.getenv("LLM_PROVIDER", "fallback").lower()
VERTEX_MODEL = os.getenv("GOOGLE_GENAI_MODEL", "gemini-2.5-flash")
VERTEX_LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")

_client = None


def get_openai_client():
    global _client
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or api_key.startswith("your_key"):
        return None
    if _client is None:
        from openai import OpenAI

        _client = OpenAI(api_key=api_key)
    return _client


def build_patient_context(cds_request: dict) -> str:
    """
    Converts the CDS Hooks request into plain text for the AI.
    In a real build, this would parse FHIR Patient, Condition,
    MedicationRequest, Observation, DocumentReference, etc.
    """

    hook = cds_request.get("hook")
    context = cds_request.get("context", {})
    prefetch = cds_request.get("prefetch", {})

    patient_id = context.get("patientId", "unknown patient")

    patient = prefetch.get("patient")
    conditions = prefetch.get("conditions")
    medications = prefetch.get("medications")
    observations = prefetch.get("observations")

    return f"""
CDS hook: {hook}
Patient ID: {patient_id}

FHIR prefetch data:
Patient:
{patient}

Conditions:
{conditions}

Medications:
{medications}

Observations:
{observations}

Task:
Generate concise clinical workflow support for a primary care clinician.
Focus on overdue follow-up, medication monitoring, missing labs, or next actions.
Do not diagnose.
Do not invent facts not supported by the data.
Keep output short and action-oriented.
"""


def demo_fallback(cds_request: dict, reason: str) -> dict:
    patient_id = cds_request.get("context", {}).get("patientId", "this patient")
    return {
        "summary": "Open loops detected — review in Loop",
        "detail": (
            f"Loop found follow-up items for {patient_id}. "
            "Open the assistant to review ranked issues and run a workflow. "
            f"({reason})"
        ),
        "indicator": "info",
    }


def _vertex_summary(patient_context: str) -> dict:
    from google import genai

    client = genai.Client(
        vertexai=True,
        project=os.getenv("GOOGLE_CLOUD_PROJECT"),
        location=VERTEX_LOCATION,
    )
    resp = client.models.generate_content(
        model=VERTEX_MODEL,
        contents=patient_context,
        config={
            "system_instruction": SYSTEM_PROMPT,
            "temperature": 0.2,
            "max_output_tokens": 512,
        },
    )
    text = (resp.text or "").strip()
    return {
        "summary": "Open loops detected — review in Loop",
        "detail": text,
        "indicator": "info",
    }


def _openai_summary(patient_context: str) -> dict:
    client = get_openai_client()
    if client is None:
        raise RuntimeError("OpenAI client unavailable")

    response = client.responses.create(
        model=os.getenv("OPENAI_MODEL", "gpt-4.1-mini"),
        input=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": patient_context},
        ],
        temperature=0.2,
    )
    text = response.output_text.strip()
    return {
        "summary": "Open loops detected — review in Loop",
        "detail": text,
        "indicator": "info",
    }


def call_ai_for_recommendation(cds_request: dict) -> dict:
    """
    Returns a simple dict that we will convert into a CDS Hooks card.
    Works without any LLM key — returns a demo card instead.
    """

    patient_context = build_patient_context(cds_request)

    try:
        if PROVIDER == "vertex" and os.getenv("GOOGLE_CLOUD_PROJECT"):
            return _vertex_summary(patient_context)
        if PROVIDER == "openai" or get_openai_client():
            return _openai_summary(patient_context)
    except Exception as error:
        return demo_fallback(cds_request, str(error))

    return demo_fallback(cds_request, "no LLM configured — set LLM_PROVIDER=vertex or OPENAI_API_KEY")
