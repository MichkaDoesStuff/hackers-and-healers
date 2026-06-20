# **Primary Care AI Hackathon: Unified Domain & Requirements Document**

## **1\. Domain Overview: Primary Care in Crisis**

**Primary care is the foundation of the Canadian healthcare system, but it is currently buckling under administrative weight. Family physicians lose roughly 19 hours per week to clerical work, leading to severe burnout and reduced patient access.**

**The Core Problem: The history of electronic medical records (EMRs) is filled with tools built without clinician input, which ultimately increased cognitive burden rather than reducing it.**

**The Goal: Build targeted AI solutions that make primary care manageable by automating repetitive tasks, surfacing critical information proactively, and protecting continuity of care—without adding "just one more click."**

### **Key Talking Points & Landscape**

* **Educational Gap: Medical training is strictly focused on patient care, leaving new doctors entirely unprepared for the administrative realities of running a practice.**  
* **Scalability of Solutions: Primary care clinics generally share a very similar scope of practice, meaning a successful tool can be scaled to benefit the majority of primary care users.**  
* **AI Readiness: The primary care sector is currently adopting AI technologies more aggressively than other domains in the healthcare system.**  
* **Adoption Threshold: To convince doctors to abandon their current legacy systems, new technology cannot just be slightly better; it must be 10 to 100 times better.**  
* **Builder-Led Innovation: Central health authorities are not currently leading technological innovation; independent builders and tech developers are the ones actively driving the future of healthcare adoption in Canada.**

  ### **Clinician Pain Points**

* **Administrative Overload: Keeping track of new medical resources and managing daily clinic operations cuts directly into doctors' personal time.**  
* **Billing Chaos: Medical billing is governed by a complex, constantly changing 900-page guide. Doctors can lose up to 10% of their gross yearly billings (or tens of thousands of dollars) simply due to incorrect coding or unreconciled batch files.**  
* **Fragmented Data Environments: Doctors must navigate a mix of structured data (like specific lab results) and unstructured data (like free-text notes and scanned paper charts).**  
* **Referral Friction: Approximately half of required forms remain paper-based, and specialists often demand their own specific formatting, leading primary care doctors to waste time re-typing and recreating documents.**  
* **Onboarding Fatigue: Doctors seeing 40 to 50 patients a day have zero capacity to take on new cognitive burdens; they frequently reject new software if it requires learning new workflows or adds even "just one more click."**

  ## **2\. Clinician Desires & Design Requirements (Workflow Fit)**

**Clinicians are not looking for AI to replace their medical judgment. They want a "digital medical office assistant." Any tool built during this hackathon must adhere to the following core design philosophy to ensure effective integration into daily practice:**

* **Integration over Fragmentation: Tools must integrate seamlessly into existing EMR workflows rather than being standalone apps with separate logins. No new standalone apps; no new logins.**  
* **Low Cognitive Burden: AI outputs and prompts should be concise and timely. Relevance filtering is more important than comprehensiveness. Tools must include a "don't interrupt me now" control mechanism so clinicians control when the AI communicates.**  
* **Actionable Outputs: Do not just generate summary text. Convert clinical decisions directly into tasks (e.g., draft the referral, queue the follow-up, auto-populate the form).**  
* **Calibrated Trust & Transparency: AI must show its reasoning and prompts to promote transparency to the healthcare professional. It must be clear about its confidence levels and limitations, allowing clinicians to easily audit, edit, and override its suggestions.**  
* **Proactive, Not Reactive: Tools should anticipate needs before they arise by flagging what is due (e.g., overdue vaccinations) or tracking pending items, rather than waiting for a clinician to ask for a search query.**  
* **Practical Affordability: Concepts must be realistic regarding cost. Small primary care clinics operate on tight margins and cannot afford expensive infrastructure or high per-seat licensing fees.**  
* **Privacy by Design: Systems should be built with data minimization, local processing, and clear governance in mind for handling patient data.**

  ## **3\. High-Priority Challenge Areas**

**Teams should select one narrow problem from the following domains to tackle in the 6-hour window:**

1. **Administrative & Coordination Automation (Highest Priority):**  
   * ***Inbox/Fax Triage:*** **Ingests, deduplicates, and routes incoming lab reports and specialist notes.**  
   * ***Referral Intelligence:*** **Matches patient needs to specialist scope-of-practice and wait times.**  
   * ***Billing Support:*** **Automates diagnostic and service code matching (e.g., reconciling batch files to prevent the typical 10% loss in gross billings).**  
2. **Pre-Visit Preparation:**  
   * ***Chart Scanning:*** **Flags overdue screenings, incoming lab results, and generates dynamic pre-visit questionnaires based on the patient's active problems.**  
3. **Encounter Support & Scribing:**  
   * ***Ambient Scribe \+ Micro-prompts:*** **Generates structured documentation while offering brief, non-intrusive nudges for guidelines or drug interactions.**  
4. **Medication & Prescribing:**  
   * ***Pharmacy Agent:*** **Automates limited-use code checks, flags real-time drug shortages, and compares pharmacy costs.**  
5. **Follow-up Automation:**  
   * ***Task Generation:*** **Automatically extracts tasks from visit notes (e.g., "track CBC result") and sets up test completion tracking.**  
6. **Longitudinal Intelligence:**  
   * ***Patient Summaries:*** **Reconstructs a usable narrative arc from years of fragmented chart data, including social and community context.**

   ## **4\. Hackathon Requirements (6-Hour Build Constraint)**

**Given the extremely tight 6-hour development window, teams must aggressively limit scope. A functional prototype demonstrating core clinical logic will outscore a visually polished front-end with no backend substance.**

* **Requirement 1: Synthetic Data Strictly Enforced.**  
  * **No live EMR connections or real patient data are permitted. All prototypes must use synthetic, de-identified, or mocked datasets.**  
* **Requirement 2: Single-Workflow Focus.**  
  * **Teams must target *one* specific interaction (e.g., parsing a single fax type, standardizing one referral form, or catching one specific drug interaction). Do not attempt to build a generalized platform.**  
* **Requirement 3: Zero-Onboarding UI.**  
  * **The interface must mimic an integrated EHR experience. If it takes more than 30 seconds to explain how to use the tool, the cognitive burden is too high.**  
* **Requirement 4: Privacy by Design Architecture.**  
  * **Even while using synthetic data, the architecture pitch must demonstrate how real patient data (PHIPA/HIPAA) would be minimized and processed locally or securely in the future.**

  ## **5\. Technology Stack & Resources**

**Teams have access to the following open-access resources, datasets, and interoperability standards to build their prototypes:**

### **Standardized Frameworks (For conceptual integration)**

* **HL7 FHIR (R4): The dominant standard for health data exchange. Use FHIR resource structures (Patient, Condition, MedicationRequest, Observation) to map your data.**  
* **CDS Hooks: Standard for triggering clinical decision support prompts within an EHR workflow.**  
* **SMART on FHIR: Framework for launching third-party apps securely from within an EHR.**

  ### **Datasets (Use for feeding your AI)**

* **Synthea: Open-source simulator generating realistic, entirely fictional patient records (available in FHIR R4, CSV). Best for longitudinal histories.**  
* **MIMIC-IV (Demo subset): De-identified hospital data including lab values, clinical notes, and discharge workflows.**  
* **MTSamples: 5,000+ public domain medical transcription reports. Ideal for training NLP/LLMs to extract data from unstructured free-text.**  
* **Health Canada DPD & CCDD: Databases for drug identification, active ingredients, and structured medication terminology.**

  ### **Test Servers / Sandboxes**

* **HAPI FHIR (R4): Open-source server pre-loaded with test data for API querying/writing.**  
* **SMART on FHIR Sandbox: For testing EHR-integrated app launches.**

  ## **6\. Judging Criteria**

**Prototypes will be evaluated by the clinician panel based on the following:**

1. **Clinical Importance: Does this solve a high-frequency, painful administrative or clinical problem?**  
2. **Technical Feasibility: Can the core technology realistically be built, stabilized, and deployed within 6 to 12 months?**  
3. **Workflow Fit: Does the tool integrate seamlessly without adding cognitive burden or extra clicks?**  
4. **Safety & Privacy: Does the architecture respect data governance, and does the UI allow clinicians to audit the AI's reasoning?**

# **Project Definition: Smart Triage & CDS Portal**

## **1\. Project Overview & Architecture**

**The Concept:** A "Digital Medical Office Assistant" that sits quietly in the background of an Electronic Health Record (EHR) system. When a doctor opens a patient's chart, it automatically scans incoming unstructured faxes, matches them to the correct patient via CSV databases, extracts actionable insights using AI, and presents them as simple "Cards" in the EHR. Clicking a card securely redirects the doctor to a React-based "Safe Portal" to review and approve the extracted actions (e.g., a specialist referral).

**The Flow:**

1. **Trigger:** The EHR triggers a CDS Hook (e.g., patient-view) when the clinician opens a chart.  
2. **Backend Processing:** The Backend receives the hook, identifies the patient, and looks up their ID in a mock CSV database.  
3. **AI Extraction:** The Backend finds pending unstructured files (simulated faxes/paper notes) for that patient and runs an LLM prompt to summarize the fax and extract necessary referral/billing codes.  
4. **Card Delivery:** The Backend returns a **CDS App Link Card** to the EHR interface (e.g., *"1 New Specialist Referral Pending \- Click to Review"*).  
5. **Safe Portal Redirect:** The clinician clicks the card and is redirected to your hosted **React Frontend**, which displays a clean, zero-onboarding UI containing the auto-populated form ready for a single-click approval.

## **2\. Technical Requirements**

### **2.1 Backend Requirements (Python/FastAPI or Node.js)**

* **REST API:**  
  * GET /cds-services: The Discovery endpoint declaring your service to the EHR.  
  * POST /cds-services/triage-assistant: The actual service endpoint that receives the hook context.  
* **Data Handling:**  
  * **CSV Parser:** Logic to load and map patient IDs (e.g., using Synthea CSV data). From here: [https://synthea.mitre.org/downloads](https://synthea.mitre.org/downloads)   
  * **Unstructured File Loader:** Logic to ingest simulated scanned faxes and medical transcriptions (e.g., using MTSamples).  
  * Integration with this cds: [https://sandbox.cds-hooks.org/](https://sandbox.cds-hooks.org/)   
* **AI Integration:** Integration with an LLM (OpenAI, Gemini, or Claude API) to parse the unstructured text, extract the diagnosis, and map it to a structured JSON object.  
* **Card Generator:** Must format the response exactly to the CDS Hooks specification (returning an array of cards with summary, indicator, source, and links objects).

### **2.2 Frontend Requirements (React)**

* **Hosted Web App:** A deployed React application (Vercel, Netlify, or similar).  
* **Routing:** Dynamic routes (e.g., /portal/review/:patientId/:taskId) to handle incoming traffic from the CDS App Link Card.  
* **"Zero-Onboarding" UI:** \* A side-by-side view: Original scanned document/text on the left, auto-populated extracted form on the right.  
  * Clear "Approve" and "Edit" buttons.  
  * No complex navigation bars; the doctor does one task and returns to the EHR.

### **2.3 Integration & Security (Simulated)**

* **SMART App Launch (Mocked):** Because setting up a full OAuth2 SMART flow takes hours, for the 6-hour hackathon, simulate the secure handoff by passing a mocked auth token and patient ID in the App Link Card URL. (Be prepared to explain to judges how this would use standard SMART on FHIR OAuth in production).

## **3\. Scope & Prioritization (6-Hour Constraint)**

**Must-Haves (The MVP):**

* Hardcode the CDS Hook trigger using a testing sandbox (like the CDS Hooks Sandbox).  
* A Backend that successfully receives the JSON hook, reads a local CSV to "find" a mock fax, and returns a valid CDS Card.  
* A basic React page that takes URL parameters to display a mock "extracted" referral form.  
* Use strictly synthetic data (Synthea / MTSamples).

**Possible Requirements (Stretch Goals):**

* **Live AI Processing:** Actually passing the unstructured text to an LLM during the backend request instead of returning pre-processed mock data.  
* **Billing Code matching:** Having the AI automatically suggest the correct service code based on the parsed fax.  
* **Write-back:** Implementing a button in the React app that sends a FHIR POST request back to a sandbox EHR (like HAPI FHIR) to save the approved document.

## **4\. Plan of Action (6-Hour Hackathon Timeline)**

**Hour 1: Boilerplate & Architecture**

* **Frontend Dev:** Scaffold the React app (Vite \+ Tailwind), push to GitHub, and immediately deploy to Vercel/Netlify to ensure hosting works.  
* **Backend Dev:** Scaffold the API. Set up the /cds-services discovery endpoint. Use Ngrok if testing locally against an external sandbox.  
* **Data Dev:** Grab 2-3 synthetic patient CSV rows and 1 text sample from MTSamples.

**Hour 2: The Hook & The Card**

* **Backend Dev:** Build the POST endpoint to accept the patient-view hook.  
* Format a hardcoded JSON response that matches the CDS Card specification.  
* Test the endpoint using the public CDS Hooks Sandbox to ensure the card visually renders.

**Hour 3: AI & Data Ingestion**

* **Backend Dev:** Write the script that takes the MTSample text, feeds it to an LLM with a strict system prompt ("Extract patient name, diagnosis, and requested specialist into JSON").  
* Connect the CSV lookup: If hook comes in for Patient A, load Text A, run AI, return Card with link to React app ?patient=A\&data=...

**Hour 4: Frontend UI Construction**

* **Frontend Dev:** Build the Safe Portal view. It needs to look like an extension of an EMR (clean, white, high contrast, low clicks).  
* Implement URL parameter parsing so the React app knows what data to display when the clinician clicks the card.

**Hour 5: Wiring & Integration**

* Connect the entire flow. Trigger hook in sandbox \-\> Backend processes \-\> Card appears \-\> Click Card \-\> React portal opens with the correct AI-extracted data.  
* Debug CORS errors (inevitable when jumping between sandboxes and hosted apps).

**Hour 6: Polish, Privacy, & Pitch Prep**

* Clean up the UI. Add a "Data minimized & processed locally" badge to the UI to hit the Privacy judging criteria.  
* Finalize the pitch: Focus heavily on the *Workflow Fit* and how you respected the clinician's time by using CDS Hooks rather than building a standalone app.

**![][image1]**  
*Note: ClinicOS here would be whatever clinicians already use; we inject our product into their product.*
