import React from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen, ArrowLeft, Zap, Server, Globe, Code2,
  CheckCircle, ExternalLink, Terminal, Copy, Shield,
  Activity, HelpCircle, Package, Play, AlertTriangle,
  Stethoscope, Database, Cpu, ArrowRight, Users, FileText
} from 'lucide-react';

// ── Reusable components ───────────────────────────────────────────────────────

function CodeBlock({ children }) {
  const [copied, setCopied] = React.useState(false);
  const copy = () => {
    navigator.clipboard.writeText(children.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="relative group my-3">
      <pre className="bg-gray-900 text-green-400 rounded-lg p-4 text-sm overflow-x-auto font-mono leading-relaxed">
        <code>{children.trim()}</code>
      </pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-gray-700 hover:bg-gray-600 text-white text-xs px-2 py-1 rounded transition-all flex items-center gap-1"
      >
        <Copy className="w-3 h-3" />
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}

function SectionCard({ id, icon, title, subtitle, children }) {
  return (
    <section id={id} className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden scroll-mt-20">
      <div className="px-6 py-5 border-b bg-gray-50 flex items-start gap-3">
        <div className="mt-0.5 shrink-0">{icon}</div>
        <div>
          <h2 className="font-bold text-gray-900 text-lg">{title}</h2>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="px-6 py-6 text-gray-700 text-sm leading-relaxed space-y-4">{children}</div>
    </section>
  );
}

function Step({ n, title, children }) {
  return (
    <div className="flex gap-4">
      <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">
        {n}
      </div>
      <div className="flex-1">
        <div className="font-semibold text-gray-900 mb-1">{title}</div>
        <div className="text-sm text-gray-600 space-y-2">{children}</div>
      </div>
    </div>
  );
}

function Callout({ type = 'info', children }) {
  const styles = {
    info:    { bg: 'bg-blue-50',   border: 'border-blue-200',  icon: <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />,    text: 'text-blue-900' },
    warn:    { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />, text: 'text-yellow-900' },
    success: { bg: 'bg-green-50',  border: 'border-green-200',  icon: <CheckCircle className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />,    text: 'text-green-900' },
  };
  const s = styles[type];
  return (
    <div className={`flex gap-3 p-4 rounded-xl border ${s.bg} ${s.border}`}>
      {s.icon}
      <div className={`text-sm ${s.text}`}>{children}</div>
    </div>
  );
}

function Glossary({ term, children }) {
  return (
    <div className="border-b last:border-0 py-3">
      <span className="font-semibold text-gray-900">{term} — </span>
      <span className="text-gray-600">{children}</span>
    </div>
  );
}

// ── Table of contents links ───────────────────────────────────────────────────
const TOC = [
  { id: 'what-is-this', label: 'What is Loop?', icon: <Stethoscope className="w-4 h-4" /> },
  { id: 'glossary',     label: 'Plain-English Glossary', icon: <BookOpen className="w-4 h-4" /> },
  { id: 'architecture', label: 'How It Works (Architecture)', icon: <Cpu className="w-4 h-4" /> },
  { id: 'setup',        label: 'Setup Guide', icon: <Package className="w-4 h-4" /> },
  { id: 'running',      label: 'Running Locally', icon: <Play className="w-4 h-4" /> },
  { id: 'sandbox',      label: 'Connecting to CDS Sandbox', icon: <Globe className="w-4 h-4" /> },
  { id: 'api',          label: 'API Reference', icon: <Code2 className="w-4 h-4" /> },
  { id: 'data',         label: 'Data & Synthetic Patients', icon: <Database className="w-4 h-4" /> },
  { id: 'privacy',      label: 'Privacy by Design', icon: <Shield className="w-4 h-4" /> },
  { id: 'playbooks',    label: 'Playbooks Explained', icon: <Zap className="w-4 h-4" /> },
];

// ── Main component ────────────────────────────────────────────────────────────
export default function IntegrationGuide() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">

      {/* Sticky header */}
      <header className="bg-white border-b shadow-sm px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-gray-400 hover:text-gray-700 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Activity className="text-blue-600 w-5 h-5" />
          <span className="font-bold text-gray-800">Loop — Integration & Setup Guide</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-green-50 border border-green-200 text-green-700 text-xs rounded-full">
          <Shield className="w-3 h-3" />
          Hackathon Prototype · Synthetic Data Only
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 flex gap-8">

        {/* Sidebar TOC (desktop) */}
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-20 bg-white border rounded-xl p-4 shadow-sm">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">On this page</p>
            <nav className="flex flex-col gap-1">
              {TOC.map(item => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="flex items-center gap-2 text-xs text-gray-600 hover:text-blue-700 hover:bg-blue-50 rounded-md px-2 py-1.5 transition-colors"
                >
                  {item.icon}
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col gap-6 min-w-0">

          {/* Hero */}
          <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-2xl p-8">
            <h1 className="text-2xl font-extrabold mb-2 flex items-center gap-3">
              <BookOpen className="w-7 h-7" />
              Integration & Setup Guide
            </h1>
            <p className="text-blue-100 text-sm leading-relaxed max-w-xl">
              Everything you need to understand, run, and connect Loop — from first principles to live demo.
              No prior healthcare IT experience required.
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              {TOC.map(item => (
                <a key={item.id} href={`#${item.id}`}
                  className="text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded-full transition-colors flex items-center gap-1">
                  {item.icon} {item.label}
                </a>
              ))}
            </div>
          </div>

          {/* ── 1. WHAT IS LOOP ─────────────────────────────────────────────── */}
          <SectionCard id="what-is-this"
            icon={<Stethoscope className="w-5 h-5 text-blue-600" />}
            title="What is Loop? (start here)"
            subtitle="A plain-English explanation — no medical or technical knowledge required.">

            <p>
              Imagine a busy family doctor who sees 40–50 patients every day. They order a blood test, refer a patient to a specialist, and submit a bill — then immediately move on to the next patient.
              Days later, nobody checked whether those things were <em>followed up</em>. The test result came back abnormal and sat unread for three weeks. The referral never got a reply. The bill was rejected.
            </p>
            <p>
              <strong>These are "open loops" — tasks that were started but never finished.</strong> In a busy clinic, they fall through the cracks constantly, and some of them are dangerous.
            </p>

            <Callout type="warn">
              <strong>Real example in this demo:</strong> Patient James Wallace had a critically high potassium result (6.2 mEq/L — dangerous with his medications) sitting unreviewed for 21 days. Loop caught it.
            </Callout>

            <p>
              <strong>Loop is an AI assistant that watches for these dropped tasks.</strong> It runs silently in the background. When a doctor opens a patient's chart, Loop surfaces any outstanding issues as simple action cards — directly inside the doctor's existing software. The doctor reviews the AI's suggested action and clicks Approve. Nothing happens without a human saying yes.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { icon: '🔬', title: 'Unreviewed Lab Results', desc: 'Critical or abnormal values that came back but nobody saw' },
                { icon: '📋', title: 'Pending Tests with No Result', desc: 'Tests ordered but no result returned after threshold days' },
                { icon: '📬', title: 'Referrals with No Reply', desc: 'Specialists who never acknowledged receiving the referral' },
                { icon: '💰', title: 'Rejected Billing Claims', desc: 'Insurance claims that failed and are silently losing the clinic money' },
              ].map(item => (
                <div key={item.title} className="border rounded-xl p-4 bg-gray-50">
                  <div className="text-2xl mb-1">{item.icon}</div>
                  <div className="font-semibold text-gray-800 text-sm">{item.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{item.desc}</div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* ── 2. GLOSSARY ──────────────────────────────────────────────────── */}
          <SectionCard id="glossary"
            icon={<BookOpen className="w-5 h-5 text-purple-600" />}
            title="Plain-English Glossary"
            subtitle="The technical terms you'll see in this project — explained simply.">
            <Glossary term="EHR / EMR">Electronic Health Record / Electronic Medical Record. The software doctors use to manage patient records. Think of it like a very complex Google Docs for medical notes, test results, prescriptions, and billing. Examples: OSCAR, Epic, TELUS PS Suite.</Glossary>
            <Glossary term="CDS Hooks">Clinical Decision Support Hooks. An open standard that lets external apps like Loop "hook into" an EHR at specific moments (e.g. when a chart is opened) and inject suggestions — without replacing the EHR. It's how Loop shows up inside the doctor's existing software without being a separate app.</Glossary>
            <Glossary term="SMART on FHIR">A security standard for healthcare apps. It defines how a third-party app (like Loop) can securely log in and access patient data from an EHR, using the same OAuth2 protocol websites use for "Sign in with Google." In this hackathon prototype we simulate this flow.</Glossary>
            <Glossary term="FHIR (R4)">Fast Healthcare Interoperability Resources. The universal format for sharing health data between systems — like a shared language hospitals agree on. Think of it like JSON for healthcare. Patient, Observation, MedicationRequest, and ServiceRequest are FHIR "resource types."</Glossary>
            <Glossary term="CDS Card">The small notification card returned by Loop's backend when a CDS Hook fires. It contains a summary, urgency indicator, and a link. The EHR renders these as banners the doctor sees inline in their workflow.</Glossary>
            <Glossary term="Loop Engine">The Python code in loop_engine.py that scans patient data for open loops and ranks them by clinical risk. It uses simple, rules-based logic — not AI — so it's explainable and safe.</Glossary>
            <Glossary term="Playbook">A recipe for handling one type of open loop. It defines the sequence of steps (detect → analyze → draft → GATE → act → track). The GATE step always pauses for doctor approval before any action is taken.</Glossary>
            <Glossary term="Synthea">An open-source tool from MITRE that generates realistic but entirely fictional patient records. We use it so we never touch real patient data. The CSV files in synthea_sample_data_csv_latest/ contain 111 fake patients generated by Synthea.</Glossary>
            <Glossary term="FastAPI">A modern Python web framework we use to build the Loop backend API. It automatically generates interactive documentation at /docs.</Glossary>
            <Glossary term="Uvicorn">The server that runs FastAPI. Like how Apache runs a website, Uvicorn runs our Python API.</Glossary>
            <Glossary term="HAPI FHIR">A free, open-source FHIR server for testing. Available at hapi.fhir.org. You can query it like a real hospital database. We don't use it in this prototype but it's listed in the resources.</Glossary>
            <Glossary term="OHIP Codes">Ontario Health Insurance Plan billing codes (like A007, G539). These are the specific codes doctors submit to the government to get paid for their services.</Glossary>
          </SectionCard>

          {/* ── 3. ARCHITECTURE ──────────────────────────────────────────────── */}
          <SectionCard id="architecture"
            icon={<Cpu className="w-5 h-5 text-blue-600" />}
            title="How It Works — Architecture"
            subtitle="The full flow, step by step, from doctor opening a chart to taking action.">

            <div className="grid grid-cols-1 gap-2">
              {[
                { n: '1', icon: '🏥', title: 'Doctor opens a patient chart in the EHR', desc: 'This triggers a "patient-view" CDS Hook — a standardized notification the EHR sends to any registered external services.' },
                { n: '2', icon: '📡', title: 'CDS Hook fires at our FastAPI backend', desc: 'The EHR sends a POST request to /cds-services/triage-assistant with the patient ID and context. Our backend wakes up.' },
                { n: '3', icon: '⚙️', title: 'Loop Engine scans for open loops', desc: 'loop_engine.py reads through the patient\'s observations, test orders, referrals, and billing claims — looking for anything that was started but never resolved.' },
                { n: '4', icon: '🤖', title: 'AI Extractor processes any pending faxes', desc: 'ai_triage.py sends any unstructured fax text (simulated MTSamples note) to the Gemini AI to extract structured data: patient name, diagnosis, specialist needed.' },
                { n: '5', icon: '🃏', title: 'Backend returns CDS Cards', desc: 'The backend formats its findings as CDS Cards — a standardized JSON array containing a summary, urgency level, and a link to our React portal.' },
                { n: '6', icon: '👨‍⚕️', title: 'Doctor sees the cards in the EHR', desc: 'The EHR renders the cards as inline banners. The doctor sees "1 New Specialist Referral Pending" without leaving the patient chart.' },
                { n: '7', icon: '🔗', title: 'Doctor clicks → Safe Portal opens', desc: 'Clicking the card\'s App Link opens our React frontend. The doctor sees the original document side-by-side with the AI-extracted data.' },
                { n: '8', icon: '✅', title: 'Doctor approves → action is written back', desc: 'After reviewing, the doctor clicks Approve. The frontend calls POST /api/action, which simulates writing the structured data back to the EHR via FHIR.' },
              ].map(item => (
                <div key={item.n} className="flex gap-4 p-3 rounded-xl bg-gray-50 border">
                  <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{item.n}</div>
                  <div>
                    <div className="font-semibold text-gray-800 text-sm">{item.icon} {item.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <Callout type="success">
              <strong>The key insight:</strong> Loop never replaces the EHR. It injects itself into the existing workflow via CDS Hooks. The doctor doesn't need a new login or new software — the cards appear right where they already are.
            </Callout>
          </SectionCard>

          {/* ── 4. SETUP GUIDE ───────────────────────────────────────────────── */}
          <SectionCard id="setup"
            icon={<Package className="w-5 h-5 text-orange-600" />}
            title="Setup Guide — First Time"
            subtitle="Everything you need installed before you can run this project.">

            <Callout type="info">
              You need: <strong>Python 3.10+</strong> and <strong>Node.js 18+</strong>. Check by running <code>python --version</code> and <code>node --version</code> in your terminal.
            </Callout>

            <div className="flex flex-col gap-5">
              <Step n="1" title="Clone or open the project">
                <p>Open your terminal and navigate to the project folder:</p>
                <CodeBlock>{`cd path/to/hackers-and-healers`}</CodeBlock>
              </Step>
              <Step n="2" title="Install backend Python dependencies">
                <p>Navigate into the backend folder and install packages:</p>
                <CodeBlock>{`cd backend
pip install -r requirements.txt`}</CodeBlock>
                <p>This installs FastAPI, Uvicorn, Google Generative AI, and other packages listed in requirements.txt.</p>
              </Step>
              <Step n="3" title="(Optional) Add a Gemini API Key">
                <p>For live AI extraction from clinical notes, create a <code>.env</code> file in the backend/ folder:</p>
                <CodeBlock>{`# backend/.env
GEMINI_API_KEY=your_key_here`}</CodeBlock>
                <p>Without this, the app uses realistic mock extraction data — this is perfectly fine for the demo.</p>
              </Step>
              <Step n="4" title="Install frontend Node dependencies">
                <CodeBlock>{`cd ../my-react-app
npm install`}</CodeBlock>
              </Step>
              <Step n="5" title="Verify Synthea CSV data is present">
                <p>The folder <code>synthea_sample_data_csv_latest/</code> should be in the project root and contain files like <code>patients.csv</code>, <code>observations.csv</code>, etc. These are loaded automatically — no extra steps required.</p>
              </Step>
            </div>
          </SectionCard>

          {/* ── 5. RUNNING LOCALLY ───────────────────────────────────────────── */}
          <SectionCard id="running"
            icon={<Play className="w-5 h-5 text-green-600" />}
            title="Running Locally"
            subtitle="Start both servers and test the full flow.">

            <div className="flex flex-col gap-5">
              <Step n="1" title="Start the FastAPI backend (Terminal 1)">
                <CodeBlock>{`cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload`}</CodeBlock>
                <p>You should see: <code>INFO: Uvicorn running on http://0.0.0.0:8000</code></p>
                <p>The backend loads 111 Synthea patients from CSV and plants the 4 demo problems automatically.</p>
              </Step>
              <Step n="2" title="Start the React frontend (Terminal 2)">
                <CodeBlock>{`cd my-react-app
npm run dev`}</CodeBlock>
                <p>Visit <strong>http://localhost:5173</strong> — you'll see the Inbox Dashboard with real patient data.</p>
              </Step>
              <Step n="3" title="Test the CDS Hook manually (optional)">
                <p>Open the auto-generated Swagger UI to test any endpoint interactively:</p>
                <a href="https://lohp.ryanbeland.dev/api/patients" target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium text-sm">
                  <ExternalLink className="w-4 h-4" /> Open https://lohp.ryanbeland.dev/api/patients
                </a>
                <p className="mt-2">Or use curl to fire a mock hook via the tunnel:</p>
                <CodeBlock>{`curl -X POST https://lohp.ryanbeland.dev/cds-services/triage-assistant \\
  -H "Content-Type: application/json" \\
  -d '{"hook":"patient-view","hookInstance":"test","context":{"patientId":"PATIENT_UUID_HERE"}}'`}</CodeBlock>
                <p>Replace PATIENT_UUID_HERE with any patient ID from the dropdown in the dashboard.</p>
              </Step>
              <Step n="4" title="Using a tunnel (for demos over the internet)">
                <p>If you're demoing on a tunnel like Cloudflare or ngrok, update vite.config.js to allow your host:</p>
                <CodeBlock>{`// my-react-app/vite.config.js
server: {
  allowedHosts: ["your-tunnel-domain.example.com"]
}`}</CodeBlock>
                <p>The Vite dev server proxies <code>/api</code> and <code>/cds-services</code> to the local FastAPI backend — so <strong>no second tunnel is needed</strong>. The same <code>lohp.ryanbeland.dev</code> tunnel covers both the frontend and all API endpoints automatically.</p>
              <Callout type="success">
                <strong>This is already configured.</strong> <code>vite.config.js</code> has proxy rules for <code>/api</code> and <code>/cds-services</code>. All fetch calls in the frontend use relative paths so they work through the tunnel automatically.
              </Callout>
              </Step>
            </div>
          </SectionCard>

          {/* ── 6. CDS HOOKS SANDBOX ─────────────────────────────────────────── */}
          <SectionCard id="sandbox"
            icon={<Globe className="w-5 h-5 text-teal-600" />}
            title="Connecting to the CDS Hooks Sandbox"
            subtitle="Simulate a real EHR firing hooks at your backend — no EHR access required.">

            <p>
              The public sandbox at <a href="https://sandbox.cds-hooks.org" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-medium">sandbox.cds-hooks.org</a> is a web-based EHR simulator. It fires CDS Hooks at any URL you point it to. This is how you demo the full loop without needing access to a real EHR.
            </p>

            <Callout type="success">
              <strong>Already solved with Vite proxy!</strong> The frontend tunnel (<code>lohp.ryanbeland.dev</code>) automatically forwards <code>/api/*</code> and <code>/cds-services/*</code> to <code>localhost:8000</code>. You can point the CDS sandbox directly at:
              <br />
              <code>https://lohp.ryanbeland.dev/cds-services</code>
            </Callout>

            <div className="flex flex-col gap-5">
              <Step n="1" title="Expose your backend with a tunnel">
                <p>No tunnel needed for the backend! The Vite proxy already forwards CDS Hook requests through <code>lohp.ryanbeland.dev</code>.</p>
                <Callout type="success">
                  Point the CDS sandbox at: <code>https://lohp.ryanbeland.dev/cds-services</code>
                </Callout>
              </Step>
              <Step n="2" title="Configure CORS (already done)">
                <p>The backend already allows all CORS origins. No changes needed.</p>
                <Callout type="success">CORS is already set to <code>allow_origins=["*"]</code> in main.py. The backend will accept requests from the sandbox and your tunnel automatically.</Callout>
              </Step>
              <Step n="3" title="Open the CDS Hooks Sandbox & Set Endpoints">
                <a href="https://sandbox.cds-hooks.org" target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 font-medium hover:underline">
                  <ExternalLink className="w-4 h-4" /> Open sandbox.cds-hooks.org
                </a>
                <p className="mt-2">In the top-right gear icon → Settings, set:</p>
                <CodeBlock>{`CDS Service Endpoint:
https://lohp.ryanbeland.dev/cds-services

Change FHIR Server:
https://lohp.ryanbeland.dev/fhir`}</CodeBlock>
                <p>The sandbox will call <code>GET /cds-services</code> to discover Loop's service and will query <code>/fhir</code> for patient prefetch data.</p>
              </Step>
              <Step n="4" title="Select the Loop service">
                <p>After discovery, you'll see "Smart Triage Assistant" in the service list. Select it. The sandbox will use it for all subsequent hook triggers.</p>
              </Step>
              <Step n="5" title="Trigger a patient-view hook">
                <p>Click any patient in the sandbox's left panel. The sandbox fires a <code>patient-view</code> hook to your backend and displays the returned CDS Cards inline — exactly like a real EHR would.</p>
              </Step>
              <Step n="6" title="Update the App Link URL">
                <p>The CDS Card's link currently points to <code>localhost:5173</code>. For a live demo, update this in <code>backend/main.py</code>:</p>
                <CodeBlock>{`# In main.py, find the links section and update:
"url": f"https://YOUR-FRONTEND-TUNNEL/portal/review/{patient_id}/{task_id}"`}</CodeBlock>
              </Step>
            </div>
          </SectionCard>

          {/* ── 7. API REFERENCE ─────────────────────────────────────────────── */}
          <SectionCard id="api"
            icon={<Code2 className="w-5 h-5 text-purple-600" />}
            title="API Reference"
            subtitle="All backend endpoints — what they do and how to call them.">
            <div className="flex flex-col gap-3">
              {[
                { method: 'GET',  path: '/cds-services', color: 'bg-green-100 text-green-800',
                  desc: 'Discovery endpoint required by the CDS Hooks standard. Returns the list of services Loop exposes. The EHR (or sandbox) calls this first to learn what Loop can do.' },
                { method: 'POST', path: '/cds-services/triage-assistant', color: 'bg-blue-100 text-blue-800',
                  desc: 'Main hook endpoint. Receives a patient-view context (patientId), runs the loop engine + AI extractor, and returns an array of CDS Cards ranked by severity.' },
                { method: 'GET',  path: '/api/patients', color: 'bg-green-100 text-green-800',
                  desc: 'Returns all 111 Synthea patients loaded from CSV. The frontend uses this to populate the patient selector dropdown.' },
                { method: 'POST', path: '/api/action', color: 'bg-blue-100 text-blue-800',
                  desc: 'Write-back endpoint. Simulates approving a task and saving it to the EHR. In production this would call FHIR POST/PUT APIs. Body: { action, taskId, patientId }.' },
                { method: 'GET',  path: '/api/metrics', color: 'bg-green-100 text-green-800',
                  desc: 'Returns accuracy metrics for the judge demo: how many problems were planted vs. detected, open/closed counts, and total revenue at risk.' },
                { method: 'GET',  path: '/fhir', color: 'bg-purple-100 text-purple-800',
                  desc: 'In-memory FHIR server loaded with the Synthea R4 dataset. Serves /fhir/metadata, /fhir/Patient, etc., for the CDS sandbox.' },
                { method: 'GET',  path: '/docs', color: 'bg-gray-100 text-gray-700',
                  desc: 'Swagger UI — auto-generated interactive API documentation. Try any endpoint directly in the browser.' },
              ].map(ep => (
                <div key={ep.path} className="flex items-start gap-3 p-3 border rounded-xl bg-gray-50">
                  <span className={`text-xs font-bold px-2 py-1 rounded-md shrink-0 mt-0.5 ${ep.color}`}>{ep.method}</span>
                  <div>
                    <code className="text-sm font-bold text-gray-900">{ep.path}</code>
                    <p className="text-sm text-gray-500 mt-0.5">{ep.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <Callout type="info">
              <strong>Live API endpoints (via Vite proxy + tunnel):</strong><br />
              <a href="https://lohp.ryanbeland.dev/cds-services" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">https://lohp.ryanbeland.dev/cds-services</a> — Discovery<br />
              <a href="https://lohp.ryanbeland.dev/api/patients" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">https://lohp.ryanbeland.dev/api/patients</a> — Patient list<br />
              <a href="https://lohp.ryanbeland.dev/api/metrics" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">https://lohp.ryanbeland.dev/api/metrics</a> — Accuracy metrics
            </Callout>
          </SectionCard>

          {/* ── 8. DATA ──────────────────────────────────────────────────────── */}
          <SectionCard id="data"
            icon={<Database className="w-5 h-5 text-indigo-600" />}
            title="Data & Synthetic Patients"
            subtitle="Where the data comes from and how the planted problems work.">
            <p>
              <strong>All data is 100% synthetic.</strong> The 111 patients are generated by <a href="https://synthea.mitre.org" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Synthea</a> — a free open-source tool that creates realistic but entirely fictional medical records based on real-world population statistics from the CDC and NIH.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: '111', sub: 'Synthea patients' },
                { label: '9,390', sub: 'tracked lab observations' },
                { label: '18', sub: 'CSV data files' },
                { label: '4', sub: 'planted demo problems' },
              ].map(s => (
                <div key={s.label} className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-center">
                  <div className="text-2xl font-extrabold text-indigo-700">{s.label}</div>
                  <div className="text-xs text-indigo-600 mt-0.5">{s.sub}</div>
                </div>
              ))}
            </div>
            <p>
              <strong>How the planted problems work:</strong> synthea_loader.py reads the real CSVs, then injects 4 known clinical errors on top of the first 4 real patients. The loop engine must detect all 4 — this is how we prove accuracy to judges.
            </p>
            <div className="flex flex-col gap-2">
              {[
                { n: 1, color: 'bg-red-600',    label: 'Critical Potassium 6.2 mEq/L',         detail: 'Patient on Spironolactone + Ramipril — dangerous combination. Unreviewed 21 days.' },
                { n: 2, color: 'bg-orange-500', label: 'CBC ordered — no result returned',      detail: 'Investigating fatigue. Lab result never came back after 14 days.' },
                { n: 3, color: 'bg-yellow-500', label: 'Cardiology referral — no reply in 35 days', detail: 'Worsening dyspnoea, CRT candidacy. Specialist never acknowledged.' },
                { n: 4, color: 'bg-blue-500',   label: 'OHIP claim rejected — $845 at risk',    detail: 'G539 not eligible with A007 same date. 22 days unreconciled.' },
              ].map(p => (
                <div key={p.n} className="flex items-start gap-3 p-3 border rounded-xl bg-gray-50">
                  <div className={`w-6 h-6 rounded-full ${p.color} text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5`}>{p.n}</div>
                  <div>
                    <div className="font-semibold text-sm text-gray-800">{p.label}</div>
                    <div className="text-xs text-gray-500">{p.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* ── 9. PRIVACY ───────────────────────────────────────────────────── */}
          <SectionCard id="privacy"
            icon={<Shield className="w-5 h-5 text-green-600" />}
            title="Privacy by Design"
            subtitle="How this prototype handles data — and how a real version would work.">
            <p>
              Canadian healthcare is governed by <strong>PHIPA</strong> (Personal Health Information Protection Act) in Ontario. Even for a prototype, we build with privacy in mind.
            </p>
            <div className="flex flex-col gap-2">
              {[
                { ok: true,  text: 'All patient data is 100% synthetic — Synthea-generated. Zero real patient data.' },
                { ok: true,  text: 'The AI extractor only receives the minimum text needed — it does not see the full chart.' },
                { ok: true,  text: 'No data is stored between sessions. The backend processes and returns, then forgets.' },
                { ok: true,  text: 'No data is sent to third parties except optionally to Gemini API (configurable, can be disabled).' },
                { ok: true,  text: 'In production: SMART on FHIR OAuth2 would replace the mocked token. The doctor authenticates through their EHR.' },
                { ok: true,  text: 'In production: Local processing would use on-premise LLMs (e.g. Ollama) instead of cloud APIs.' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                  {item.text}
                </div>
              ))}
            </div>
          </SectionCard>

          {/* ── 10. PLAYBOOKS ────────────────────────────────────────────────── */}
          <SectionCard id="playbooks"
            icon={<Zap className="w-5 h-5 text-yellow-600" />}
            title="Playbooks — How Loop's Logic Works"
            subtitle="Each type of open loop has a structured, auditable response plan.">
            <p>
              A <strong>playbook</strong> is a sequence of steps the AI runs when it detects an open loop. Every step is logged and visible to the doctor. Every patient-facing action <strong>must pause at a Gate</strong> — the doctor must click Approve before anything is sent or submitted. The AI cannot act autonomously.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { name: 'Abnormal Lab Result', steps: ['Detect unreviewed result', 'Analyze clinical context', 'Draft recall + repeat lab', '⛔ Doctor approval gate', 'Send recall & book lab', 'Track until closed'] },
                { name: 'Pending Test — No Result', steps: ['Detect overdue test order', 'Check clinical urgency', 'Draft lab follow-up message', '⛔ Doctor approval gate', 'Contact lab for status', 'Track until result received'] },
                { name: 'Referral — No Reply', steps: ['Detect unanswered referral', 'Assess urgency & timeline', 'Draft escalation message', '⛔ Doctor approval gate', 'Send escalation to specialist', 'Track acknowledgement'] },
                { name: 'Billing Reconciliation', steps: ['Scan rejected OHIP claims', 'Identify coding error/conflict', 'Draft corrected claim', '⛔ Doctor approval gate', 'Resubmit to OHIP', 'Confirm payment received'] },
              ].map(pb => (
                <div key={pb.name} className="border rounded-xl overflow-hidden">
                  <div className="bg-gray-100 px-4 py-2 font-semibold text-sm text-gray-800 border-b">{pb.name}</div>
                  <div className="px-4 py-3 flex flex-col gap-1.5">
                    {pb.steps.map((step, i) => (
                      <div key={i} className={`flex items-center gap-2 text-xs ${step.startsWith('⛔') ? 'text-red-700 font-bold' : 'text-gray-600'}`}>
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${step.startsWith('⛔') ? 'bg-red-500' : 'bg-gray-400'}`}>{i + 1}</div>
                        {step}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <Callout type="warn">
              <strong>Safety guarantee:</strong> The ⛔ Doctor Approval Gate is non-negotiable. No message is sent to a patient, no lab is ordered, and no bill is submitted without explicit physician approval. This is a hard architectural rule.
            </Callout>
          </SectionCard>

          <div className="flex justify-center pb-8">
            <Link to="/" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-semibold text-sm bg-blue-50 border border-blue-200 px-4 py-2 rounded-xl hover:bg-blue-100 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Link>
          </div>

        </main>
      </div>
    </div>
  );
}
