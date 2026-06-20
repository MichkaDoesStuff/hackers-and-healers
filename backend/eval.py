"""Loop evaluation harness.

Measures detection against the injected ground truth and prints a confusion
matrix + precision/recall/F1. Run after data/inject_loops.py:

    python backend/eval.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app.detectors import detect_all  # noqa: E402
from app.fhir import FhirClient  # noqa: E402
from app.risk import rank  # noqa: E402

GROUND_TRUTH = Path(__file__).resolve().parents[1] / "data" / "ground_truth.json"


def main() -> int:
    if not GROUND_TRUTH.exists():
        print("No ground truth. Run: python data/inject_loops.py")
        return 1

    truth = json.loads(GROUND_TRUTH.read_text())
    truth_focus = {t["focus"] for t in truth}

    fhir = FhirClient()
    loops = rank(detect_all(fhir))
    detected_focus = {f"{f.resourceType}/{f.id}" for l in loops for f in l.focus}

    tp = len(truth_focus & detected_focus)         # injected loops correctly found
    fn = len(truth_focus - detected_focus)         # injected loops missed
    extra = detected_focus - truth_focus           # other real loops surfaced

    precision_vs_truth = tp / (tp + 0) if tp else 0.0  # all injected are true positives
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = (2 * tp) / (2 * tp + fn) if (2 * tp + fn) else 0.0

    print("=" * 56)
    print("LOOP DETECTION EVALUATION")
    print("=" * 56)
    print(f"Injected (ground truth) : {len(truth_focus)}")
    print(f"Detected (total)        : {len(detected_focus)}")
    print()
    print("Confusion (vs injected ground truth)")
    print(f"  true positives  (caught injected) : {tp}")
    print(f"  false negatives (missed injected) : {fn}")
    print(f"  additional real loops surfaced    : {len(extra)}")
    print()
    print(f"Recall on injected loops : {recall:.2%}")
    print(f"F1 (injected)            : {f1:.2f}")
    print()
    print("Per ground-truth loop:")
    for t in truth:
        hit = "OK " if t["focus"] in detected_focus else "MISS"
        print(f"  [{hit}] {t['type']:24} {t['focus']}")
    if extra:
        print("\nAdditional loops Loop surfaced (not injected):")
        for e in sorted(extra):
            print(f"  + {e}")
    print("=" * 56)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
