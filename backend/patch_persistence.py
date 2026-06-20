import re

with open("main.py", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add persistence state management
persistence_code = """
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
"""
content = content.replace('app = FastAPI(title="Smart Triage & CDS Portal API")', persistence_code)

# 2. Add load_state() to startup_event
startup_event_code = """@app.on_event("startup")
def startup_event():
    load_state()
    load_fhir_data()"""
content = content.replace('@app.on_event("startup")\ndef startup_event():\n    load_fhir_data()', startup_event_code)


# 3. Add save_state() to simulate_fax
simulate_fax_code = """    TASKS[task_id] = {
        "taskId": task_id,
        "patientId": patient_id,
        "fax_text": fax_text,
        "extraction": extraction,
        "patient_context": patient_summary_str,
        "status": "ready",
        "created_at": datetime.now().isoformat()
    }
    save_state()
    
    return {"status": "success", "taskId": task_id}"""
content = re.sub(r'    TASKS\[task_id\] = \{[\s\S]*?"created_at": datetime\.now\(\)\.isoformat\(\)\n    \}\n    \n    return \{"status": "success", "taskId": task_id\}', simulate_fax_code, content)

# 4. Add save_state() to rx_assistant_sign
rx_sign_code = """    TASKS[task_id] = {
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
    
    return {"""
content = re.sub(r'    TASKS\[task_id\] = \{[\s\S]*?"created_at": datetime\.now\(\)\.isoformat\(\)\n    \}\n    \n    return \{', rx_sign_code, content)

# 5. Add save_state() to pama_imaging_assistant
pama_code = """    TASKS[task_id] = {
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
    
    return {"""
content = re.sub(r'    TASKS\[task_id\] = \{[\s\S]*?"created_at": datetime\.now\(\)\.isoformat\(\)\n    \}\n    \n    return \{', pama_code, content)


# 6. Add delete_loop_permanently logic and save_state to handle_action
old_action = """    elif action == "unarchive_loop" and loop_id in ARCHIVED_LOOPS:
        del ARCHIVED_LOOPS[loop_id]
        print(f"[DEBUG] Loop {loop_id} unarchived.")

    return {"status": "success", "message": "Action processed and saved to EHR."}"""

new_action = """    elif action == "unarchive_loop" and loop_id in ARCHIVED_LOOPS:
        del ARCHIVED_LOOPS[loop_id]
        print(f"[DEBUG] Loop {loop_id} unarchived.")
        
    elif action == "delete_loop_permanently" and loop_id in ARCHIVED_LOOPS:
        del ARCHIVED_LOOPS[loop_id]
        print(f"[DEBUG] Loop {loop_id} permanently deleted.")

    save_state()
    return {"status": "success", "message": "Action processed and saved to EHR."}"""
content = content.replace(old_action, new_action)


# 7. Add patient report endpoint and update triage-assistant link
report_endpoint = """
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

@app.get("/api/inbox")
"""
content = content.replace('@app.get("/api/inbox")', report_endpoint)

# 8. Add link to triage-assistant
old_triage = """        cards.append({
            "summary": f"Patient Summary: {patient_name}",
            "indicator": "info",
            "source": { "label": "Smart Patient Summarizer" },
            "detail": f"AI Chart Review: \\n\\n{patient_summary_str}"
        })"""

new_triage = """        cards.append({
            "summary": f"Patient Summary: {patient_name}",
            "indicator": "info",
            "source": { "label": "Smart Patient Summarizer" },
            "detail": f"AI Chart Review: \\n\\n{patient_summary_str}",
            "links": [
                {
                    "label": "View Detailed Report & Source Files",
                    "url": f"http://127.0.0.1:8000/api/patients/{patient_id}/report",
                    "type": "absolute"
                }
            ]
        })"""
content = content.replace(old_triage, new_triage)

# 9. Ensure `import os` exists
if "import os" not in content:
    content = content.replace("import json", "import json\nimport os")

with open("main.py", "w", encoding="utf-8") as f:
    f.write(content)
