import re

with open("main.py", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update the discovery endpoint to request more prefetch data
new_prefetch = """                "prefetch": {
                    "patient": "Patient/{{context.patientId}}",
                    "conditions": "Condition?patient={{context.patientId}}",
                    "medications": "MedicationRequest?patient={{context.patientId}}"
                }"""
content = re.sub(r'                "prefetch": \{\n                    "patient": "Patient/\{\{context\.patientId\}\}"\n                \}', new_prefetch, content)


# 2. Inject the _parse_prefetch helper function before triage_assistant
helper_func = """def _parse_prefetch(patient_id: str, prefetch: dict):
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

@app.post("/cds-services/triage-assistant")"""
content = content.replace('@app.post("/cds-services/triage-assistant")', helper_func)


# 3. Refactor triage-assistant to use the helper
old_triage_body = """    cards = []

    if patient_id in PATIENTS:
        patient = PATIENTS[patient_id]
        patient_name = f"{patient['name'][0]['given'][0]} {patient['name'][0]['family']}"
        
        patient_resources = get_patient_everything(patient_id)
        patient_summary_str = summarize_fhir_record(patient_resources)
        
        cards.append({
            "summary": f"Patient Summary: {patient_name}",
            "indicator": "info",
            "source": { "label": "Smart Patient Summarizer" },
            "detail": f"AI Chart Review: \\n\\n{patient_summary_str}"
        })

    all_loops = detect_loops()"""

new_triage_body = """    cards = []

    patient_name, patient_resources = _parse_prefetch(patient_id, data.get("prefetch", {}))
    
    if patient_resources:
        patient_summary_str = summarize_fhir_record(patient_resources)
        cards.append({
            "summary": f"Patient Summary: {patient_name}",
            "indicator": "info",
            "source": { "label": "Smart Patient Summarizer" },
            "detail": f"AI Chart Review: \\n\\n{patient_summary_str}"
        })

    all_loops = detect_loops()"""
content = content.replace(old_triage_body, new_triage_body)


# 4. Refactor rx-assistant-select
old_rx_select = """    med_list = ", ".join(new_meds) if new_meds else "the drafted prescription"
        
    # Get medication history & clinical summary
    resources = get_patient_everything(patient_id)
    meds = [r for r in resources if r["resourceType"] == "MedicationRequest"]"""

new_rx_select = """    med_list = ", ".join(new_meds) if new_meds else "the drafted prescription"
        
    # Get medication history & clinical summary from prefetch or local DB
    patient_name, resources = _parse_prefetch(patient_id, data.get("prefetch", {}))
    
    if not resources:
        return {"cards": [{"summary": "No Patient Data Found", "indicator": "warning", "source": {"label": "Loop Rx Engine"}, "detail": "Could not fetch patient data from EHR or Local DB."}]}
        
    meds = [r for r in resources if r["resourceType"] == "MedicationRequest"]"""
content = content.replace(old_rx_select, new_rx_select)


# 5. Refactor rx-assistant-sign
old_rx_sign = """        "extraction": {
            "patient_name": PATIENTS.get(patient_id, {}).get("name", [{"given": ["Unknown"], "family": ""}])[0].get("given", ["Unknown"])[0] + " " + PATIENTS.get(patient_id, {}).get("name", [{"given": [""], "family": "Patient"}])[0].get("family", ""),
            "diagnosis": f"{med_list} efficacy review","""

new_rx_sign = """        "extraction": {
            "patient_name": _parse_prefetch(patient_id, data.get("prefetch", {}))[0],
            "diagnosis": f"{med_list} efficacy review","""
content = content.replace(old_rx_sign, new_rx_sign)


with open("main.py", "w", encoding="utf-8") as f:
    f.write(content)
