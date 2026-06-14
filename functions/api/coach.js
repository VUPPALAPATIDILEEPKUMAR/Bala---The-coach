const ALLOWED_KEYS = new Set([
  "sleepHours",
  "restingHeartRate",
  "hrvMs",
  "spo2Percent",
  "steps",
  "exerciseMinutes",
]);

function sanitizeSummary(summary) {
  const metrics = {};
  for (const [key, value] of Object.entries(summary?.metrics || {})) {
    if (ALLOWED_KEYS.has(key) && Number.isFinite(value)) metrics[key] = value;
  }
  return { source: String(summary?.source || "unknown").slice(0, 40), metrics };
}

export async function onRequestPost(context) {
  if (!context.env.AI) {
    return Response.json({ error: "AI binding is not configured" }, { status: 503 });
  }

  const origin = context.request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(context.request.url).host) {
    return Response.json({ error: "Cross-origin requests are not allowed" }, { status: 403 });
  }

  const body = await context.request.json().catch(() => null);
  const question = String(body?.question || "").trim().slice(0, 500);
  if (!question) return Response.json({ error: "Question is required" }, { status: 400 });

  const summary = sanitizeSummary(body?.summary);
  const system = [
    "You are BALA, a cautious wellness guide.",
    "Use only the supplied derived metric summary.",
    "Do not diagnose, prescribe, claim certainty, or provide emergency triage.",
    "Explain trends plainly and recommend one conservative next action.",
    "Mention that wearable data can be incomplete and professional care is appropriate for concerns.",
    "Keep the answer under 110 words.",
  ].join(" ");

  const result = await context.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
    messages: [
      { role: "system", content: system },
      { role: "user", content: `Summary: ${JSON.stringify(summary)}\nQuestion: ${question}` },
    ],
    max_tokens: 180,
    temperature: 0.2,
  });

  return Response.json({
    answer: result.response || "I could not create a reliable answer from the available summary.",
  });
}

export function onRequest() {
  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
