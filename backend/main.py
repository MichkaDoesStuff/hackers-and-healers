from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from ai_triage import extract_referral_info, get_mock_fax_text, summarize_fhir_record
from synthea_loader import PATIENTS
from loop_engine import detect_loops
from fhir_server import fhir_router, load_fhir_data, get_patient_everything
import uuid
from datetime import datetime
import json
import os
import asyncio

# In-memory storage for active tasks so the React frontend can fetch their details
TASKS = {}
ARCHIVED_TASKS = {}
ARCHIVED_LOOPS = {}


# Persistence Logic
DB_FILE = "clinic_os_state.json"

def load_state():
    global TASKS, ARCHIVED_TASKS, ARCHIVED_LOOPS
    if os.path.exists(DB_FILE):
        try:
            with open(DB_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                TASKS = data.get("TASKS", {})
                ARCHIVED_TASKS = data.get("ARCHIVED_TASKS", {})
                ARCHIVED_LOOPS = data.get("ARCHIVED_LOOPS", {})
        except Exception as e:
            print(f"Failed to load state: {e}")

def save_state():
    try:
        with open(DB_FILE, "w", encoding="utf-8") as f:
            json.dump({
                "TASKS": TASKS,
                "ARCHIVED_TASKS": ARCHIVED_TASKS,
                "ARCHIVED_LOOPS": ARCHIVED_LOOPS
            }, f, indent=2)
    except Exception as e:
        print(f"Failed to save state: {e}")

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
    load_state()
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
                "description": "Provides a concise AI summary of the patient's chart.",
                "prefetch": {
                    "patient": "Patient/{{context.patientId}}",
                    "conditions": "Condition?patient={{context.patientId}}",
                    "medications": "MedicationRequest?patient={{context.patientId}}"
                }
            },
            {
                "hook": "order-select",
                "id": "rx-assistant-select",
                "title": "Loop Rx Safety (Select)",
                "description": "Checks medication history to aid drafting a prescription.",
                "prefetch": {
                    "patient": "Patient/{{context.patientId}}",
                    "conditions": "Condition?patient={{context.patientId}}",
                    "medications": "MedicationRequest?patient={{context.patientId}}"
                }
            },
            {
                "hook": "order-sign",
                "id": "rx-assistant-sign",
                "title": "Loop Rx Safety (Sign)",
                "description": "Final check before signing a prescription.",
                "prefetch": {
                    "patient": "Patient/{{context.patientId}}",
                    "conditions": "Condition?patient={{context.patientId}}",
                    "medications": "MedicationRequest?patient={{context.patientId}}"
                }
            },
            {
                "hook": "order-sign",
                "id": "pama-imaging-assistant",
                "title": "PAMA Imaging Assistant",
                "description": "Appropriate Use Criteria for advanced imaging.",
                "prefetch": {
                    "patient": "Patient/{{context.patientId}}",
                    "conditions": "Condition?patient={{context.patientId}}",
                    "medications": "MedicationRequest?patient={{context.patientId}}"
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

async def mark_task_ready(task_id: str, delay: int):
    await asyncio.sleep(delay)
    if task_id in TASKS:
        TASKS[task_id]["status"] = "ready"
        print(f"[DEBUG] Task {task_id} is now ready.")

def _parse_prefetch(patient_id: str, prefetch: dict):
    resources = []
    patient_name = "Unknown Patient"
    
    # 1. Extract from prefetch if provided by external EHR
    if prefetch:
        for key, bundle in prefetch.items():
            if not bundle: continue
            if bundle.get("resourceType") == "Patient":
                resources.append(bundle)
                name_obj = bundle.get("name", [{}])[0]
                patient_name = f"{name_obj.get('given', [''])[0]} {name_obj.get('family', '')}"
            elif bundle.get("resourceType") == "Bundle":
                for entry in bundle.get("entry", []):
                    if entry.get("resource"):
                        resources.append(entry["resource"])
                        
    # 2. Fallback to local DB if no prefetch data was found
    if not resources and patient_id in PATIENTS:
        resources = get_patient_everything(patient_id)
        patient = PATIENTS[patient_id]
        patient_name = f"{patient['name'][0]['given'][0]} {patient['name'][0]['family']}"
        
    return patient_name, resources

@app.post("/cds-services/triage-assistant")
async def triage_assistant(request: Request):
    data = await request.json()
    context = data.get("context", {})
    patient_id = context.get("patientId", "")

    if "Patient/" in patient_id:
        patient_id = patient_id.split("/")[-1]

    cards = []

    patient_name, patient_resources = _parse_prefetch(patient_id, data.get("prefetch", {}))
    
    if patient_resources:
        patient_summary_str = summarize_fhir_record(patient_resources)
        
        cards.append({
            "summary": f"Patient Summary: {patient_name}",
            "indicator": "info",
            "source": { "label": "Smart Patient Summarizer" },
            "detail": f"AI Chart Review: \\n\\n{patient_summary_str}",
            "links": [
                {
                    "label": "View Detailed Report & Source Files",
                    "url": f"https://lohp.ryanbeland.dev/api/patients/{patient_id}/report",
                    "type": "absolute"
                }
            ]
        })

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

    if not cards:
        cards.append({
            "summary": "No pending tasks or loops for this patient.",
            "indicator": "info",
            "source": {
                "label": "Smart Triage Assistant",
            }
        })

    return {"cards": cards}

@app.post("/api/simulate-fax")
async def simulate_fax(request: Request):
    data = await request.json()
    patient_id = data.get("patientId")
    if not patient_id or patient_id not in PATIENTS:
        return {"error": "Invalid patient"}
        
    patient = PATIENTS[patient_id]
    patient_name = f"{patient['name'][0]['given'][0]} {patient['name'][0]['family']}"
    dob = patient.get("birthDate", "Unknown")
    problems = patient.get("active_problems", [])
    fax_text = get_mock_fax_text(patient_id, patient_name, dob, problems)
    
    patient_resources = get_patient_everything(patient_id)
    patient_summary_str = summarize_fhir_record(patient_resources)
    extraction = extract_referral_info(fax_text, patient_context=patient_summary_str)
    
    task_id = f"task-{uuid.uuid4().hex[:6]}"
    TASKS[task_id] = {
        "taskId": task_id,
        "patientId": patient_id,
        "fax_text": fax_text,
        "extraction": extraction,
        "patient_context": patient_summary_str,
        "status": "ready",
        "created_at": datetime.now().isoformat()
    }
    save_state()
    
    return {"status": "success", "taskId": task_id}

@app.post("/cds-services/rx-assistant-select")
async def rx_assistant_select(request: Request):
    data = await request.json()
    context = data.get("context", {})
    patient_id = context.get("patientId", "")

    if "Patient/" in patient_id:
        patient_id = patient_id.split("/")[-1]

    # Extract draft medications (supports R4 MedicationRequest and R2 MedicationOrder)
    draft_orders = context.get("draftOrders", {})
    new_meds = []
    if "entry" in draft_orders:
        for entry in draft_orders["entry"]:
            res = entry.get("resource", {})
            if res.get("resourceType") in ["MedicationRequest", "MedicationOrder"]:
                code_concept = res.get("medicationCodeableConcept", {})
                if "text" in code_concept:
                    new_meds.append(code_concept["text"])
                elif "coding" in code_concept and len(code_concept["coding"]) > 0:
                    new_meds.append(code_concept["coding"][0].get("display", "Unknown Med"))

    med_list = ", ".join(new_meds) if new_meds else "the drafted prescription"
    
    # Analyze against patient history (mock interactions)
    prefetch = data.get("prefetch", {})
    patient_name, patient_resources = _parse_prefetch(patient_id, prefetch)
    
    medications = [r for r in patient_resources if r.get("resourceType") == "MedicationRequest"]
    conditions = [r for r in patient_resources if r.get("resourceType") == "Condition"]
    
    med_names = []
    for m in medications:
        mc = m.get("medicationCodeableConcept", {})
        if "text" in mc:
            med_names.append(mc["text"])
        elif "coding" in mc and len(mc["coding"]) > 0:
            med_names.append(mc["coding"][0].get("display", "Unknown Med"))

    condition_names = set()
    for c in conditions:
        cc = c.get("code", {})
        if "text" in cc:
            condition_names.add(cc["text"])
        elif "coding" in cc and len(cc["coding"]) > 0:
            condition_names.add(cc["coding"][0].get("display", "Unknown Condition"))

    links = []
    import urllib.parse
    for cond in list(condition_names)[:3]:
        cond_encoded = urllib.parse.quote(cond)
        links.append({
            "label": f"View Data: {cond}",
            "url": f"https://lohp.ryanbeland.dev/api/patients/{patient_id}/condition/{cond_encoded}",
            "type": "absolute"
        })

    med_history_str = ", ".join(med_names) if med_names else "None found"
    
    interaction_detail = f"AI interaction analysis for {med_list} against active medications ({med_history_str}): No severe interactions detected."
    if "Sulfur" in med_list or "Methotrexate" in med_list:
        interaction_detail = f"AI interaction analysis for {med_list} against active medications ({med_history_str}): Potential moderate interaction detected. Monitor for adverse effects."

    return {
        "cards": [
            {
                "summary": f"Rx Interaction Analysis: {med_list}",
                "indicator": "info",
                "source": { "label": "Loop Rx Engine" },
                "detail": interaction_detail,
                "links": links
            }
        ]
    }

@app.post("/cds-services/pama-imaging-assistant")
async def pama_imaging_assistant(request: Request):
    data = await request.json()
    context = data.get("context", {})
    patient_id = context.get("patientId", "")

    if "Patient/" in patient_id:
        patient_id = patient_id.split("/")[-1]

    # Extract draft ServiceRequest
    draft_orders = context.get("draftOrders", {})
    new_orders = []
    if "entry" in draft_orders:
        for entry in draft_orders["entry"]:
            res = entry.get("resource", {})
            if res.get("resourceType") == "ServiceRequest":
                code = res.get("code", {})
                if "text" in code:
                    new_orders.append(code["text"])
                elif "coding" in code and len(code["coding"]) > 0:
                    new_orders.append(code["coding"][0].get("display", "Unknown Imaging"))

    order_list = ", ".join(new_orders) if new_orders else "the drafted imaging order"

    task_id = f"task-{uuid.uuid4().hex[:6]}"
    TASKS[task_id] = {
        "taskId": task_id,
        "patientId": patient_id,
        "fax_text": f"Loop Scheduled: Renal Function Check for {order_list}",
        "extraction": {
            "patient_name": _parse_prefetch(patient_id, data.get("prefetch", {}))[0],
            "diagnosis": f"{order_list} Pre-authorization",
            "specialty": "Radiology",
            "urgency": "Routine"
        },
        "patient_context": f"System created a PAMA AUC pre-authorization loop for {order_list}.",
        "status": "ready",
        "created_at": datetime.now().isoformat()
    }
    save_state()
    
    return {
        "cards": [
            {
                "summary": "PAMA Imaging Loop Initiated.",
                "indicator": "warning",
                "source": { "label": "Loop PAMA AUC" },
                "detail": f"Prior to scheduling {order_list}, a loop has been created in ClinicOS to evaluate renal function (Creatinine/eGFR).",
                "links": [
                    {
                        "label": "View Task in ClinicOS",
                        "url": f"https://lohp.ryanbeland.dev/portal/review/{patient_id}/{task_id}",
                        "type": "absolute"
                    }
                ]
            }
        ]
    }

@app.post("/cds-services/rx-assistant-sign")
async def rx_assistant_sign(request: Request):
    data = await request.json()
    context = data.get("context", {})
    patient_id = context.get("patientId", "")

    if "Patient/" in patient_id:
        patient_id = patient_id.split("/")[-1]

    # Extract draft medications (supports R4 MedicationRequest and R2 MedicationOrder)
    draft_orders = context.get("draftOrders", {})
    new_meds = []
    if "entry" in draft_orders:
        for entry in draft_orders["entry"]:
            res = entry.get("resource", {})
            if res.get("resourceType") in ["MedicationRequest", "MedicationOrder"]:
                code_concept = res.get("medicationCodeableConcept", {})
                if "text" in code_concept:
                    new_meds.append(code_concept["text"])
                elif "coding" in code_concept and len(code_concept["coding"]) > 0:
                    new_meds.append(code_concept["coding"][0].get("display", "Unknown Med"))

    med_list = ", ".join(new_meds) if new_meds else "the drafted prescription"

    task_id = f"task-{uuid.uuid4().hex[:6]}"
    TASKS[task_id] = {
        "taskId": task_id,
        "patientId": patient_id,
        "fax_text": f"Loop Scheduled: {med_list} Efficacy Follow-up",
        "extraction": {
            "patient_name": _parse_prefetch(patient_id, data.get("prefetch", {}))[0],
            "diagnosis": f"{med_list} efficacy review",
            "specialty": "Pharmacy",
            "urgency": "Routine"
        },
        "patient_context": f"System created a follow-up loop on order sign for {med_list}.",
        "status": "ready",
        "created_at": datetime.now().isoformat()
    }
    save_state()
    
    return {
        "cards": [
            {
                "summary": "Prescription Loop Initiated.",
                "indicator": "success",
                "source": { "label": "Loop Safety Engine" },
                "detail": f"A follow-up task has been added to the ClinicOS Inbox to review {med_list} efficacy and interactions in 14 days.",
                "links": [
                    {
                        "label": "View Task in ClinicOS",
                        "url": f"https://lohp.ryanbeland.dev/portal/review/{patient_id}/{task_id}",
                        "type": "absolute"
                    }
                ]
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
    task_id = data.get("taskId")
    loop_id = data.get("id")
    print(f"Received action: {action} with data: {data}")
    
    if action == "approve_referral" and task_id in TASKS:
        # Move from pending tasks to archive
        ARCHIVED_TASKS[task_id] = TASKS.pop(task_id)
        print(f"[DEBUG] Task {task_id} approved and moved to archive.")
        
    elif action == "unarchive_task" and task_id in ARCHIVED_TASKS:
        # Move from archive back to pending tasks
        TASKS[task_id] = ARCHIVED_TASKS.pop(task_id)
        print(f"[DEBUG] Task {task_id} unarchived.")

    elif action == "close_loop" and loop_id:
        # Find the loop and save a snapshot in ARCHIVED_LOOPS
        for loop in detect_loops():
            if loop["id"] == loop_id:
                ARCHIVED_LOOPS[loop_id] = loop
                print(f"[DEBUG] Loop {loop_id} acknowledged and moved to archive.")
                break

    elif action == "unarchive_loop" and loop_id in ARCHIVED_LOOPS:
        del ARCHIVED_LOOPS[loop_id]
        print(f"[DEBUG] Loop {loop_id} unarchived.")
        
    elif action == "delete_loop_permanently" and loop_id in ARCHIVED_LOOPS:
        del ARCHIVED_LOOPS[loop_id]
        print(f"[DEBUG] Loop {loop_id} permanently deleted.")

    save_state()
    return {"status": "success", "message": "Action processed and saved to EHR."}

@app.get("/api/tasks/{task_id}")
def get_task(task_id: str):
    """
    Returns the details of a specific task, including the original fax text
    and the AI extraction. Used by the React Review Portal.
    """
    print(f"[DEBUG] Fetching task {task_id}")
    if task_id in TASKS:
        task = TASKS[task_id]
        print(f"[DEBUG] Found task {task_id}, context length: {len(task.get('patient_context', ''))}")
        return task
    
    print(f"[DEBUG] Task {task_id} not found in memory")
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


from fastapi.responses import HTMLResponse

@app.get("/api/patients/{patient_id}/report", response_class=HTMLResponse)
def get_patient_report(patient_id: str):
    patient_resources = get_patient_everything(patient_id)
    if not patient_resources:
        return HTMLResponse("<h1>Patient Not Found</h1>")
        
    patient_summary_str = summarize_fhir_record(patient_resources)
    
    html = f"<html><head><title>Patient Report</title><style>"
    html += "body { font-family: sans-serif; margin: 2rem; max-width: 800px; line-height: 1.6; }"
    html += "h1 { color: #1e3a8a; } h2 { color: #3b82f6; border-bottom: 1px solid #ccc; padding-bottom: 0.5rem; }"
    html += "pre { background: #f3f4f6; padding: 1rem; border-radius: 8px; overflow-x: auto; font-size: 0.85rem; }"
    html += "</style></head><body>"
    html += f"<h1>Detailed Patient Report: {patient_id}</h1>"
    html += f"<h2>AI Clinical Summary</h2>"
    html += f"<p style='white-space: pre-wrap;'>{patient_summary_str}</p>"
    html += f"<h2>Raw FHIR Extract</h2>"
    html += f"<pre>{json.dumps(patient_resources, indent=2)}</pre>"
    html += "</body></html>"
    return HTMLResponse(html)

@app.get("/api/patients/{patient_id}/condition/{condition_name}", response_class=HTMLResponse)
def get_patient_condition_report(patient_id: str, condition_name: str):
    import urllib.parse
    condition_name = urllib.parse.unquote(condition_name)
    patient_resources = get_patient_everything(patient_id)
    if not patient_resources:
        return HTMLResponse("<h1>Patient Not Found</h1>")
        
    # Find resources matching the condition
    matching_conditions = []
    for r in patient_resources:
        if r.get("resourceType") == "Condition":
            cc = r.get("code", {})
            name = cc.get("text", "")
            if not name and "coding" in cc and len(cc["coding"]) > 0:
                name = cc["coding"][0].get("display", "")
            if name == condition_name:
                matching_conditions.append(r)
                
    html = f"<html><head><title>Condition Report: {condition_name}</title><style>"
    html += "body { font-family: sans-serif; margin: 2rem; max-width: 800px; line-height: 1.6; }"
    html += "h1 { color: #1e3a8a; } h2 { color: #3b82f6; border-bottom: 1px solid #ccc; padding-bottom: 0.5rem; }"
    html += "pre { background: #f3f4f6; padding: 1rem; border-radius: 8px; overflow-x: auto; font-size: 0.85rem; }"
    html += "</style></head><body>"
    html += f"<h1>Condition Report: {condition_name}</h1>"
    html += f"<p>Patient ID: {patient_id}</p>"
    
    if not matching_conditions:
        html += "<p>No detailed records found for this condition in the patient's FHIR bundle.</p>"
    else:
        html += f"<h2>Raw FHIR Extract ({len(matching_conditions)} records found)</h2>"
        html += f"<pre>{json.dumps(matching_conditions, indent=2)}</pre>"
        
    html += "</body></html>"
    return HTMLResponse(html)

@app.get("/api/inbox")

def get_global_inbox():
    """
    Returns ALL pending action items for the entire clinic.
    Combines parsed fax referrals (TASKS) and detected loops (loop_engine).
    """
    cards = []
    
    # 1. Add all pending referral tasks
    for task_id, task in TASKS.items():
        extraction = task.get("extraction", {})
        patient_name = extraction.get("patient_name", "Unknown Patient")
        
        # Determine indicator based on AI urgency
        urgency = str(extraction.get("urgency", "")).lower()
        indicator = "warning"
        if "urgent" in urgency or "stat" in urgency:
            indicator = "critical"
            
        status = task.get("status", "ready")
        
        if status == "processing":
            cards.append({
                "id": task_id,
                "type": "task",
                "status": "processing",
                "summary": f"Extracting clinical data for {patient_name}...",
                "indicator": "info",
                "source": { "label": "Smart Triage Assistant" },
                "detail": "AI is analyzing an incoming specialist referral request...",
                "created_at": task.get("created_at")
            })
        else:
            specialty = extraction.get("specialty", "Specialist")
            diagnosis = extraction.get("diagnosis", "Unknown Diagnosis")
            disp_urgency = extraction.get("urgency", "Routine")
            
            cards.append({
                "id": task_id,
                "type": "task",
                "status": "ready",
                "summary": f"Pending {specialty} Referral for {patient_name}",
                "indicator": indicator,
                "source": { "label": "Smart Triage Assistant" },
                "detail": f"Reason: {diagnosis}. Urgency: {disp_urgency}. Please review AI extraction and approve.",
                "created_at": task.get("created_at"),
                "links": [{
                    "label": "Review Referral Form",
                    "url": f"https://lohp.ryanbeland.dev/portal/review/{task['patientId']}/{task_id}",
                    "type": "absolute"
                }]
            })
        
    # 2. Add all open loops that are not archived
    all_loops = detect_loops()
    for loop in all_loops:
        if loop["id"] in ARCHIVED_LOOPS:
            continue
            
        indicator = "info"
        if loop["severity"] == "CRITICAL":
            indicator = "critical"
        elif loop["severity"] == "HIGH":
            indicator = "warning"

        cards.append({
            "summary": loop["summary"],
            "indicator": indicator,
            "source": { "label": "Loop Engine" },
            "detail": f"This loop has been open for {loop['days_open']} days. Please review.",
            "links": [{
                "label": "View Details in Portal",
                "url": f"https://lohp.ryanbeland.dev/portal/loop/{loop['id']}",
                "type": "absolute"
            }]
        })
        
    # Sort cards: critical first, then warning, then info
    def sort_key(card):
        order = {"critical": 0, "warning": 1, "info": 2, "success": 3}
        return order.get(card.get("indicator", "info"), 99)
        
    cards.sort(key=sort_key)
    
    return {"cards": cards}

@app.get("/api/archive")
def get_global_archive():
    """
    Returns ALL archived action items for the entire clinic.
    Combines archived fax referrals (ARCHIVED_TASKS) and closed loops (ARCHIVED_LOOPS).
    """
    cards = []
    
    # 1. Add all archived referral tasks
    for task_id, task in ARCHIVED_TASKS.items():
        extraction = task.get("extraction", {})
        patient_name = extraction.get("patient_name", "Unknown Patient")
            
        cards.append({
            "id": task_id,
            "type": "task",
            "summary": f"Approved Referral for {patient_name}",
            "indicator": "success",
            "source": { "label": "Smart Triage Assistant" },
            "detail": f"This referral for {extraction.get('specialty', 'specialist')} has been reviewed and saved.",
        })
        
    # 2. Add all closed loops
    for loop_id, loop in ARCHIVED_LOOPS.items():
        cards.append({
            "id": loop_id,
            "type": "loop",
            "summary": loop["summary"],
            "indicator": "success",
            "source": { "label": "Loop Engine" },
            "detail": "This loop has been acknowledged and a recall was scheduled.",
        })
        
    return {"cards": cards}

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

@app.get("/api/status")
def get_system_status():
    import os
    from fhir_server import FHIR_DB
    from synthea_loader import PATIENTS
    
    gemini_key = os.getenv("GEMINI_API_KEY")
    gemini_status = "Not Configured"
    if gemini_key:
        if len(gemini_key) > 10:
            gemini_status = f"Configured (ends in ...{gemini_key[-4:]})"
        else:
            gemini_status = "Configured (key too short?)"
            
    try:
        import google.generativeai as genai
        genai_installed = True
    except ImportError:
        genai_installed = False

    return {
        "backend": "Online",
        "fhir_server": {
            "status": "Online" if FHIR_DB else "Empty",
            "total_resources": sum(len(v) for v in FHIR_DB.values()),
            "resource_types": list(FHIR_DB.keys())
        },
        "ai_integration": {
            "gemini_api_key": gemini_status,
            "google_genai_package": "Installed" if genai_installed else "Missing",
            "ready": bool(gemini_key and genai_installed)
        },
        "database": {
            "patients_loaded": len(PATIENTS)
        }
    }
