#!/bin/bash

# Simple example: Use Resume Builder with a Job URL
# Just update the variables below and run!

BASE_URL="http://localhost:4000/api"
TOKEN="YOUR_SUPABASE_TOKEN_HERE"  # Replace with your token
JOB_URL="https://jobs.apple.com/en-ca/details/114438004/ca-specialist-full-time-part-time-and-part-time-temporary?team=APPST"  # Replace with any job URL

# Your profile information
curl -X POST "$BASE_URL/resume/build" \
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
            \"Your achievement 1\",
            \"Your achievement 2\",
            \"Your achievement 3\"
          ]
        }
      ],
      \"skills\": [\"Skill 1\", \"Skill 2\", \"Skill 3\"],
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

echo "✅ Resume saved to resume.pdf"


