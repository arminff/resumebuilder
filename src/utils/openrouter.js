import axios from 'axios';

const OPENROUTER_API = 'https://openrouter.ai/api/v1/chat/completions';

export async function generateResumeContent({ jobDescription, userProfile, model, systemPrompt }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY missing');

  const selectedModel = model || process.env.OPENROUTER_MODEL || 'openai/gpt-4o';

  const systemPromptText = systemPrompt || `You are an expert resume writer that crafts comprehensive, detailed, ATS-friendly resume content tailored to job descriptions. Your goal is to create substantial content that fills resume pages with rich, detailed information.

CRITICAL REQUIREMENTS:
- Professional Summary: Write a comprehensive 4-6 sentence professional summary in FIRST PERSON tone (use "I", "my", "me") that highlights key skills, experience level, and career achievements. Examples: "I am a...", "I have...", "My experience includes...", "I specialize in..."
- Each Experience Entry: MUST include 5-7 detailed bullet points (minimum 5, aim for 6-7)
- Bullet Points: Each bullet should be substantial (15-30 words), include quantifiable metrics, technologies used, and impact achieved
- Skills: List 10-15 relevant technical and soft skills from the job description
- Education: Include full details with relevant coursework or achievements if applicable

Return a JSON object with this structure:
{
  "summary": "A comprehensive 3-5 sentence professional summary in FIRST PERSON (use 'I', 'my', 'me') highlighting experience, skills, and achievements. Example: 'I am a...', 'I have...', 'My experience includes...'",
  "experiences": [
    {
      "title": "Job title",
      "company": "Company name",
      "startDate": "YYYY-MM",
      "endDate": "YYYY-MM or 'Present'",
      "responsibilities": [
        "Detailed bullet point 1 with metrics and technologies (15-30 words)",
        "Detailed bullet point 2 with quantifiable achievements",
        "Detailed bullet point 3 showing impact and results",
        "Detailed bullet point 4 with specific technologies/tools",
        "Detailed bullet point 5 demonstrating leadership/collaboration",
        "Detailed bullet point 6 (if applicable)",
        "Detailed bullet point 7 (if applicable)"
      ]
    }
  ],
  "skills": ["Skill 1", "Skill 2", "Skill 3", ... (10-15 skills)],
  "education": [
    {
      "school": "Institution name",
      "degree": "Degree name",
      "year": "Graduation year"
    }
  ]
}

CONTENT GENERATION RULES:
1. If user provides minimal experience data, expand it significantly with relevant details based on the job description
2. If user provides existing bullets, enhance and expand each bullet with more detail, metrics, and context
3. Generate additional relevant experience bullets if needed to reach 5-7 per role
4. Use specific technologies, tools, and methodologies mentioned in the job description
5. Include quantifiable achievements (percentages, numbers, scale, time saved, revenue impact, etc.)
6. Make content comprehensive and detailed - aim to fill resume pages with substantial information
7. Match keywords from the job description throughout the resume

Return ONLY valid JSON, no markdown.`;

  const messages = [
    { role: 'system', content: systemPromptText },
    { role: 'user', content: `Job Description: ${jobDescription}\n\nUser Profile: ${JSON.stringify(userProfile)}\n\nGenerate a comprehensive, detailed resume that:
1. Creates a 4-6 sentence professional summary written in FIRST PERSON tone (use "I", "my", "me"). Examples: "I am a...", "I have...", "My experience includes...", "I specialize in..."
2. Expands each experience entry to 5-7 detailed bullet points (minimum 5)
3. Enhances user-provided bullets with more detail, metrics, and context
4. Generates additional relevant bullets if user data is minimal
5. Lists 10-15 relevant skills matching the job description
6. Fills resume pages with substantial, detailed content
7. Uses specific keywords and technologies from the job description
8. Includes quantifiable achievements and impact metrics

CRITICAL: The professional summary MUST be written in first person tone using "I", "my", "me" throughout. Ensure the resume is comprehensive and detailed enough to fill multiple pages with rich content.` }
  ];

  const response = await axios.post(
    OPENROUTER_API,
    { model: selectedModel, messages, temperature: 0.3, response_format: { type: 'json_object' } },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://localhost',
        'Content-Type': 'application/json'
      }
    }
  );

  const text = response?.data?.choices?.[0]?.message?.content ?? '{}';
  return JSON.parse(text);
}


