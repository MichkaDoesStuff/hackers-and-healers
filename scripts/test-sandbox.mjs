#!/usr/bin/env node
/**
 * Opens CDS Sandbox with Loop configured and checks for a CDS card + embed link.
 */
import { chromium } from "playwright"

const TUNNEL =
  process.env.LOOP_TUNNEL_URL ??
  process.env.LOOP_APP_URL?.replace(/\/$/, "") ??
  "https://mainland-representation-resistant-linda.trycloudflare.com"
const FHIR = process.env.FHIR_URL ?? "https://lohp.ryanbeland.dev/fhir"
const PATIENT = process.env.SANDBOX_PATIENT_ID ?? "b61008f3-84e2-8e3f-abd9-995a23133d57"

const sandboxUrl = new URL("https://sandbox.cds-hooks.org/")
sandboxUrl.searchParams.set("fhirServiceUrl", FHIR)
sandboxUrl.searchParams.set("serviceDiscoveryURL", `${TUNNEL}/cds-services`)
sandboxUrl.searchParams.set("patientId", PATIENT)
sandboxUrl.searchParams.set("screen", "patient-view")

console.log("Tunnel:", TUNNEL)
console.log("Opening:", sandboxUrl.toString())

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()

const cdsResponses = []
page.on("response", async (res) => {
  const url = res.url()
  if (url.includes("/cds-services/") && res.request().method() === "POST") {
    let body = ""
    try {
      body = await res.text()
    } catch {
      body = "<unreadable>"
    }
    cdsResponses.push({ url, status: res.status(), body: body.slice(0, 400) })
  }
})

await page.goto(sandboxUrl.toString(), { waitUntil: "networkidle", timeout: 60000 })
await page.waitForTimeout(5000)

const bodyText = await page.locator("body").innerText()
const hasNoResponse = bodyText.includes("No response made to CDS Service")
const hasOpenLoops = /open loops|Open Loop assistant|review in Loop/i.test(bodyText)
const hasLohpReferral = /Pending Referral|Review Referral/i.test(bodyText)

console.log("\n--- CDS POST responses from browser ---")
if (cdsResponses.length === 0) {
  console.log("(none captured)")
} else {
  for (const r of cdsResponses) {
    console.log(`${r.status} ${r.url}\n  ${r.body}\n`)
  }
}

console.log("--- UI signals ---")
console.log("No response error:", hasNoResponse)
console.log("Loop card visible:", hasOpenLoops)
console.log("Lohp referral card:", hasLohpReferral)

await browser.close()

if (hasNoResponse || cdsResponses.some((r) => r.status >= 400)) {
  console.error("\nFAIL: sandbox did not receive a valid CDS response")
  process.exit(1)
}
if (!hasOpenLoops && !cdsResponses.some((r) => r.body.includes("Open Loop assistant"))) {
  console.error("\nFAIL: Loop CDS card not detected")
  process.exit(1)
}

console.log("\nPASS: Loop CDS card reachable from CDS Sandbox")
