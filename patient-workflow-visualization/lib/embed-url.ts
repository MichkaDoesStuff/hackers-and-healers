/** Build embed iframe query string — loop opens workflow via plain navigation (no JS required). */
export function embedQuery(params: {
  patientId: string
  source?: string
  hook?: string
  loop?: string | null
}): string {
  const q = new URLSearchParams()
  q.set("patientId", params.patientId.replace(/^Patient\//, ""))
  if (params.source) q.set("source", params.source)
  if (params.hook) q.set("hook", params.hook)
  if (params.loop) q.set("loop", params.loop)
  return q.toString()
}

export function embedPath(params: Parameters<typeof embedQuery>[0]): string {
  return `/embed?${embedQuery(params)}`
}
