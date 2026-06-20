# Loop — Team Guide

A simple guide to what we're building and why. Read this first. No prior knowledge needed.

---

## 1. What is Loop? (in one breath)

Doctors are drowning in follow-up work. A blood test gets ordered but the result never gets checked. A referral gets sent but nobody hears back. A bill gets submitted but never gets reconciled (so the clinic loses money). These things "fall through the cracks."

**Loop is an AI assistant that watches for these dropped tasks, ranks them by how urgent they are, and does the boring follow-up work — drafting the reminder, the order, the bill fix — so the doctor just clicks "approve."**

Think of it as a safety net under a busy clinic.

---

## 2. The problem (why anyone cares)

- Family doctors lose ~19 hours a week to paperwork.
- Over half are burned out.
- The scary part isn't the hard diagnosis — it's the abnormal result that came back while they were away and nobody noticed.
- The clinic also loses real money: if a billing file isn't "reconciled," they lose about 10% of it.

The doctors at this event literally told us: *"The gap between information and action is where care falls through the cracks."* That gap is what Loop fixes.

---

## 3. How Loop works (the whole idea in 5 steps)

1. **Detect** — Loop scans the patient records and finds "open loops" (tasks that started but never finished).
2. **Rank** — It sorts them by risk. A critical lab result nobody saw goes to the top. Routine stuff stays at the bottom.
3. **Draft** — For each one, the AI writes the next action: a text to the patient, a repeat lab order, a follow-up appointment, a billing fix.
4. **Approve** — The doctor reviews the draft and clicks approve (or edits it). **Nothing happens without a human saying yes.** This is the safety rule.
5. **Track** — Once approved, Loop sends it and keeps watching until the loop is truly closed.

The doctor sees a simple **ranked list** (like an inbox). When they click one, they see a small **flow diagram** showing what the AI did and is about to do.

---

## 4. The words we use (plain-English glossary)

- **Open loop** — any task that was started but not finished (test ordered, referral sent, bill submitted). Loop's whole job is to close these.
- **Playbook** — a reusable recipe for handling a type of loop. Example: "When a lab result comes back, if it's normal text the patient, if it's abnormal book them in." The clinic builds these once; Loop runs them automatically. (Think of it like the automation tool n8n, but for clinics.)
- **Run** — one playbook actually running for one patient. The flow diagram you see is a run in progress.
- **Gate** — a stop sign in a playbook. Any step that contacts a patient, orders something, or submits a bill must pause for the doctor to approve. We can never remove these stop signs — that's the safety guarantee.
- **FHIR** — the standard format for health data (patients, lab results, medications). Like a universal file format hospitals agree on. We read and write data in this format.
- **HAPI** — a free FHIR server we run on our laptop. It acts as our pretend hospital database for the demo.
- **Synthea** — a free tool that generates fake-but-realistic patients (with histories, labs, meds). We use it so we never touch real patient data.
- **OLIS** — Ontario's system where lab results live. In real life, that's where Loop would read results from.
- **eReferral / OHIP codes** — Ontario's referral system and billing codes (like `A007`). Real things we connect to in a real version.
- **CDS Hooks** — a standard way to pop our suggestions up *inside* the doctor's existing software, so it's not "yet another app."

---

## 5. What we're actually building this weekend

We are NOT building the whole thing. For the hackathon we build a working slice that demos well:

- Find 3 kinds of open loops: **abnormal result nobody checked**, **test ordered but no result**, **referral with no reply** — plus the star addition: **billing not reconciled** (loses money).
- Rank them by risk (simple rules, not AI — so it's safe and explainable).
- Use the AI (Claude) to draft the follow-up message/order.
- Show 1–2 ready-made playbooks running on a live flow diagram.
- A "before/after" wall: lots of red (problems) turning green (fixed) as Loop works.
- **Proof it works:** we plant known problems in the fake data, run Loop, and show accuracy numbers (how many it caught). Almost no team brings real numbers — this wins points.

---

## 6. The demo story (the part that makes judges go "wow")

1. Open the screen: a list full of **red** — things slipping through the cracks.
2. Top item: a patient whose critical potassium result came back 3 weeks ago and **nobody saw it.**
3. Click it → watch the AI's plan light up: it read the chart, saw the patient is on a med that explains it, and drafted a recall message + repeat lab + appointment.
4. Doctor clicks **approve** → it "sends." Red turns green. A possibly life-threatening miss closed in under a minute.
5. Beat two (money): a billing file wasn't reconciled. Loop finds the rejected claims, ranks them by dollars, drafts the fix. **"This is the 10% you were losing."**

Safety first, money second. One-two punch.

---

## 7. Who builds what (rough split)

- **Frontend person** — the ranked list (the daily screen) + the flow diagram (React + React Flow).
- **Backend / AI person** — finding the loops, ranking them, and the Claude prompts that draft actions, plus writing results back.
- **Data person** — generate fake patients (Synthea), plant the known problems, load into the HAPI server, build the accuracy test.
- Everyone — help shape the demo and the pitch.

(We'll firm this up once the team's together.)

---

## 8. The tech, simply

- **Backend:** Python (FastAPI) — does the detecting, ranking, and talking to the AI.
- **Frontend:** React + React Flow — the screen the doctor sees.
- **AI:** Claude — writes the draft messages and explanations.
- **Data:** HAPI FHIR server + Synthea fake patients, all on one laptop with Docker.

Nothing here needs the internet to a real hospital. It all runs locally with fake data. Safe.

---

## 9. The 20-second pitch (memorize this)

> "Doctors lose hours every week chasing loose ends — and patients fall through the cracks when a result or referral gets dropped. Loop is an AI safety net: it spots the dropped tasks, ranks them by danger, and does the follow-up for the doctor to approve in one click. The clinic writes its own playbooks, so the AI only ever runs protocols the clinic trusts — and every patient-facing action needs a human yes. We even prove it works with real accuracy numbers."

---

## 10. Where the docs live

- `TEAM-GUIDE.md` — this file (start here).
- `loop-user-story.md` — a day in the life of a doctor using Loop.
- `loop-architecture.md` — the full technical design (read when you start building).
- `loop-playbook-example.json` — an example playbook in our format.
- `onboarding-notes.md` — what the clinicians told us on event day.
