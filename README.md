# Portfolio with a live AI chat assistant

A personal portfolio site (`index.html`) with a chat widget in the
bottom-right corner. The widget is backed by a real LLM (Llama 3.1 via
[Groq](https://groq.com), free tier) through a serverless function
(`functions/api/chat.js`) running on [Cloudflare Pages](https://pages.cloudflare.com/) —
no server to manage, no cost at portfolio-level traffic.

If the live function is ever unreachable (not yet deployed, rate-limited,
or the API key is missing), the widget automatically falls back to a
small local FAQ matcher so it never breaks for a visitor.

## How it's wired together

```
Visitor's browser
   │  types a question into the chat widget
   ▼
POST /api/chat   (Cloudflare Pages Function — functions/api/chat.js)
   │  adds a system prompt with real facts about Suvishal,
   │  keeps the Groq API key secret (server-side env var)
   ▼
Groq API (llama-3.1-8b-instant)
   │  generates a grounded reply
   ▼
Reply streams back to the widget and renders in the chat panel
```

The API key never reaches the browser — it only lives as an
environment variable inside Cloudflare's infrastructure.

## One-time setup

### 1. Get a free Groq API key

1. Go to [console.groq.com](https://console.groq.com) and sign up (no credit card required for the free tier).
2. Create an API key under **API Keys**.
3. Keep it somewhere safe — you'll paste it into Cloudflare in step 3, never into this repo.

Groq's free tier and available models change occasionally — check
[console.groq.com/docs/models](https://console.groq.com/docs/models) if
`llama-3.1-8b-instant` (used in `functions/api/chat.js`) is ever retired,
and swap the `model` field in that file for whatever's current.

### 2. Push this project to GitHub

```bash
cd portfolio-chat-project
git init
git add .
git commit -m "Portfolio site with live Groq-powered chat assistant"
gh repo create suvishal-portfolio --public --source=. --push
# (or create the repo on github.com first, then: git remote add origin <url> && git push -u origin main)
```

### 3. Deploy on Cloudflare Pages

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Pick the repo you just pushed.
3. Build settings: leave **Build command** empty and **Build output directory** as `/` (this is a static site with no build step).
4. Before or after the first deploy, go to the project's **Settings → Environment variables** and add:
   - `GROQ_API_KEY` = your key from step 1 (mark it as a **secret**, not plaintext)
5. Deploy. Cloudflare gives you a `https://<project>.pages.dev` URL immediately — free custom domains can be added under **Custom domains**.

That's it — the chat widget on that URL now talks to a real model.

### Local testing (optional)

```bash
npm install
echo "GROQ_API_KEY=your-key-here" > .dev.vars
npm run dev
```

This runs the whole site (static files + the function) locally via Wrangler,
matching how it behaves once deployed.

## Files

- `index.html` — the portfolio page and chat widget UI/logic
- `functions/api/chat.js` — the serverless function that calls Groq, with the grounding facts about Suvishal as its system prompt
- `package.json` / `.gitignore` — minimal project plumbing for local dev with Wrangler

## Updating the facts the bot knows

Edit the `SYSTEM_PROMPT` constant at the top of `functions/api/chat.js`.
No redeploy steps beyond a normal `git push` — Cloudflare Pages
auto-deploys on every push to the connected branch.
