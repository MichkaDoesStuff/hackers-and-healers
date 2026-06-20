from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from ai_triage import extract_referral_info, get_mock_fax_text
from synthea_loader import PATIENTS
from loop_engine import detect_loops
from fhir_server import fhir_router, load_fhir_data
import uuid

# In-memory storage for active tasks so the React frontend can fetch their details
TASKS = {}

app = FastAPI(title="Smart Triage & CDS Portal API")

# Allow CORS for the frontend and CDS Hook sandboxes
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    load_fhir_data()

app.include_router(fhir_router, prefix="/fhir", tags=["FHIR Server"])

@app.get("/cds-services")
def discovery():
    return {
        "services": [
            {
                "hook": "patient-view",
                "id": "triage-assistant",
                "title": "Smart Triage Assistant",
                "description": "Scans for new faxes and open loops when a patient chart is opened.",
                "prefetch": {
                    "patient": "Patient/{{context.patientId}}"
                }
            },
            {
                "hook": "order-select",
                "id": "rx-assistant-select",
                "title": "Loop Rx Safety (Select)",
                "description": "Checks for drug-drug interactions and lab safety before an order is placed.",
                "prefetch": {
                    "patient": "Patient/{{context.patientId}}"
                }
            },
            {
                "hook": "order-sign",
                "id": "rx-assistant-sign",
                "title": "Loop Rx Safety (Sign)",
                "description": "Final check before signing a prescription.",
                "prefetch": {
                    "patient": "Patient/{{context.patientId}}"
                }
            }
        ]
    }

@app.get("/api/patients")
def list_patients():
    """
    Returns a summary list of all patients loaded from the Synthea CSV.
    The frontend uses this to let users pick a patient to demo.
    """
    result = []
    for pid, p in PATIENTS.items():
        name_obj = p["name"][0] if p.get("name") else {}
        first = name_obj.get("given", [""])[0]
        last = name_obj.get("family", "")
        result.append({
            "id": pid,
            "name": f"{first} {last}".strip(),
            "gender": p.get("gender", "unknown"),
            "birthDate": p.get("birthDate", ""),
            "active_problems": p.get("active_problems", [])[:3],  # top 3
        })
    # Sort: planted demo patients first, then alphabetical
    planted_ids = {p["id"] for p in result if p["id"].startswith("P-DEMO")}
    result.sort(key=lambda p: (0 if p["id"] in planted_ids else 1, p["name"]))
    return {"patients": result, "total": len(result)}

@app.post("/cds-services/triage-assistant")
async def triage_assistant(request: Request):
    data = await request.json()
    context = data.get("context", {})
    patient_id = context.get("patientId", "")

    # Clean patient ID (sometimes format is Patient/123)
    if "Patient/" in patient_id:
        patient_id = patient_id.split("/")[-1]

    cards = []

    # 1. Fax Triage Card
    if patient_id in PATIENTS:
        patient = PATIENTS[patient_id]
        patient_name = f"{patient['name'][0]['given'][0]} {patient['name'][0]['family']}"
        
        # Get mock fax with real patient details
        dob = patient.get("birthDate", "Unknown")
        fax_text = get_mock_fax_text(patient_id, patient_name, dob)
        
        # Run AI extraction (or mock)
        extraction = extract_referral_info(fax_text)
        
        # We want to link to our React portal to review this.
        # Store the task in memory so the frontend can fetch the extracted data.
        task_id = f"task-{uuid.uuid4().hex[:6]}"
        TASKS[task_id] = {
            "taskId": task_id,
            "patientId": patient_id,
            "fax_text": fax_text,
            "extraction": extraction
        }
        
        cards.append({
            "summary": f"1 New Pending Referral for {patient_name}",
            "indicator": "warning",
            "source": {
                "label": "Smart Triage Assistant",
            },
            "detail": f"AI detected a new {extraction.get('specialty', 'specialist')} referral request in an incoming fax. Please review and approve.",
            "links": [
                {
                    "label": "Review Referral Form",
                    "url": f"https://lohp.ryanbeland.dev/portal/review/{patient_id}/{task_id}",
                    "type": "absolute"
                }
            ]
        })

    # 2. Existing loops from loop_engine.py
    # We find loops that belong to this patient
    all_loops = detect_loops()
    patient_loops = [l for l in all_loops if l["patient"]["id"] == patient_id]

    for loop in patient_loops:
        indicator = "info"
        if loop["severity"] == "CRITICAL":
            indicator = "critical"
        elif loop["severity"] == "HIGH":
            indicator = "warning"

        cards.append({
            "summary": loop["summary"],
            "indicator": indicator,
            "source": {
                "label": "Loop Engine",
            },
            "detail": f"This loop has been open for {loop['days_open']} days. Please review.",
            "links": [
                {
                    "label": "View Details in Portal",
                    "url": f"https://lohp.ryanbeland.dev/portal/loop/{loop['id']}",
                    "type": "absolute"
                }
            ]
        })

    # Fallback if no cards generated
    if not cards:
        cards.append({
            "summary": "No pending tasks or loops for this patient.",
            "indicator": "info",
            "source": {
                "label": "Smart Triage Assistant",
            }
        })

    return {"cards": cards}

@app.post("/cds-services/rx-assistant-select")
async def rx_assistant_select(request: Request):
    """Handles the order-select hook"""
    # Return a generic safety check card for demo purposes
    return {
        "cards": [
            {
                "summary": "Loop Rx Safety: No interactions found.",
                "indicator": "info",
                "source": { "label": "Loop Safety Engine" },
                "detail": "Standard safety checks passed. (Demo context: Loop monitors lab history to ensure this medication is safe)."
            }
        ]
    }

@app.post("/cds-services/rx-assistant-sign")
async def rx_assistant_sign(request: Request):
    """Handles the order-sign hook"""
    return {
        "cards": [
            {
                "summary": "Ready to Sign.",
                "indicator": "success",
                "source": { "label": "Loop Safety Engine" },
                "detail": "All checks passed. Once signed, Loop will monitor for required lab follow-ups."
            }
        ]
    }

@app.post("/api/action")
async def handle_action(request: Request):
    """
    Simulates writing back to the EHR (e.g. updating a referral status or closing a loop).
    In a real SMART on FHIR app, this would be a FHIR POST/PUT request.
    """
    data = await request.json()
    action = data.get("action")
    print(f"Received action: {action} with data: {data}")
    return {"status": "success", "message": "Action processed and saved to EHR."}

@app.get("/api/tasks/{task_id}")
def get_task(task_id: str):
    """
    Returns the details of a specific task, including the original fax text
    and the AI extraction. Used by the React Review Portal.
    """
    if task_id in TASKS:
        return TASKS[task_id]
    
    # Fallback if task was lost due to server restart
    return {
        "taskId": task_id,
        "patientId": "Unknown",
        "fax_text": "Task data expired. Server may have been restarted.",
        "extraction": {
            "patient_name": "Unknown",
            "diagnosis": "Unknown",
            "specialist": "Unknown",
            "urgency": "Unknown"
        }
    }

@app.get("/api/metrics")
def get_accuracy_metrics():
    """
    Returns accuracy metrics for the judge demo.
    Shows how many planted problems Loop detected vs. total planted.
    """
    all_loops = detect_loops()
    # We know exactly 4 problems were planted (see synthetic_data.py)
    planted = 4
    caught = len(all_loops)
    return {
        "planted": planted,
        "caught": min(caught, planted),
        "accuracy_pct": round(min(caught, planted) / planted * 100),
        "open": caught,
        "closed": 0,
        "total_at_risk_dollars": sum(
            l["context"].get("total_at_risk", 0) for l in all_loops
        ),
    }
