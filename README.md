# Smart Triage & CDS Portal

This project is a "Digital Medical Office Assistant" designed for the Primary Care AI Hackathon. It sits in the background of an Electronic Health Record (EHR) system. When a clinician opens a patient's chart, it intercepts a **CDS Hook**, scans simulated unstructured faxes and pending clinical loops, and extracts actionable insights using AI. 

The clinician is then presented with simple "Cards" in the EHR, which redirect to a "Safe Portal" (a zero-onboarding React app) to review and approve actions like specialist referrals or lab follow-ups.

## Features & Stretch Goals Completed
- **Fax Triage:** Simulates receiving an unstructured medical fax, using an LLM (Gemini/Mock) to extract the patient's name, diagnosis, and specialist needed.
- **Loop Engine Integration:** Flags critical unreviewed labs and unacknowledged referrals for the current patient using a configurable, rule-based loop engine.
- **Privacy by Design:** Uses purely synthetic data (Synthea) and de-identified text (MTSamples), while demonstrating a local-first UI with data minimization.
- **Write-back Simulation:** A simulated endpoint demonstrating how the approved structured data would be sent back to the EHR (e.g., via FHIR APIs).

## Architecture

The project consists of two main components:
1. **Backend (Python / FastAPI)**
   - Exposes CDS Hook discovery (`GET /cds-services`) and service endpoints (`POST /cds-services/triage-assistant`).
   - Uses `loop_engine.py` to scan synthetic patient data for open clinical loops.
   - Uses `ai_triage.py` to extract structured data from unstructured clinical text.
2. **Frontend (React / Vite + Tailwind CSS)**
   - A clean, zero-onboarding UI that allows clinicians to review AI-extracted information alongside the original document.
   - Two main views: `/portal/review/:patientId/:taskId` (Fax Triage) and `/portal/loop/:loopId` (Loop Management).

---

## How to Run the Project

### 1. Start the Backend (FastAPI)

1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Install the requirements:
   ```bash
   pip install -r requirements.txt
   ```
3. *(Optional)* Provide an LLM API key for live AI extraction:
   - Create a `.env` file in the `backend` directory.
   - Add your Gemini API key: `GEMINI_API_KEY=your_key_here`. 
   - *Note: If no key is provided, the backend falls back to realistic mocked extraction data.*
4. Start the Uvicorn server:
   ```bash
   python -m uvicorn main:app --host 127.0.0.1 --port 8000
   ```
   The backend will be available at `http://127.0.0.1:8000`.

### 2. Start the Frontend (React)

1. Open a new terminal and navigate to the `my-react-app` directory:
   ```bash
   cd my-react-app
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   The frontend will be available at `http://localhost:5173`.

---

## Testing the Flow

1. **Triggering the CDS Hook:**
   Send a POST request to `http://127.0.0.1:8000/cds-services/triage-assistant` simulating an EHR "patient-view" event. 
   Payload example:
   ```json
   {
     "hook": "patient-view",
     "hookInstance": "d1577c69-dfbe-44ad-ba6d-3e05e953b2ea",
     "context": {
       "userId": "Practitioner/123",
       "patientId": "P001"
     }
   }
   ```
2. **Viewing the Cards:**
   The backend will respond with a JSON array of "cards." These represent the notifications the doctor sees in their EHR.
3. **Using the Safe Portal:**
   Click the URL provided in the card's `links` array. This opens the React app where the clinician can compare the original document to the AI-extracted data and click **Approve & Save**.

## Hackathon Judging Criteria Met

- **Workflow Fit:** Zero-onboarding UI mimicking an integrated EHR experience. No new standalone apps.
- **Clinical Importance:** Automates inbox/fax triage and proactively identifies unreviewed critical labs (Loops).
- **Safety & Privacy:** Clearly demarcates original documents from AI outputs, enabling clinicians to audit the AI's reasoning. Demonstrates "Privacy by Design."
