import os
import json
from dotenv import load_dotenv
load_dotenv()

try:
    import google.generativeai as genai
except ImportError:
    genai = None

# If there is an API key, we configure it.
API_KEY = os.getenv("GEMINI_API_KEY")
if API_KEY and genai:
    genai.configure(api_key=API_KEY)

def extract_referral_info(text: str) -> dict:
    """
    Extracts structured referral information from unstructured text.
    Uses Gemini if API key is present, otherwise falls back to a mock response.
    """
    if API_KEY and genai:
        try:
            model = genai.GenerativeModel('gemini-1.5-flash')
            prompt = f"""
            You are a medical assistant extracting information from a scanned fax or clinical note.
            Extract the patient's name, the primary diagnosis or reason for referral, the requested specialist, and urgency.
            Return the result ONLY as a JSON object with these keys: "patient_name", "diagnosis", "specialist", "urgency" (routine, urgent, or emergent).
            
            Text:
            {text}
            """
            response = model.generate_content(prompt)
            # Try to parse the JSON output
            output = response.text.strip()
            if output.startswith("```json"):
                output = output[7:-3]
            elif output.startswith("```"):
                output = output[3:-3]
            return json.loads(output)
        except Exception as e:
            print(f"LLM Error: {e}")
            pass

    # Mock fallback
    return {
        "patient_name": "James Wallace",
        "diagnosis": "Worsening dyspnoea on exertion, assess for cardiac resynchronisation therapy candidacy",
        "specialist": "Cardiology",
        "urgency": "urgent"
    }

def get_mock_fax_text(patient_id: str, patient_name: str = "James Wallace", dob: str = "14-Mar-1958") -> str:
    # Just a mock medical transcription for the demo
    return f"""
FAX COVER SHEET
To: Central Intake
From: Dr. Smith Family Practice
Re: Patient {patient_id}

Please see the attached referral for {patient_name} (DOB: {dob}).
Patient has worsening dyspnoea on exertion despite optimal medical therapy.
Requesting Cardiology assessment for cardiac resynchronisation therapy (CRT) candidacy.
Please schedule urgently.
"""
