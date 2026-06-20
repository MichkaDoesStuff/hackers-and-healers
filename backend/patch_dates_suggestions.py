import re
from datetime import datetime
import uuid

with open("main.py", "r", encoding="utf-8") as f:
    content = f.read()

if "from datetime import datetime" not in content:
    content = content.replace("import uuid", "import uuid\\nfrom datetime import datetime")

# 1. Update simulate-fax to add created_at
simulate_fax_repl = """    task_id = f"task-{uuid.uuid4().hex[:6]}"
    TASKS[task_id] = {
        "taskId": task_id,
        "patientId": patient_id,
        "fax_text": fax_text,
        "extraction": extraction,
        "patient_context": patient_summary_str,
        "status": "processing",
        "created_at": datetime.now().isoformat()
    }"""
content = re.sub(r'    task_id = f"task-\{uuid\.uuid4\(\)\.hex\[:6\]\}"\n    TASKS\[task_id\] = \{\n.*?        "status": "processing"\n    \}', simulate_fax_repl, content, flags=re.DOTALL)

# 2. Update rx-assistant-sign to add created_at
rx_sign_repl = """    task_id = f"task-{uuid.uuid4().hex[:6]}"
    TASKS[task_id] = {
        "taskId": task_id,
        "patientId": patient_id,
        "fax_text": f"Loop Scheduled: {med_list} Efficacy Follow-up",
        "extraction": {
            "patient_name": PATIENTS.get(patient_id, {}).get("name", [{"given": ["Unknown"], "family": ""}])[0].get("given", ["Unknown"])[0] + " " + PATIENTS.get(patient_id, {}).get("name", [{"given": [""], "family": "Patient"}])[0].get("family", ""),
            "diagnosis": f"{med_list} efficacy review",
            "specialty": "Pharmacy",
            "urgency": "Routine"
        },
        "patient_context": f"System created a follow-up loop on order sign for {med_list}.",
        "status": "ready",
        "created_at": datetime.now().isoformat()
    }"""
content = re.sub(r'    task_id = f"task-\{uuid\.uuid4\(\)\.hex\[:6\]\}"\n    TASKS\[task_id\] = \{\n.*?        "status": "ready"\n    \}', rx_sign_repl, content, flags=re.DOTALL)

# 3. Update rx-assistant-select to add suggestions
rx_select_repl = """    patient_summary_str = summarize_fhir_record(resources)
    
    conditions = [r for r in resources if r["resourceType"] == "Condition"]
    condition_names = list(set([c.get("code", {}).get("text", "Unknown Condition") for c in conditions]))
    
    suggestions = []
    for idx, c in enumerate(condition_names[:3]):
        suggestions.append({
            "label": f"Treating {c}",
            "uuid": str(uuid.uuid4()),
            "actions": [
                {
                    "type": "update",
                    "description": f"Link prescription to {c}",
                    "resource": {}
                }
            ]
        })
    suggestions.append({
        "label": "Treating Other",
        "uuid": str(uuid.uuid4()),
        "actions": [{"type": "update", "description": "Other reason", "resource": {}}]
    })
    
    return {
        "cards": [
            {
                "summary": "Patient Medical Context",
                "indicator": "info",
                "source": { "label": "Loop Rx Engine" },
                "detail": f"Recent Treatments: {med_str}\\n\\nPatient Summary:\\n{patient_summary_str}",
                "suggestions": suggestions
            },
            {
                "summary": f"Interaction Analysis: {med_list}",
                "indicator": "warning",
                "source": { "label": "Loop Safety Engine" },
                "detail": f"Analyzing {med_list} against patient history. Potential interactions detected with active conditions. Review carefully before signing."
            }
        ]
    }"""
content = re.sub(r'    patient_summary_str = summarize_fhir_record\(resources\)\n    \n    return \{\n        "cards": \[\n.*?        \]\n    \}', rx_select_repl, content, flags=re.DOTALL)

with open("main.py", "w", encoding="utf-8") as f:
    f.write(content)
