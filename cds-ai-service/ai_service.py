import os
from openai import OpenAI

from dotenv import load_dotenv
load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


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


def call_ai_for_recommendation(cds_request: dict) -> dict:
    """
    Returns a simple dict that we will convert into a CDS Hooks card.
    Includes a fallback so your demo still works if the AI call fails.
    """

    patient_context = build_patient_context(cds_request)

    try:
        response = client.responses.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4.1-mini"),
            input=[
                {
                    "role": "system",
                    "content": (
                        "You are a clinical workflow assistant for a hackathon prototype. "
                        "Use only the provided synthetic FHIR context. "
                        "Return concise, non-diagnostic workflow support."
                    ),
                },
                {
                    "role": "user",
                    "content": patient_context,
                },
            ],
            temperature=0.2,
        )

        text = response.output_text.strip()

        return {
            "summary": "AI-generated workflow suggestion",
            "detail": text,
            "indicator": "info",
        }

    except Exception as error:
        return {
            "summary": "AI service unavailable — demo fallback",
            "detail": (
                "The AI API call failed, so this fallback card is shown. "
                "In a live demo, this confirms that the CDS Hooks flow still works. "
                f"Error: {str(error)}"
            ),
            "indicator": "warning",
        }