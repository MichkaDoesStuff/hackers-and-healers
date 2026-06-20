#!/usr/bin/env node
import { chromium } from "playwright"

const FHIR = "https://lohp.ryanbeland.dev/fhir"
const PATIENT = "b61008f3-84e2-8e3f-abd9-995a23133d57"
const discovery = process.argv[2]
if (!discovery) {
  console.error("Usage: node test-sandbox-discovery.mjs <discovery-url>")
  process.exit(2)
}

const sandboxUrl = new URL("https://sandbox.cds-hooks.org/")
sandboxUrl.searchParams.set("fhirServiceUrl", FHIR)
sandboxUrl.searchParams.set("serviceDiscoveryURL", discovery)
sandboxUrl.searchParams.set("patientId", PATIENT)
sandboxUrl.searchParams.set("screen", "patient-view")

console.log("Discovery:", discovery)
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const posts = []
page.on("response", async (res) => {
  if (res.url().includes("/cds-services/") && res.request().method() === "POST") {
    posts.push({ url: res.url(), status: res.status(), body: (await res.text()).slice(0, 200) })
  }
})
await page.goto(sandboxUrl.toString(), { waitUntil: "networkidle", timeout: 60000 })
await page.waitForTimeout(6000)
const text = await page.locator("body").innerText()
await browser.close()
console.log("No response error:", text.includes("No response made to CDS Service"))
for (const p of posts.filter((x) => x.url.includes(new URL(discovery).host))) {
  console.log(p.status, p.url, p.body)
}
