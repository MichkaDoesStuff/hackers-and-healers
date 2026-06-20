import re
import uuid

with open("main.py", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update discovery endpoint
new_discovery = """@app.get("/cds-services")
def discovery():
    return {
        "services": [
            {
                "hook": "patient-view",
                "id": "triage-assistant",
                "title": "Smart Triage Assistant",
                "description": "Provides a concise AI summary of the patient's chart.",
                "prefetch": {
                    "patient": "Patient/{{context.patientId}}"
                }
            },
            {
                "hook": "order-select",
                "id": "rx-assistant-select",
                "title": "Loop Rx Safety (Select)",
                "description": "Checks medication history to aid drafting a prescription.",
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
            },
            {
                "hook": "order-select",
                "id": "pama-imaging-assistant",
                "title": "PAMA Imaging Assistant",
                "description": "Appropriate Use Criteria for advanced imaging.",
                "prefetch": {
                    "patient": "Patient/{{context.patientId}}"
                }
            }
        ]
    }"""

content = re.sub(r'@app\.get\("/cds-services"\).*?        \]\n    \}', new_discovery, content, flags=re.DOTALL)

# 2. Refactor triage-assistant
new_triage = """@app.post("/cds-services/triage-assistant")
async def triage_assistant(request: Request):
    data = await request.json()
    context = data.get("context", {})
    patient_id = context.get("patientId", "")

    if "Patient/" in patient_id:
        patient_id = patient_id.split("/")[-1]

    cards = []

    if patient_id in PATIENTS:
        patient = PATIENTS[patient_id]
        patient_name = f"{patient['name'][0]['given'][0]} {patient['name'][0]['family']}"
        
        patient_resources = get_patient_everything(patient_id)
        patient_summary_str = summarize_fhir_record(patient_resources)
        
        cards.append({
            "summary": f"Patient Summary: {patient_name}",
            "indicator": "info",
            "source": { "label": "Smart Patient Summarizer" },
            "detail": f"AI Chart Review:\\n\\n{patient_summary_str}"
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
        "status": "processing"
    }
    asyncio.create_task(mark_task_ready(task_id, 3))
    return {"status": "success", "taskId": task_id}
"""

content = re.sub(r'@app\.post\("/cds-services/triage-assistant"\).*?return \{"cards": cards\}', new_triage, content, flags=re.DOTALL)

# 3. Refactor rx hooks & add pama
new_rx = """@app.post("/cds-services/rx-assistant-select")
async def rx_assistant_select(request: Request):
    data = await request.json()
    context = data.get("context", {})
    patient_id = context.get("patientId", "")
    if "Patient/" in patient_id:
        patient_id = patient_id.split("/")[-1]
        
    # Get medication history
    resources = get_patient_everything(patient_id)
    meds = [r for r in resources if r["resourceType"] == "MedicationRequest"]
    med_names = [m.get("medicationCodeableConcept", {}).get("text", "Unknown Med") for m in meds[:5]]
    med_str = ", ".join(med_names) if med_names else "No active prescriptions found."
    
    return {
        "cards": [
            {
                "summary": "Patient Medication History",
                "indicator": "info",
                "source": { "label": "Loop Rx Engine" },
                "detail": f"Recent Treatments: {med_str}. Verify no drug-drug interactions before drafting this order."
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
        
    # Start a loop in the global inbox!
    task_id = f"task-{uuid.uuid4().hex[:6]}"
    TASKS[task_id] = {
        "taskId": task_id,
        "patientId": patient_id,
        "fax_text": "Loop Scheduled: Prescription Efficacy Follow-up",
        "extraction": {
            "patient_name": PATIENTS.get(patient_id, {}).get("name", [{"given": ["Unknown"], "family": ""}])[0].get("given", ["Unknown"])[0] + " " + PATIENTS.get(patient_id, {}).get("name", [{"given": [""], "family": "Patient"}])[0].get("family", ""),
            "diagnosis": "Medication efficacy review",
            "specialty": "Pharmacy",
            "urgency": "Routine"
        },
        "patient_context": "System created a loop on order sign.",
        "status": "ready"
    }
    
    return {
        "cards": [
            {
                "summary": "Prescription Loop Initiated.",
                "indicator": "success",
                "source": { "label": "Loop Safety Engine" },
                "detail": "A follow-up task has been added to the ClinicOS Inbox to review medication efficacy in 14 days."
            }
        ]
    }

@app.post("/cds-services/pama-imaging-assistant")
async def pama_imaging_assistant(request: Request):
    return {
        "cards": [
            {
                "summary": "PAMA Imaging Alert",
                "indicator": "warning",
                "source": { "label": "Loop PAMA AUC" },
                "detail": "Prior to scheduling advanced imaging (e.g., CT with contrast), consider ordering a Creatinine/eGFR blood test to evaluate renal function."
            }
        ]
    }
"""

content = re.sub(r'@app\.post\("/cds-services/rx-assistant-select"\).*?\]\n    \}', new_rx, content, flags=re.DOTALL)

with open("main.py", "w", encoding="utf-8") as f:
    f.write(content)
