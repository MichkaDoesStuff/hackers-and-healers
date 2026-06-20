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

## 11. Wire Loop frontend into CDS cards

The CDS card link now opens the Loop Next.js app at `/embed`, with patient context in the query string.

You need **four terminals** for the full demo:

```text
Terminal 1: FastAPI backend (port 8000)
Terminal 2: Cloudflare tunnel → backend
Terminal 3: Next.js frontend (port 3000)
Terminal 4: Cloudflare tunnel → frontend
```

### Start the frontend

From the repo root:

```bash
cd patient-workflow-visualization
npm install
npm run dev
```

Test locally:

```text
http://localhost:3000/embed
```

### Expose the frontend publicly

In a fourth terminal:

```bash
cloudflared tunnel --url http://localhost:3000
```

Copy the printed URL, e.g. `https://loop-demo.trycloudflare.com`.

### Point the backend at the public frontend URL

Add to `cds-ai-service/.env`:

```env
LOOP_APP_URL=https://loop-demo.trycloudflare.com
```

Restart the FastAPI server after changing `.env`.

The backend builds card links like:

```text
https://loop-demo.trycloudflare.com/embed?patientId=...&hook=patient-view&source=cds-hooks
```

### Verify end-to-end

1. Register the **backend** discovery URL in the sandbox (`https://backend-tunnel/cds-services`).
2. Trigger Patient View — a CDS card should appear.
3. Click **Open Loop assistant** on the card.
4. The Loop side panel loads inside the sandbox (or in a new tab, depending on sandbox behavior).

If the iframe is blank, confirm `LOOP_APP_URL` uses the **frontend** tunnel URL, not the backend URL.
