# Portfolio with a live AI chat assistant

A personal portfolio site (`index.html`) with a chat widget in the
bottom-right corner. The widget is backed by a real LLM
(`openai/gpt-oss-20b` via [Groq](https://groq.com), free tier) through a
serverless [Cloudflare Worker](https://developers.cloudflare.com/workers/)
(`worker.js`) that also serves the static site itself — no server to
manage, no cost at portfolio-level traffic.

If the live function is ever unreachable (not yet deployed, rate-limited,
or the API key is missing), the widget automatically falls back to a
small local FAQ matcher so it never breaks for a visitor.

> **Note on architecture:** this project was originally scaffolded around
> Cloudflare **Pages Functions** (a `functions/api/chat.js` file using
> file-based routing). Cloudflare's dashboard now creates new "Connect to
> Git" projects as **Workers with static assets** instead of classic
> Pages projects, so the live deployment actually runs on **`worker.js`**
> (a single Worker `fetch` handler that serves static files via an
> `ASSETS` binding and handles `POST /api/chat` itself), configured by
> **`wrangler.toml`**. The old `functions/api/chat.js` is kept in the repo
> for reference/history but is not used by the deployed site — if you're
> setting this up fresh, you only need `worker.js` + `wrangler.toml`.

## How it's wired together

```
Visitor's browser
   │  types a question into the chat widget
   ▼
POST /api/chat   (Cloudflare Worker — worker.js, fetch handler)
   │  adds a system prompt with real facts about Suvishal,
   │  keeps the Groq API key secret (server-side secret binding)
   ▼
Groq API (openai/gpt-oss-20b)
   │  generates a grounded reply
   ▼
Reply renders in the chat panel

Any other request (GET /, /style, images, etc.)
   ▼
Served directly from static assets via env.ASSETS.fetch(request)
```

The API key never reaches the browser — it only lives as a secret
binding inside Cloudflare's infrastructure.

## One-time setup

### 1. Get a free Groq API key

1. Go to [console.groq.com](https://console.groq.com) and sign up (no credit card required for the free tier).
2. Create an API key under **API Keys**.
3. Keep it somewhere safe — you'll paste it into Cloudflare in step 3, never into this repo.

Groq retired the original Llama free-tier models on 16 Aug 2026 (Llama
3.1/3.3 moved to enterprise-only pricing). The current free-tier chat
models are `openai/gpt-oss-20b` (fast, used here) and
`openai/gpt-oss-120b`. Check
[console.groq.com/docs/models](https://console.groq.com/docs/models) if
`openai/gpt-oss-20b` (used in `worker.js`) is ever retired in turn, and
swap the `model` field in that file for whatever's current.

### 2. Push this project to GitHub

```bash
cd portfolio-chat-project
git init
git add .
git commit -m "Portfolio site with live Groq-powered chat assistant"
gh repo create suvishal-portfolio --public --source=. --push
# (or create the repo on github.com first, then: git remote add origin <url> && git push -u origin main)
```

### 3. Deploy on Cloudflare (Workers & Pages)

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create application**.
2. Connect to Git and pick the repo you just pushed. (Cloudflare will run
   the deploy command from `package.json` — `npx wrangler deploy` — which
   reads `wrangler.toml` to find `worker.js` as the entry point and `./`
   as the static asset directory.)
3. Once the first deploy finishes, go to **Settings → Variables and Secrets** and add:
   - `GROQ_API_KEY` = your key from step 1, type **Secret**
4. Trigger a fresh deploy (env var changes don't apply retroactively — push an empty commit, or use **Retry deployment**) so the Worker picks up the key.

Cloudflare gives you a `https://<project>.workers.dev` URL — free custom
domains can be added under **Custom Domains** on the Worker's settings.

### Local testing (optional)

```bash
npm install
echo "GROQ_API_KEY=your-key-here" > .dev.vars
npm run dev
```

This runs the whole site (static files + the Worker) locally via
Wrangler, matching how it behaves once deployed.

## Files

- `index.html` — the portfolio page and chat widget UI/logic
- `worker.js` — the Cloudflare Worker: serves the static site and handles `POST /api/chat` (calls Groq), with the grounding facts about Suvishal as its system prompt
- `wrangler.toml` — Worker config: entry point (`worker.js`) and static asset directory (`./`)
- `.assetsignore` — keeps non-site files (this repo's own tooling, `.git`, etc.) out of the deployed static assets
- `functions/api/chat.js` — earlier Pages Functions version, kept for reference; not used by the live deployment
- `package.json` / `.gitignore` — minimal project plumbing for local dev with Wrangler

## Updating the facts the bot knows

Edit the `SYSTEM_PROMPT` constant at the top of `worker.js`. No redeploy
steps beyond a normal `git push` — Cloudflare auto-deploys on every push
to the connected branch.
