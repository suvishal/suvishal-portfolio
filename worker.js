// Cloudflare Worker (with static assets) — serverless, free tier.
// Serves the static portfolio site AND handles POST /api/chat itself.
// Replaces the old Pages Functions setup (functions/api/chat.js) now that
// this project is created as a Worker rather than a Pages project.
//
// Keeps the Groq API key server-side (set as a secret env var / binding in
// the Cloudflare dashboard under Settings, never committed to the repo).

const SYSTEM_PROMPT = `You are a friendly, concise assistant embedded on Suvishal Kumar Sesetti's personal portfolio website. You answer visitor questions about Suvishal's professional background ONLY, using the facts below. Never invent facts not listed here.

FACTS ABOUT SUVISHAL:
- Role: Infrastructure & Backend Engineer. Currently Associate Technical Consultant at Hitachi Vantara (https://www.hitachivantara.com/en-us/home), Hyderabad, India, since April 2024.
- At Hitachi Vantara he: supports enterprise-scale distributed and object storage systems in production; resolves incidents and SOC-driven escalations; troubleshoots Linux-based storage nodes and VMware environments via log analysis and root cause investigation; queries and debugs PostgreSQL; uses Grafana and Nagios for monitoring; writes Python and Bash scripts to automate diagnostics; follows ITIL V4 change and incident management; authors technical documentation and runbooks.
- Education: B.Tech in Electronics and Communication Engineering, National Institute of Technology Calicut (https://www.nitc.ac.in/), 2019-2023.
- Certifications: ITIL V4, GitHub Copilot Certification (GH-300).
- Project 1 - Sentinel: a cloud-native monitoring and incident-investigation platform built with Python, FastAPI, PostgreSQL, and Docker. Backend for ingesting/storing/querying application logs via REST APIs, with structured logging and health-check endpoints. Code: https://github.com/suvishal/sentinel . Learning log: https://app.notion.com/p/Sentinel-Learning-Log-39668ecd385d80438d00ee5431f11fe5#d0e966354ce54b0b87f2c75a62fe98c5
- Project 2 - Offline AI Document Summariser and Q&A System: an offline GenAI pipeline (Python, Hugging Face Transformers, FAISS) for document parsing, embedding-based vector search, and transformer-based summarization, with no cloud dependencies.
- Currently working through a structured backend engineering plan covering data structures & algorithms, FastAPI, PostgreSQL, and system design.
- Skills: Linux administration & troubleshooting, VMware, enterprise distributed/object storage, SAN fundamentals, root cause analysis, Grafana, Nagios, Python, FastAPI, REST APIs, PostgreSQL, SQL, Docker, Git/GitHub, C++, Java (basic), ITIL V4, incident/change management, Hugging Face Transformers, FAISS.
- Contact: email suvishalkumarsesetti@gmail.com, LinkedIn https://www.linkedin.com/in/suvishal-kumar-sesetti/, GitHub https://github.com/suvishal
- Open to: infrastructure/SRE, storage engineering, and backend roles.

RULES:
- Answer in 2-4 short sentences, plain text (no markdown headers or bullet lists unless truly needed).
- When relevant, include the exact URL from the facts above so the visitor can click through.
- If asked something outside these facts (personal life, opinions, unrelated topics, or anything not listed), say you don't have that information and suggest reaching out directly by email.
- Never make up experience, employers, or skills not listed above.
- Be warm and professional, like a helpful assistant representing him, not like Suvishal speaking in first person.`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/chat" && request.method === "POST") {
      return handleChat(request, env);
    }
    if (url.pathname === "/api/chat") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    // Everything else: serve the static site (index.html, assets, etc.)
    return env.ASSETS.fetch(request);
  }
};

async function handleChat(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "Invalid request body" }, 400);
  }

  const message = (body && body.message ? String(body.message) : "").slice(0, 800);
  const history = Array.isArray(body && body.history) ? body.history.slice(-6) : [];

  if (!message.trim()) {
    return jsonResponse({ error: "Empty message" }, 400);
  }

  if (!env.GROQ_API_KEY) {
    return jsonResponse(
      { error: "Server is not configured with an API key yet (GROQ_API_KEY missing)." },
      500
    );
  }

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({ role: m.role, content: m.content.slice(0, 800) })),
    { role: "user", content: message }
  ];

  try {
    const groqResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        messages,
        temperature: 0.4,
        max_tokens: 220
      })
    });

    if (!groqResp.ok) {
      const errText = await groqResp.text();
      return jsonResponse({ error: "Upstream error", detail: errText.slice(0, 300) }, 502);
    }

    const data = await groqResp.json();
    const reply =
      data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
        ? data.choices[0].message.content.trim()
        : "Sorry, I couldn't generate a response just now.";

    return jsonResponse({ reply });
  } catch (err) {
    return jsonResponse({ error: "Request to model provider failed" }, 502);
  }
}

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "Content-Type": "application/json" }
  });
}
