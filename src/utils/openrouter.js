import axios from 'axios';

const OPENROUTER_API = 'https://openrouter.ai/api/v1/chat/completions';

export async function generateResumeContent({ jobDescription, userProfile, model, systemPrompt }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY missing');

  const selectedModel = model || process.env.OPENROUTER_MODEL || 'openai/gpt-4o';

  const systemPromptText = systemPrompt || `You are an expert resume writer that crafts ATS-friendly, professional resume content tailored to job descriptions. 

Return a JSON object with this structure:
{
  "summary": "A compelling 2-3 sentence professional summary",
  "experiences": [
    {
      "title": "Job title",
      "company": "Company name",
      "startDate": "YYYY-MM",
      "endDate": "YYYY-MM or 'Present'",
      "responsibilities": ["Bullet point 1", "Bullet point 2"]
    }
  ],
  "skills": ["Skill 1", "Skill 2"],
  "education": [
    {
      "school": "Institution name",
      "degree": "Degree name",
      "year": "Graduation year"
    }
  ]
}

Focus on quantifiable achievements and relevant keywords from the job description. Keep content professional and concise. Return ONLY valid JSON, no markdown.`;

  const messages = [
    { role: 'system', content: systemPromptText },
    { role: 'user', content: `Job Description: ${jobDescription}\n\nUser Profile: ${JSON.stringify(userProfile)}\n\nGenerate a tailored resume that highlights the user's relevant experience and skills for this position.` }
  ];

  const response = await axios.post(
    OPENROUTER_API,
    { model: selectedModel, messages, temperature: 0.2, response_format: { type: 'json_object' } },
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


