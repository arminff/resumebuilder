## Resume Builder Backend

Node.js + Express backend for AI-powered resume generation using Supabase auth, OpenRouter for content, and Puppeteer for PDF.

### Quickstart

1. Copy env:

```bash
cp .env.example .env
```

2. Fill `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `OPENROUTER_API_KEY`.

3. Install and run:

```bash
npm install
npm run dev
```

### Endpoints

- `GET /api/health` – health check
- `POST /api/scrape/static` – scrape static HTML by URL (auth)
- `POST /api/scrape/dynamic` – scrape dynamic page via headless browser (auth)
- `POST /api/resume/generate` – generate tailored resume content (auth)
- `POST /api/resume/pdf` – render provided HTML to PDF (auth)
- `POST /api/resume/build` – end-to-end: AI + PDF (auth)

All `/api/*` routes (except `/api/health`) require `Authorization: Bearer <supabase_access_token>`.


