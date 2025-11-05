#!/bin/bash

# Quick Start Script - Resume Builder
# Usage: bash quick-start.sh

BASE_URL="http://localhost:4000/api"

# Get token from environment or prompt
if [ -z "$TOKEN" ]; then
  echo "Enter your Supabase access token:"
  read -r TOKEN
fi

# Get job URL
echo "Enter the job posting URL:"
read -r JOB_URL

# Get basic user info
echo "Enter your full name:"
read -r FULL_NAME

echo "Enter your email:"
read -r EMAIL

echo "Enter your phone (optional, press Enter to skip):"
read -r PHONE

echo "Enter your location (optional, press Enter to skip):"
read -r LOCATION

echo ""
echo "🔍 Scraping job posting..."
echo "🤖 Generating tailored resume..."
echo "📄 Creating PDF..."

curl -X POST "$BASE_URL/resume/build" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"jobUrl\": \"$JOB_URL\",
    \"userProfile\": {
      \"fullName\": \"$FULL_NAME\",
      \"email\": \"$EMAIL\",
      \"phone\": \"$PHONE\",
      \"location\": \"$LOCATION\",
      \"experiences\": [],
      \"skills\": [],
      \"education\": []
    },
    \"template\": \"modern\"
  }" \
  --output resume.pdf \
  --progress-bar

if [ -f resume.pdf ] && [ -s resume.pdf ]; then
  echo ""
  echo "✅ Resume generated successfully!"
  echo "📄 Saved as: resume.pdf"
  echo "📊 Size: $(wc -c < resume.pdf | xargs) bytes"
  
  # Try to open on macOS
  if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "Opening resume.pdf..."
    open resume.pdf
  fi
else
  echo ""
  echo "❌ Failed to generate resume. Check server logs for errors."
fi


