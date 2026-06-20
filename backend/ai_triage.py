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

def summarize_fhir_record(fhir_resources: list) -> str:
    """
    Uses AI to simplify and summarize raw FHIR JSON into a clean clinical profile.
    Strips out noise like social history ('higher education'), demographics, and formatting.
    """
    if not API_KEY or not genai:
        return "No AI available to summarize EHR."
    try:
        model = genai.GenerativeModel('gemini-flash-lite-latest')
        prompt = f"""
        You are a clinical data abstractor. I am giving you raw FHIR EHR records for a patient.
        Please create a concise bulleted summary of their clinical profile.
        IGNORE social history (e.g., education, employment, housing), administrative noise, and demographic extensions.
        Focus ONLY on:
        - Active Conditions / Diagnoses
        - Current Medications
        - Recent abnormal or important lab results/observations
        
        Raw FHIR JSON:
        {json.dumps(fhir_resources[:30], indent=2)}
        """
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        print(f"Summarization error: {e}")
        return "Failed to summarize EHR context."

def extract_referral_info(text: str, patient_context: str = "") -> dict:
    """
    Extracts structured referral information from unstructured text.
    Uses Gemini if API key is present, otherwise falls back to a mock response.
    """
    if API_KEY and genai:
        try:
            model = genai.GenerativeModel('gemini-flash-lite-latest')
            prompt = f"""
            You are a medical assistant extracting information from a scanned fax or clinical note.
            Extract the patient's name, the primary diagnosis or reason for referral, the requested specialist, and urgency.
            Return the result ONLY as a JSON object with these keys: "patient_name", "diagnosis", "specialist", "urgency" (routine, urgent, or emergent).
            
            Use the Patient's FHIR Context to help identify and cross-reference their exact clinical problems, medications, and labs.
            
            --- Patient's FHIR Context ---
            {patient_context}
            
            --- Incoming Fax Text ---
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
            return {
                "patient_name": "API ERROR",
                "diagnosis": f"The Gemini API request failed. Please check your API key. Error: {str(e)}",
                "specialist": "None",
                "urgency": "None"
            }

    # Mock fallback if no API key configured at all
    return {
        "patient_name": "James Wallace",
        "diagnosis": "Worsening dyspnoea on exertion, assess for cardiac resynchronisation therapy candidacy",
        "specialist": "Cardiology",
        "urgency": "urgent"
    }

def get_mock_fax_text(patient_id: str, patient_name: str = "James Wallace", dob: str = "14-Mar-1958", active_problems: list = None) -> str:
    # Use real patient problems if available to make the demo faxes unique per patient
    if active_problems and len(active_problems) > 0:
        primary_problem = active_problems[0]
        clinical_sentence = f"Patient is being referred for assessment and ongoing management of {primary_problem}."
        request_sentence = f"Requesting specialist consultation to evaluate treatment options for {primary_problem}."
    else:
        clinical_sentence = "Patient has worsening dyspnoea on exertion despite optimal medical therapy."
        request_sentence = "Requesting Cardiology assessment for cardiac resynchronisation therapy (CRT) candidacy."

    return f"""
FAX COVER SHEET
To: Central Intake
From: Dr. Smith Family Practice
Re: Patient {patient_id}

Please see the attached referral for {patient_name} (DOB: {dob}).
{clinical_sentence}
{request_sentence}
Please schedule at your earliest convenience.
"""
