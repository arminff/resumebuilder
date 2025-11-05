#!/bin/bash

# Example: Build resume from a job URL
# The system will automatically scrape the job posting and generate a tailored resume

BASE_URL="http://localhost:4000/api"
TOKEN="eyJhbGciOiJIUzI1NiIsImtpZCI6IlhnUjh0aWNSa0h5ZDdsK00iLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3RxbHFydWhieGZ0dXR1dWR4eHluLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiJlMDhjYWEyMS05YmU2LTQ2NWMtOGYwNi0wNTYwYzc4YzZhZGMiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzYyMjA5NTU5LCJpYXQiOjE3NjIyMDU5NTksImVtYWlsIjoiYXJtaW5mbjIwMDRAZ21haWwuY29tIiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCJdfSwidXNlcl9tZXRhZGF0YSI6eyJlbWFpbCI6ImFybWluZm4yMDA0QGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJwaG9uZV92ZXJpZmllZCI6ZmFsc2UsInN1YiI6ImUwOGNhYTIxLTliZTYtNDY1Yy04ZjA2LTA1NjBjNzhjNmFkYyJ9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzYyMjA1OTU5fV0sInNlc3Npb25faWQiOiJiOTYzM2Y3Mi00ZGFjLTRmOGQtYmE2Zi0wYjc5MWE4ZDdjZjgiLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.jzg0G-Mbgw6AyxWeJitg3a2ygBOGr1I94kdgcsqNUOc"

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


