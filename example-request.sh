#!/bin/bash

# Example API request for Resume Builder Backend
# Replace YOUR_SUPABASE_TOKEN with an actual token from Supabase

BASE_URL="http://localhost:4000/api"
# Fresh Supabase access token (expires at 2025-11-03T22:39:19.000Z)
TOKEN="eyJhbGciOiJIUzI1NiIsImtpZCI6IlhnUjh0aWNSa0h5ZDdsK00iLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3RxbHFydWhieGZ0dXR1dWR4eHluLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiJlMDhjYWEyMS05YmU2LTQ2NWMtOGYwNi0wNTYwYzc4YzZhZGMiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzYyMjA5NTU5LCJpYXQiOjE3NjIyMDU5NTksImVtYWlsIjoiYXJtaW5mbjIwMDRAZ21haWwuY29tIiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCJdfSwidXNlcl9tZXRhZGF0YSI6eyJlbWFpbCI6ImFybWluZm4yMDA0QGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJwaG9uZV92ZXJpZmllZCI6ZmFsc2UsInN1YiI6ImUwOGNhYTIxLTliZTYtNDY1Yy04ZjA2LTA1NjBjNzhjNmFkYyJ9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzYyMjA1OTU5fV0sInNlc3Npb25faWQiOiJiOTYzM2Y3Mi00ZGFjLTRmOGQtYmE2Zi0wYjc5MWE4ZDdjZjgiLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.jzg0G-Mbgw6AyxWeJitg3a2ygBOGr1I94kdgcsqNUOc"



# Debug: Check if token is set (shows first 20 chars only)
if [ -z "$TOKEN" ]; then
  echo "❌ ERROR: TOKEN variable is empty!"
  exit 1
fi
echo "✅ Token set (${#TOKEN} chars, starts with: ${TOKEN:0:20}...)"

# Example 2: Build complete resume (AI + PDF) - saves to resume.pdf
# Option A: Use jobUrl (recommended - automatically scrapes job posting)
# Option B: Use jobDescription text directly
# Template options: "modern" (default), "classic", or "minimal"

# Example with jobUrl (scrapes automatically):
curl -X POST "$BASE_URL/resume/build" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "jobUrl": "https://jobs.apple.com/en-ca/details/114438004/ca-specialist-full-time-part-time-and-part-time-temporary?team=APPST",
    "userProfile": {
      "fullName": "Jane Smith",
      "email": "jane.smith@example.com",
      "phone": "+1-555-987-6543",
      "location": "San Francisco, CA",
      "experiences": [
        {
          "title": "Full-Stack Developer",
          "company": "WebDev Co",
          "startDate": "2021-03",
          "endDate": "present",
          "bullets": [
            "Built customer-facing web applications using React and Node.js",
            "Designed and implemented RESTful APIs",
            "Collaborated with product team on feature development"
          ]
        }
      ],
      "skills": ["JavaScript", "React", "Node.js", "PostgreSQL", "Git"],
      "education": [
        {
          "school": "Tech Institute",
          "degree": "BS Computer Science",
          "year": "2020"
        }
      ]
    },
    "template": "modern"
  }' \
  --output resume.pdf

# Or use jobDescription directly:
# "jobDescription": "Looking for a skilled Full-Stack Developer..."

echo -e "\nPDF saved to resume.pdf\n"

