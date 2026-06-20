"""Loop's own actioned-state store.

A loop is 'actioned' once a clinician approves and Loop writes the follow-up to
FHIR. We record that here — in Loop's store — rather than inferring it from a FHIR
search, because HAPI indexes searches asynchronously (a just-written Task is not
findable for several seconds). This store is immediately consistent, so a loop
closes the instant it is approved. The FHIR Task/Provenance remain the system of
record; this is just the fast in-flight index.
"""
from __future__ import annotations

import json
from pathlib import Path
from threading import Lock

STORE_PATH = Path(__file__).resolve().parents[2] / "data" / "actioned.json"
_lock = Lock()


def _read() -> set[str]:
    if not STORE_PATH.exists():
        return set()
    try:
        return set(json.loads(STORE_PATH.read_text()))
    except (json.JSONDecodeError, ValueError):
        return set()


def actioned_focuses() -> set[str]:
    """Resource refs (e.g. 'Observation/9662') that Loop has already actioned."""
    with _lock:
        return _read()


def mark_actioned(refs: list[str]) -> None:
    with _lock:
        current = _read()
        current.update(r for r in refs if r)
        STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
        STORE_PATH.write_text(json.dumps(sorted(current), indent=2))


def reset() -> None:
    """Clear the store (used when reseeding demo data)."""
    with _lock:
        if STORE_PATH.exists():
            STORE_PATH.unlink()
