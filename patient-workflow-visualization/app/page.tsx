import { redirect } from "next/navigation"

// Single experience: the front door is the CDS Hooks Sandbox embed (LoHop side panel).
// The standalone clinic dashboard is preserved at /clinic.
export default function Page() {
  redirect("/sandbox")
}
