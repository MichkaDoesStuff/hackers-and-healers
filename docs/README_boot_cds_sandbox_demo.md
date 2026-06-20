# Booting the CDS Hooks Sandbox Demo

This README assumes the project code and Python environment are already set up.  
Use this only to start the local backend, expose it with Cloudflare Tunnel, and connect it to the CDS Hooks Sandbox.

---

## 1. Open WSL / Ubuntu

Open VS Code or a terminal using **WSL Ubuntu**.

Go to the project folder:

```bash
cd /mnt/c/Users/<your-user>/hackathons/cds-ai-service
```

Example:

```bash
cd /mnt/c/Users/jesus/hackathons/cds-ai-service
```

---

## 2. Activate the Python virtual environment

From inside the project folder, run:

```bash
source .venv/bin/activate
```

You should see `(.venv)` at the start of your terminal prompt.

Example:

```text
(.venv) user@machine:/mnt/c/Users/user/hackathons/cds-ai-service$
```

If `.venv` does not exist, ask the project owner for setup help. This README assumes the environment has already been created.

---

## 3. Confirm required files exist

Make sure these files are present:

```text
main.py
ai_service.py
requirements.txt
.env
.venv/
```

The `.env` file should contain an OpenAI API key:

```env
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4.1-mini
```

Do not commit `.env` to GitHub.

---

## 4. Start the local FastAPI server

In the first terminal, run:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

Leave this terminal open.

Test locally in a browser:

```text
http://localhost:8000/
```

Test the CDS discovery endpoint:

```text
http://localhost:8000/cds-services
```

You should see JSON with a `services` array.

---

## 5. Start Cloudflare Tunnel

Open a **second WSL / Ubuntu terminal**.

Go to the project folder again:

```bash
cd /mnt/c/Users/<your-user>/hackathons/cds-ai-service
```

Start the tunnel:

```bash
cloudflared tunnel --url http://localhost:8000
```

Leave this terminal open.

Cloudflare will print a public URL that looks like:

```text
https://something.trycloudflare.com
```

Your CDS discovery URL is:

```text
https://something.trycloudflare.com/cds-services
```

Use the actual URL printed in your terminal.

---

## 6. Connect to the CDS Hooks Sandbox

Open:

```text
https://sandbox.cds-hooks.org/
```

Then:

1. Select **Patient View**
2. Open the **CDS Developer Panel**
3. Add a CDS Service
4. Paste your Cloudflare discovery URL:

```text
https://something.trycloudflare.com/cds-services
```

5. Click **Save**

If successful, the sandbox should accept the service without CORS or discovery errors.

---

## 7. Trigger the CDS service

After adding the service:

1. Select the service from the dropdown
2. Refresh or trigger the Patient View workflow
3. Watch the FastAPI terminal

You should see something like:

```text
GET /cds-services
POST /cds-services/ai-followup-assistant
```

If the `POST` appears, the sandbox is calling the local backend successfully.

The CDS card should appear in the sandbox UI.

---

## 8. Required terminals during demo

Keep both terminals running:

```text
Terminal 1: FastAPI server
Terminal 2: Cloudflare Tunnel
```

Do not close either one during the demo.

---

## 9. Common boot issues

### Port 8000 already in use

Stop the previous server with:

```text
Ctrl+C
```

If you accidentally used `Ctrl+Z`, run:

```bash
fg
```

Then press:

```text
Ctrl+C
```

Restart:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

---

### Cloudflare terminal looks frozen

That is normal. `cloudflared` stays running while the public tunnel is active.

Do not close it.

---

### CDS Sandbox cannot connect

Check these in order:

1. Local server is running
2. `http://localhost:8000/cds-services` shows JSON
3. Cloudflare tunnel is running
4. `https://your-url.trycloudflare.com/cds-services` shows JSON
5. You pasted the full `/cds-services` URL into the sandbox

---

### AI/OpenAI error

Check that `.env` exists and contains:

```env
OPENAI_API_KEY=your_key_here
```

If the AI call fails, the backend may still return a fallback card depending on the current code.

---

## 10. Demo note

This is a local hackathon/demo setup only.

Do not use real patient data.

Current flow:

```text
CDS Hooks Sandbox
→ Cloudflare public URL (backend)
→ local FastAPI backend
→ AI service
→ CDS card displayed in sandbox
→ card link opens Loop frontend (/embed) in iframe or new tab
```

---

## 11. Wire Loop side panel (/embed) into CDS Sandbox

The CDS card link opens the Loop Next.js app at `/embed` (side panel + workflow modals).

### Recommended: one public URL (prototype2 / lohp pattern)

Next.js proxies `/cds-services` and `/fhir` to the Python backend, so you only need **one tunnel**:

```text
Terminal 1: ./scripts/start-stack.sh   (backend :8000 + frontend :3000)
Terminal 2: cloudflared tunnel --url http://localhost:3000
```

In [CDS Sandbox](https://sandbox.cds-hooks.org/) settings:

```text
CDS Service Endpoint: https://YOUR-TUNNEL/cds-services
FHIR Server:          https://YOUR-TUNNEL/fhir
```

Set in `cds-ai-service/.env`:

```env
LOOP_APP_URL=https://YOUR-TUNNEL
```

Card links become `https://YOUR-TUNNEL/embed?patientId=...` — the Loop side panel loads inside the sandbox.

### Using lohp.ryanbeland.dev with teammate backend

If the full triage + FHIR backend runs on `:8000` and Next.js on `:3000`:

1. Copy `patient-workflow-visualization/.env.example` → `.env.local` with `BACKEND_URL=http://localhost:8000`
2. Point the Cloudflare tunnel at **Next.js (:3000)**, not the backend directly
3. Teammate backend must set card links to `{LOOP_APP_URL}/embed?...` with `type: "absolute"` (not `/portal/review` or `type: "smart"`)

### Verify locally

```bash
chmod +x scripts/start-stack.sh cds-ai-service/test-cds.sh
./cds-ai-service/test-cds.sh http://localhost:3000 triage-assistant
```

Open `http://localhost:3000/embed?patientId=b61008f3-84e2-8e3f-abd9-995a23133d57`
