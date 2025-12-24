#!/bin/bash

# Example: Build resume from a job URL
# The system will automatically scrape the job posting and generate a tailored resume

BASE_URL="http://localhost:4000/api"
TOKEN="YOUR_SUPABASE_TOKEN_HERE"  # Replace with your token

# Replace this with your actual job posting URL
JOB_URL="https://example.com/job-posting"

echo "🔍 Scraping job from: $JOB_URL"
echo "📄 Generating resume..."

curl -X POST "$BASE_URL/resume/build" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"jobUrl\": \"$JOB_URL\",
    \"userProfile\": {
      \"fullName\": \"John Doe\",
      \"email\": \"john.doe@example.com\",
      \"phone\": \"+1-555-123-4567\",
      \"location\": \"San Francisco, CA\",
      \"experiences\": [
        {
          \"title\": \"Senior Software Engineer\",
          \"company\": \"Tech Corp\",
          \"startDate\": \"2020-01\",
          \"endDate\": \"2024-01\",
          \"bullets\": [
            \"Built scalable microservices serving 1M+ users\",
            \"Led team of 5 developers\",
            \"Improved API performance by 40%\"
          ]
        }
      ],
      \"skills\": [\"JavaScript\", \"Node.js\", \"React\", \"TypeScript\", \"AWS\", \"Docker\"],
      \"education\": [
        {
          \"school\": \"State University\",
          \"degree\": \"BS Computer Science\",
          \"year\": \"2018\"
        }
      ]
    },
    \"template\": \"modern\"
  }" \
  --output resume-from-url.pdf

echo -e "\n✅ Resume saved to resume-from-url.pdf"


