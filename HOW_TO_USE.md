# How to Use Resume Builder Backend

## Quick Start Guide

### 1. Start the Server

```bash
npm run dev
```

The server will run on `http://localhost:4000`

---

## Using with Job URL (Recommended)

### Method 1: Using curl (Command Line)

```bash
curl -X POST "http://localhost:4000/api/resume/build" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SUPABASE_TOKEN" \
  -d '{
    "jobUrl": "https://jobs.example.com/job-posting",
    "userProfile": {
      "fullName": "John Doe",
      "email": "john@example.com",
      "phone": "+1-555-123-4567",
      "location": "San Francisco, CA",
      "experiences": [
        {
          "title": "Software Engineer",
          "company": "Tech Corp",
          "startDate": "2020-01",
          "endDate": "2024-01",
          "bullets": [
            "Built scalable applications",
            "Led team of 5 developers"
          ]
        }
      ],
      "skills": ["JavaScript", "React", "Node.js"],
      "education": [
        {
          "school": "State University",
          "degree": "BS Computer Science",
          "year": "2018"
        }
      ]
    },
    "template": "modern"
  }' \
  --output resume.pdf
```

### Method 2: Using JavaScript/Frontend

```javascript
const jobUrl = 'https://jobs.example.com/job-posting';
const token = 'YOUR_SUPABASE_TOKEN';

const response = await fetch('http://localhost:4000/api/resume/build', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    jobUrl: jobUrl,  // ← Just paste the job URL here
    userProfile: {
      fullName: 'John Doe',
      email: 'john@example.com',
      phone: '+1-555-123-4567',
      location: 'San Francisco, CA',
      experiences: [
        {
          title: 'Software Engineer',
          company: 'Tech Corp',
          startDate: '2020-01',
          endDate: '2024-01',
          bullets: [
            'Built scalable applications',
            'Led team of 5 developers'
          ]
        }
      ],
      skills: ['JavaScript', 'React', 'Node.js'],
      education: [
        {
          school: 'State University',
          degree: 'BS Computer Science',
          year: '2018'
        }
      ]
    },
    template: 'modern'  // Options: 'modern', 'classic', 'minimal'
  })
});

// Download the PDF
const blob = await response.blob();
const url = window.URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'resume.pdf';
a.click();
```

### Method 3: Using Python

```python
import requests

url = "http://localhost:4000/api/resume/build"
token = "YOUR_SUPABASE_TOKEN"

payload = {
    "jobUrl": "https://jobs.example.com/job-posting",
    "userProfile": {
        "fullName": "John Doe",
        "email": "john@example.com",
        "phone": "+1-555-123-4567",
        "location": "San Francisco, CA",
        "experiences": [
            {
                "title": "Software Engineer",
                "company": "Tech Corp",
                "startDate": "2020-01",
                "endDate": "2024-01",
                "bullets": [
                    "Built scalable applications",
                    "Led team of 5 developers"
                ]
            }
        ],
        "skills": ["JavaScript", "React", "Node.js"],
        "education": [
            {
                "school": "State University",
                "degree": "BS Computer Science",
                "year": "2018"
            }
        ]
    },
    "template": "modern"
}

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {token}"
}

response = requests.post(url, json=payload, headers=headers)

if response.status_code == 200:
    with open("resume.pdf", "wb") as f:
        f.write(response.content)
    print("✅ Resume saved to resume.pdf")
else:
    print(f"❌ Error: {response.json()}")
```

---

## Request Format

### Required Fields

- `userProfile` (object):
  - `fullName` (string, required)
  - `email` (string, required, valid email)
  - `phone` (string, optional)
  - `location` (string, optional)
  - `experiences` (array, optional)
  - `skills` (array, optional)
  - `education` (array, optional)

### Optional Fields

- `jobUrl` (string) - URL of the job posting (will be scraped automatically)
- `jobDescription` (string) - Job description text (if you don't have a URL)
- `template` (string) - Template style: `"modern"` (default), `"classic"`, or `"minimal"`
- `model` (string) - AI model to use (defaults to GPT-4o)

**Note:** You must provide either `jobUrl` OR `jobDescription` (at least one)

---

## Complete Example: Using Job URL

```bash
# Replace with your actual values
JOB_URL="https://www.linkedin.com/jobs/view/123456789"
TOKEN="your-supabase-token-here"

curl -X POST "http://localhost:4000/api/resume/build" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"jobUrl\": \"$JOB_URL\",
    \"userProfile\": {
      \"fullName\": \"Your Name\",
      \"email\": \"your.email@example.com\",
      \"phone\": \"+1-555-123-4567\",
      \"location\": \"Your City, State\",
      \"experiences\": [
        {
          \"title\": \"Your Job Title\",
          \"company\": \"Company Name\",
          \"startDate\": \"2020-01\",
          \"endDate\": \"2024-01\",
          \"bullets\": [
            \"Achievement 1\",
            \"Achievement 2\",
            \"Achievement 3\"
          ]
        }
      ],
      \"skills\": [\"Skill1\", \"Skill2\", \"Skill3\"],
      \"education\": [
        {
          \"school\": \"University Name\",
          \"degree\": \"Degree Name\",
          \"year\": \"2020\"
        }
      ]
    },
    \"template\": \"modern\"
  }" \
  --output resume.pdf
```

---

## What Happens When You Send a Request

1. **Scraping** (if `jobUrl` provided):
   - System automatically scrapes the job posting
   - Extracts the job description
   - Falls back to static scraping if dynamic fails

2. **AI Generation**:
   - Combines your profile with the job description
   - Uses GPT-4o to generate tailored resume content
   - Creates professional summary, experience bullets, etc.

3. **PDF Generation**:
   - Renders the resume using the selected template
   - Returns a professional PDF file

---

## Getting Your Supabase Token

If you need to get a fresh token, you can use the Supabase client in your frontend:

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
```

---

## Supported Job Sites

The scraper works with:
- LinkedIn job postings
- Indeed job postings
- Company career pages
- Most job board sites
- Static HTML pages
- JavaScript-rendered pages (using Puppeteer)

---

## Troubleshooting

**Issue: Empty or broken PDF**
- Make sure your token is valid and not expired
- Check that the job URL is accessible
- Verify the server logs for errors

**Issue: Scraping failed**
- The system will try dynamic scraping first, then static
- Some sites may block scrapers - try a different URL
- Check server logs for specific error messages

**Issue: 401 Unauthorized**
- Your Supabase token may be expired
- Get a fresh token from your Supabase client
- Make sure the token is in the Authorization header


