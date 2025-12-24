#!/bin/bash

# Example API request for Resume Builder Backend
# Replace YOUR_SUPABASE_TOKEN with an actual token from Supabase

BASE_URL="http://localhost:4000/api"
# Replace YOUR_SUPABASE_TOKEN with an actual token from Supabase
TOKEN="YOUR_SUPABASE_TOKEN_HERE"



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

