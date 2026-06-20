import os
import json
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse

fhir_router = APIRouter()

# In-memory FHIR database
# DB structure: { "Patient": { "id1": {...}, "id2": {...} }, "Condition": {...} }
FHIR_DB = {}

def load_fhir_data():
    global FHIR_DB
    FHIR_DB.clear()
    
    # We will use the R4 dataset as our FHIR server base
    base_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "synthea_sample_data_fhir_latest")
    
    if not os.path.exists(base_dir):
        print(f"Warning: FHIR directory {base_dir} not found. FHIR server will be empty.")
        return

    print(f"Loading FHIR R4 dataset from {base_dir}...")
    for filename in os.listdir(base_dir):
        if not filename.endswith(".json"):
            continue
            
        file_path = os.path.join(base_dir, filename)
        with open(file_path, "r", encoding="utf-8") as f:
            try:
                bundle = json.load(f)
                if bundle.get("resourceType") == "Bundle":
                    for entry in bundle.get("entry", []):
                        resource = entry.get("resource")
                        if resource:
                            res_type = resource.get("resourceType")
                            res_id = resource.get("id")
                            if res_type and res_id:
                                if res_type not in FHIR_DB:
                                    FHIR_DB[res_type] = {}
                                FHIR_DB[res_type][res_id] = resource
            except Exception as e:
                print(f"Failed to load FHIR bundle {filename}: {e}")

    print(f"FHIR server loaded with {sum(len(v) for v in FHIR_DB.values())} total resources across {len(FHIR_DB)} resource types.")

@fhir_router.get("/metadata")
def get_metadata():
    """Returns a basic FHIR CapabilityStatement"""
    return {
        "resourceType": "CapabilityStatement",
        "status": "active",
        "date": "2026-06-20",
        "publisher": "Loop Smart Triage",
        "kind": "instance",
        "software": {
            "name": "Loop In-Memory FHIR Server"
        },
        "fhirVersion": "4.0.1",
        "format": ["application/json", "application/fhir+json"],
        "rest": [
            {
                "mode": "server",
                "resource": [
                    {
                        "type": res_type,
                        "interaction": [{"code": "read"}, {"code": "search-type"}],
                        "searchParam": [
                            {"name": "patient", "type": "reference"}
                        ]
                    } for res_type in FHIR_DB.keys()
                ]
            }
        ]
    }

@fhir_router.get("/{resource_type}/{resource_id}")
def get_resource(resource_type: str, resource_id: str):
    """Read a specific resource by ID"""
    if resource_type not in FHIR_DB or resource_id not in FHIR_DB[resource_type]:
        raise HTTPException(status_code=404, detail="Resource not found")
    return FHIR_DB[resource_type][resource_id]

@fhir_router.get("/{resource_type}")
def search_resources(resource_type: str, request: Request):
    """Search resources. Simplistic implementation for 'patient' parameter."""
    if resource_type not in FHIR_DB:
        return _build_bundle([])
        
    resources = list(FHIR_DB[resource_type].values())
    
    # Very basic search filtering (specifically for patient reference)
    patient_ref = request.query_params.get("patient")
    if patient_ref:
        if not patient_ref.startswith("Patient/"):
            patient_ref = f"Patient/{patient_ref}"
            
        filtered = []
        for r in resources:
            # Check subject or patient references (common in FHIR)
            ref_val = None
            if "subject" in r and isinstance(r["subject"], dict):
                ref_val = r["subject"].get("reference")
            elif "patient" in r and isinstance(r["patient"], dict):
                ref_val = r["patient"].get("reference")
            
            if ref_val == patient_ref:
                filtered.append(r)
        resources = filtered

    return _build_bundle(resources)

def _build_bundle(resources):
    return {
        "resourceType": "Bundle",
        "type": "searchset",
        "total": len(resources),
        "entry": [{"resource": r} for r in resources]
    }
