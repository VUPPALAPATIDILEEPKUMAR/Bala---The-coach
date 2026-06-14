const ALLOWED_ORIGINS = new Set([
  "https://vuppalapatidileepkumar.github.io",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
]);

const ALLOWED_METRICS = new Set([
  "sleepHours",
  "restingHeartRate",
  "hrvMs",
  "spo2Percent",
  "steps",
  "exerciseMinutes",
  "baselineDays",
  "baselineLevel",
]);

const LANGUAGE_NAMES = {
  "en-IN": "Indian English",
  "hi-IN": "Hindi",
  "te-IN": "Telugu",
  "ta-IN": "Tamil",
  "kn-IN": "Kannada",
  "ml-IN": "Malayalam",
  "mr-IN": "Marathi",
  "bn-IN": "Bengali",
};

function corsHeaders(origin) {
  return {
    "access-control-allow-origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://vuppalapatidileepkumar.github.io",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "vary": "Origin",
  };
}

function json(data, status, origin) {
  return Response.json(data, { status, headers: corsHeaders(origin) });
}

function sanitizeSummary(summary) {
  const metrics = {};
  for (const [key, value] of Object.entries(summary?.metrics || {})) {
    if (ALLOWED_METRICS.has(key) && (Number.isFinite(value) || typeof value === "string")) metrics[key] = value;
  }
  return { source: String(summary?.source || "unknown").slice(0, 60), metrics };
}

function sanitizeHistory(history) {
  return (Array.isArray(history) ? history : [])
    .slice(-8)
    .map((item) => ({
      role: item?.role === "assistant" ? "assistant" : "user",
      content: String(item?.content || "").trim().slice(0, 800),
    }))
    .filter((item) => item.content);
}

function systemPrompt(language, tone) {
  const languageName = LANGUAGE_NAMES[language] || LANGUAGE_NAMES["en-IN"];
  const toneInstruction = {
    "warm-family": "Use the warmth, patience, affectionate directness, and everyday phrasing of a caring Indian elder or family guide. Never claim to be a real relative or deceased person.",
    "friendly-coach": "Be upbeat, friendly, practical, and lightly informal, like a trusted Indian health coach.",
    "calm-clinical": "Be calm, concise, precise, and reassuring without sounding cold.",
  }[tone] || "Be warm, friendly, and practical.";
  return [
    "You are BALA, a warm, practical Indian wellness companion.",
    toneInstruction,
    `Reply naturally in ${languageName}. Match the user's script and code-mixing. If they use romanized Telugu, Hindi, or Tamil, you may reply in the same friendly romanized style unless native script would be clearer.`,
    "Sound like a thoughtful trusted guide from India: friendly and conversational, never theatrical, patronizing, or overly formal.",
    "First answer the user's actual question. Then, when useful, ask one short follow-up question that helps you understand their situation.",
    "Use supplied wearable metrics only as context. Never invent readings or claim diagnosis, prediction, emergency monitoring, or certainty.",
    "For chest pain, severe breathing difficulty, fainting, stroke signs, severe allergic reaction, suicidal intent, or rapidly worsening symptoms, advise immediate local emergency help and do not continue routine coaching.",
    "For medical treatment, medicines, or persistent concerning symptoms, recommend a qualified clinician.",
    "Give one realistic next step. Keep most replies under 140 words.",
  ].join(" ");
}

async function callSarvam(env, messages) {
  const response = await fetch("https://api.sarvam.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "api-subscription-key": env.SARVAM_API_KEY,
    },
    body: JSON.stringify({
      model: env.SARVAM_MODEL || "sarvam-30b",
      messages,
      temperature: 0.45,
      max_tokens: 260,
    }),
  });
  if (!response.ok) throw new Error(`Sarvam returned ${response.status}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content;
}

async function callGemini(env, messages) {
  const model = env.GEMINI_MODEL || "gemini-3.5-flash";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: messages.map((message) => ({
          role: message.role === "assistant" ? "model" : "user",
          parts: [{ text: message.content }],
        })),
        generationConfig: { temperature: 0.45, maxOutputTokens: 260 },
      }),
    },
  );
  if (!response.ok) throw new Error(`Gemini returned ${response.status}`);
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
}

export async function onRequest(context) {
  const origin = context.request.headers.get("origin") || "";
  if (context.request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (context.request.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ error: "Origin not allowed" }, 403, origin);

  const body = await context.request.json().catch(() => null);
  const question = String(body?.question || "").trim().slice(0, 800);
  if (!question) return json({ error: "Question is required" }, 400, origin);

  const language = LANGUAGE_NAMES[body?.language] ? body.language : "en-IN";
  const tone = ["warm-family", "friendly-coach", "calm-clinical"].includes(body?.tone) ? body.tone : "warm-family";
  const summary = sanitizeSummary(body?.summary);
  const history = sanitizeHistory(body?.history);
  const messages = [
    { role: "system", content: systemPrompt(language, tone) },
    ...history,
    { role: "user", content: `Private derived context: ${JSON.stringify(summary)}\n\nUser: ${question}` },
  ];

  try {
    let answer;
    let provider;
    if (context.env.GEMINI_API_KEY) {
      answer = await callGemini(context.env, messages);
      provider = "Gemini";
    } else if (context.env.SARVAM_API_KEY) {
      answer = await callSarvam(context.env, messages);
      provider = "Sarvam";
    } else if (context.env.AI) {
      const result = await context.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
        messages,
        max_tokens: 260,
        temperature: 0.45,
      });
      answer = result.response;
      provider = "Cloudflare";
    } else {
      return json({ error: "No AI provider is configured" }, 503, origin);
    }
    if (!answer) throw new Error("Provider returned no answer");
    return json({ answer, provider }, 200, origin);
  } catch (error) {
    return json({ error: "AI provider unavailable", detail: String(error.message || error).slice(0, 120) }, 502, origin);
  }
}
