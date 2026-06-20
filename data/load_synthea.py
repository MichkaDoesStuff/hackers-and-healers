"""Download the Synthea FHIR R4 sample set and load it into HAPI.

Usage:
    python data/load_synthea.py            # load ~20 patients (default)
    python data/load_synthea.py --count 50
    python data/load_synthea.py --url <zip-url>

No Java needed: we use MITRE's pre-built sample bundles.
"""
from __future__ import annotations

import argparse
import io
import os
import sys
import zipfile

import httpx

FHIR_BASE = os.getenv("FHIR_BASE", "http://localhost:8080/fhir")
DEFAULT_URL = os.getenv(
    "SYNTHEA_URL",
    "https://synthetichealth.github.io/synthea-sample-data/downloads/synthea_sample_data_fhir_r4_sep2019.zip",
)
HEADERS = {"Accept": "application/fhir+json", "Content-Type": "application/fhir+json"}


def fetch_zip(url: str) -> zipfile.ZipFile:
    print(f"Downloading Synthea sample: {url}")
    with httpx.Client(timeout=120.0, follow_redirects=True) as c:
        r = c.get(url)
        r.raise_for_status()
    print(f"  got {len(r.content) // 1024} KB")
    return zipfile.ZipFile(io.BytesIO(r.content))


def post_bundle(client: httpx.Client, raw: bytes) -> bool:
    r = client.post(FHIR_BASE, content=raw)
    if r.status_code >= 400:
        print(f"  ! {r.status_code}: {r.text[:200]}")
        return False
    return True


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--count", type=int, default=20, help="number of patient bundles to load")
    ap.add_argument("--url", default=DEFAULT_URL)
    args = ap.parse_args()

    zf = fetch_zip(args.url)
    names = [n for n in zf.namelist() if n.endswith(".json")]

    # Load org/practitioner reference bundles first so patient references resolve.
    infra = [n for n in names if "hospitalInformation" in n or "practitionerInformation" in n]
    patients = [n for n in names if n not in infra]
    patients = patients[: args.count]

    print(f"Loading {len(infra)} infrastructure + {len(patients)} patient bundles into {FHIR_BASE}")
    ok = 0
    with httpx.Client(timeout=120.0, headers=HEADERS) as client:
        for n in infra + patients:
            if post_bundle(client, zf.read(n)):
                ok += 1
                if ok % 5 == 0:
                    print(f"  loaded {ok}...")
    print(f"Done. {ok}/{len(infra) + len(patients)} bundles loaded.")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
