# Resume Builder Backend - Usage Guide

## Prerequisites

1. **Set up environment variables** - Create a `.env` file in the root directory:

```bash
PORT=4000
CORS_ORIGIN=http://localhost:3000

# Supabase (required for authentication)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here

# OpenRouter (required for AI generation)
OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_MODEL=meta-llama/llama-3.1-70b-instruct:free

# Puppeteer (optional - only if you need custom Chrome path)
PUPPETEER_EXECUTABLE_PATH=
```

2. **Get a Supabase access token** - Users need to authenticate via Supabase and get an access token from their client.

## API Endpoints

### Base URL
```
http://localhost:4000/api
```

### Authentication
All endpoints (except `/api/health`) require authentication via Bearer token:

```
Authorization: Bearer <supabase_access_token>
```

---

## 1. Health Check

**GET** `/api/health`

Check if the server is running.

```bash
curl http://localhost:4000/api/health
```

Response:
```json
{
  "ok": true,
  "ts": "2024-01-15T10:30:00.000Z"
}
```

---

## 2. Generate Resume Content (AI)

**POST** `/api/resume/generate`

Generate AI-powered resume content based on job description and user profile.

**Request Body:**
```json
{
  "jobDescription": "We are looking for a Senior Software Engineer with 5+ years of experience in Node.js, React, and cloud technologies...",
  "userProfile": {
    "fullName": "John Doe",
    "email": "john@example.com",
    "phone": "+1-234-567-8900",
    "summary": "Experienced full-stack developer...",
    "experiences": [
      {
        "title": "Senior Software Engineer",
        "company": "Tech Corp",
        "startDate": "2020-01",
        "endDate": "2024-01",
        "bullets": [
          "Built scalable microservices",
          "Led team of 5 developers"
        ]
      }
    ],
    "skills": ["Node.js", "React", "TypeScript", "AWS"],
    "education": [
      {
        "school": "State University",
        "degree": "BS Computer Science",
        "year": "2018"
      }
    ]
  },
  "model": "meta-llama/llama-3.1-70b-instruct:free"
}
```

**Example with curl:**
```bash
curl -X POST http://localhost:4000/api/resume/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SUPABASE_TOKEN" \
  -d '{
    "jobDescription": "Looking for a full-stack developer...",
    "userProfile": {
      "fullName": "John Doe",
      "email": "john@example.com",
      "experiences": [],
      "skills": ["JavaScript", "React"],
      "education": []
    }
  }'
```

**Response:**
```json
{
  "content": {
    "summary": "Tailored professional summary...",
    "experiences": [...],
    "skills": [...]
  }
}
```

---

## 3. Generate PDF from HTML

**POST** `/api/resume/pdf`

Convert HTML resume to PDF.

**Request Body:**
```json
{
  "html": "<!doctype html><html><head><style>...</style></head><body><h1>John Doe</h1>...</body></html>"
}
```

**Example with curl:**
```bash
curl -X POST http://localhost:4000/api/resume/pdf \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SUPABASE_TOKEN" \
  -d '{"html": "<html><body><h1>Resume</h1></body></html>"}' \
  --output resume.pdf
```

**Response:** Binary PDF file

---

## 4. Build Complete Resume (AI + PDF)

**POST** `/api/resume/build`

Generate AI content and convert directly to PDF in one request.

**Request Body:** Same as `/api/resume/generate`

**Example with curl:**
```bash
curl -X POST http://localhost:4000/api/resume/build \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SUPABASE_TOKEN" \
  -d '{
    "jobDescription": "Looking for a developer...",
    "userProfile": {
      "fullName": "John Doe",
      "email": "john@example.com",
      "experiences": [],
      "skills": ["JavaScript"],
      "education": []
    }
  }' \
  --output resume.pdf
```

**Response:** Binary PDF file

---

## 5. Scrape Static Job Page

**POST** `/api/scrape/static`

Scrape a static HTML job posting page.

**Request Body:**
```json
{
  "url": "https://example.com/job-posting"
}
```

**Example with curl:**
```bash
curl -X POST http://localhost:4000/api/scrape/static \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SUPABASE_TOKEN" \
  -d '{"url": "https://example.com/job-posting"}'
```

**Response:**
```json
{
  "title": "Job Title",
  "text": "Full job description text...",
  "html": "<html>...</html>"
}
```

---

## 6. Scrape Dynamic Job Page

**POST** `/api/scrape/dynamic`

Scrape a JavaScript-rendered job posting page (uses Puppeteer).

**Request Body:**
```json
{
  "url": "https://example.com/dynamic-job-posting"
}
```

**Example with curl:**
```bash
curl -X POST http://localhost:4000/api/scrape/dynamic \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SUPABASE_TOKEN" \
  -d '{"url": "https://example.com/dynamic-job-posting"}'
```

**Response:** Same format as static scrape

---

## Frontend Integration Example

### JavaScript/TypeScript

```javascript
// Get Supabase token (from your frontend)
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;

// Generate resume content
const response = await fetch('http://localhost:4000/api/resume/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    jobDescription: jobDescriptionText,
    userProfile: {
      fullName: 'John Doe',
      email: 'john@example.com',
      experiences: [...],
      skills: ['JavaScript', 'React'],
      education: [...]
    }
  })
});

const { content } = await response.json();
```

### Build complete PDF directly:

```javascript
const response = await fetch('http://localhost:4000/api/resume/build', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    jobDescription: jobDescriptionText,
    userProfile: userProfileData
  })
});

const blob = await response.blob();
const url = window.URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'resume.pdf';
a.click();
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Error message or validation details"
}
```

**Status Codes:**
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing/invalid token)
- `500` - Internal Server Error

---

## Testing Without Frontend

You can test with a Supabase access token from your Supabase dashboard or by logging in via your frontend and copying the token from the browser's network tab.


