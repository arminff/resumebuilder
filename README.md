## Resume Builder Backend

AI-powered resume backend that:
- Authenticates users with Supabase JWTs
- Scrapes job postings (static + dynamic) to extract descriptions, responsibilities, and qualifications
- Generates tailored resume content with OpenRouter (GPT-4o by default)
- Renders professional, ATS-friendly PDFs via Puppeteer and HTML templates

### Stack
- Node.js, Express.js
- Supabase (Auth + PostgreSQL)
- Stripe (Subscriptions & Payments)
- OpenRouter (AI content)
- Puppeteer (HTML → PDF)
- Axios + Cheerio (static scraping), Puppeteer (dynamic scraping)
- Zod (request validation)

---

Request → Server → Auth → Routes → Utils → AI → Templates → PDF → Response


## Quick Start

1) Configure environment
```bash
cp .env.example .env
# Fill: SUPABASE_URL, SUPABASE_ANON_KEY, OPENROUTER_API_KEY, (optional) OPENROUTER_MODEL
```

2) Install and run
```bash
npm install
npm run dev
# Server → http://localhost:4000
```

3) Health check
```bash
curl http://localhost:4000/api/health
```

Authentication: All `/api/*` routes (except `/api/health`) require
```
Authorization: Bearer <supabase_access_token>
```

You can generate a token with your frontend Supabase client or a small script (see HOW_TO_USE.md).

---

## Environment Variables

### Required
- `SUPABASE_URL` – your Supabase project URL
- `SUPABASE_ANON_KEY` – Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` – Supabase service role key (for subscriptions)
- `OPENROUTER_API_KEY` – OpenRouter API key
- `STRIPE_SECRET_KEY` – Stripe secret API key
- `STRIPE_WEBHOOK_SECRET` – Stripe webhook signing secret

### Optional
- `OPENROUTER_MODEL` – AI model (default: `openai/gpt-4o`)
- `STRIPE_PRICE_ID_BASIC` – Stripe price ID for basic plan
- `STRIPE_PRICE_ID_PRO` – Stripe price ID for pro plan
- `STRIPE_SUCCESS_URL` – Success redirect URL for checkout
- `STRIPE_CANCEL_URL` – Cancel redirect URL for checkout
- `FRONTEND_URL` – Frontend URL for redirects
- `PORT` – Server port (default: `4000`)
- `PUPPETEER_EXECUTABLE_PATH` – Custom Chromium path

---

## Endpoints

### Resume & Scraping
- `GET /api/health` – health check (no auth)
- `POST /api/scrape/static` – scrape static page
  - body: `{ "url": "https://..." }`
- `POST /api/scrape/dynamic` – scrape dynamic/JS-rendered page
  - body: `{ "url": "https://..." }`
- `POST /api/resume/generate` – AI-only JSON resume content
  - body: `{ jobUrl? | jobDescription?, userProfile, model? }`
- `POST /api/resume/pdf` – HTML → PDF
  - body: `{ html }`
- `POST /api/resume/build` – end-to-end: scrape (optional) + AI + PDF
  - body: `{ jobUrl? | jobDescription?, userProfile, template?, model? }`

### Subscriptions
- `GET /api/subscription/plans` – get available subscription plans
- `GET /api/subscription/status` – get current user's subscription status
- `POST /api/subscription/checkout` – create Stripe checkout session
  - body: `{ "planId": "basic" | "pro" }`
- `POST /api/subscription/portal` – create Stripe customer portal session
  - body: `{ "returnUrl"?: "https://..." }`
- `POST /api/subscription/webhook` – Stripe webhook endpoint (no auth, verified via signature)

Notes:
- Either `jobUrl` or `jobDescription` is required.
- `template` one of: `modern` (default), `classic`, `minimal`.

---

## Usage Examples

### Build resume from a job URL (recommended)
```bash
TOKEN="<YOUR_SUPABASE_TOKEN>"
JOB_URL="https://company.com/careers/posting"

curl -X POST "http://localhost:4000/api/resume/build" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"jobUrl\": \"$JOB_URL\",
    \"userProfile\": {
      \"fullName\": \"Jane Smith\",
      \"email\": \"jane@example.com\",
      \"phone\": \"+1-555-987-6543\",
      \"location\": \"San Francisco, CA\",
      \"experiences\": [
        { \"title\": \"Senior Engineer\", \"company\": \"TechCorp\", \"startDate\": \"2021-02\", \"endDate\": \"Present\", \"bullets\": [\"Led migration...\", \"Reduced latency...\"] }
      ],
      \"skills\": [\"Node.js\", \"React\", \"PostgreSQL\"],
      \"education\": [ { \"school\": \"State University\", \"degree\": \"BS CS\", \"year\": \"2018\" } ]
    },
    \"template\": \"classic\"
  }" \
  --output resume.pdf
```

### Build from raw job description text
```bash
curl -X POST "http://localhost:4000/api/resume/build" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "jobDescription": "Looking for a Senior Full‑Stack Developer...",
    "userProfile": { "fullName": "John Doe", "email": "john@example.com" },
    "template": "minimal"
  }' \
  --output resume.pdf
```

### Preview AI content (JSON) before generating PDF
```bash
curl -X POST "http://localhost:4000/api/resume/generate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "jobUrl": "https://company.com/careers/posting",
    "userProfile": { "fullName": "Jane Smith", "email": "jane@example.com" }
  }' | jq .
```

---

## Templates
Choose via `template`:
- `modern` – simple, ATS-friendly serif layout (default)
- `classic` – denser, traditional resume style
- `minimal` – very clean, compact

All templates are optimized for ATS parsing, use semantic headings, and render to PDF with Puppeteer.

---

## Scraping
- Static scraping: Axios + Cheerio
- Dynamic scraping: Puppeteer (waits for content; falls back to static if needed)
- Extracts job description; improved heuristics target responsibilities/qualifications

If a site blocks scraping, try providing `jobDescription` directly.

---

## Troubleshooting

Port already in use (EADDRINUSE):
```bash
kill -9 $(lsof -ti :4000)
```

401 Unauthorized:
- Your Supabase token may be missing/expired
- Ensure `Authorization: Bearer <token>` header is present

Empty/broken PDF:
- Ensure you are hitting `/api/resume/build` or `/api/resume/pdf` (not `/generate`)
- We send proper binary with `Content-Type: application/pdf` and `Content-Length`

OpenRouter errors:
- Verify `OPENROUTER_API_KEY` and internet connectivity
- Optionally set `OPENROUTER_MODEL`

Scraping returns little content:
- Use `dynamic` endpoint or pass `jobDescription` directly
- Some sites obfuscate content; try another URL

---

## Subscriptions

This backend includes Stripe subscription integration. See [STRIPE_SETUP.md](./STRIPE_SETUP.md) for complete setup instructions.

### Quick Setup

1. **Create Stripe products and prices** in Stripe Dashboard
2. **Set up webhook endpoint** in Stripe Dashboard
3. **Create database table** in Supabase (see `DATABASE_SCHEMA.md`)
4. **Configure environment variables** (see above)

### Subscription Plans

- **Free**: 5 resumes/month, basic templates
- **Basic**: 50 resumes/month, all templates, priority support
- **Pro**: Unlimited resumes, all templates, priority support, custom branding

### Flow

1. User selects plan → Frontend calls `/api/subscription/checkout`
2. Backend creates Stripe Checkout Session → Returns checkout URL
3. User completes payment on Stripe → Stripe sends webhook
4. Backend processes webhook → Updates Supabase database
5. User subscription status synced → Frontend queries `/api/subscription/status`

See [STRIPE_SETUP.md](./STRIPE_SETUP.md) for detailed documentation.

---

## Contributing / Development
```bash
npm run dev    # auto-reload server
npm start      # one-time start
```

---

## License
MIT

