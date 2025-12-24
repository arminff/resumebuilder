import axios from 'axios';

const OPENROUTER_API = 'https://openrouter.ai/api/v1/chat/completions';

// Simple content targets per page count (density is handled by CSS, not AI)
const PAGE_CONTENT_TARGETS = {
  '1': { bulletsPerJob: 4, skillsCount: 15, summarySentences: 3 },
  '2': { bulletsPerJob: 6, skillsCount: 25, summarySentences: 5 },
  '3': { bulletsPerJob: 8, skillsCount: 35, summarySentences: 6 }
};

export async function generateResumeContent({ jobDescription, userProfile, model, pages = '1' }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY missing');

  const selectedModel = model || process.env.OPENROUTER_MODEL || 'openai/gpt-4o';
  const targets = PAGE_CONTENT_TARGETS[pages] || PAGE_CONTENT_TARGETS['1'];
  
  console.log(`🤖 Generating ${pages}-page resume content...`);

  const systemPrompt = `You are an expert resume writer. Generate a tailored ${pages}-page resume.

⚠️ CRITICAL: This MUST fill ${pages} FULL page(s) with content. Generate EXTENSIVE content.

CONTENT REQUIREMENTS:
- Summary: ${targets.summarySentences} sentences, first-person, tailored to job
- Experience: ${targets.bulletsPerJob} bullets per job, each with detailed metrics and context
- Skills: ${targets.skillsCount}+ skills prioritizing job-relevant ones
- ALWAYS include ALL user-provided sections: education, projects, certifications, awards, languages, publications
- If user provides projects, certifications, awards, languages, or publications, you MUST include them in your response
- For ${pages}-page resumes: Generate MORE content - expand descriptions, add more bullets, include all available sections

TAILORING:
- Match keywords from job description
- Use action verbs and quantify achievements
- Prioritize relevant experience

Return JSON:
{
  "summary": "Professional summary...",
  "experiences": [{"title": "", "company": "", "location": "", "startDate": "", "endDate": "", "responsibilities": ["..."]}],
  "skills": ["..."],
  "education": [{"school": "", "degree": "", "year": "", "coursework": ["..."]}],
  "projects": [{"name": "", "description": ["..."], "technologies": ["..."]}],
  "certifications": [{"name": "", "issuer": "", "date": ""}],
  "awards": [{"name": "", "issuer": "", "date": "", "description": ""}],
  "languages": [{"language": "", "proficiency": ""}],
  "publications": [{"title": "", "publisher": "", "date": ""}]
}

Return ONLY valid JSON.`;

  const userMessage = `JOB DESCRIPTION:
${jobDescription}

USER PROFILE:
Name: ${userProfile.fullName}
Email: ${userProfile.email}
${userProfile.phone ? `Phone: ${userProfile.phone}` : ''}
${userProfile.location ? `Location: ${userProfile.location}` : ''}
${userProfile.website ? `Website: ${userProfile.website}` : ''}

${userProfile.objective || userProfile.summary ? `Objective: ${userProfile.objective || userProfile.summary}` : ''}

${(userProfile.experiences || []).length > 0 ? `Experience:
${(userProfile.experiences || []).map(exp => `- ${exp.title} at ${exp.company}${exp.bullets?.length ? `: ${exp.bullets.join(' | ')}` : ''}`).join('\n')}` : ''}

${(userProfile.skills || []).length > 0 ? `Skills: ${(userProfile.skills || []).join(', ')}` : ''}

${(userProfile.education || []).length > 0 ? `Education:
${(userProfile.education || []).map(edu => `- ${edu.degree} from ${edu.school} (${edu.year})${edu.relevantCoursework ? ` - Coursework: ${Array.isArray(edu.relevantCoursework) ? edu.relevantCoursework.join(', ') : edu.relevantCoursework}` : ''}`).join('\n')}` : ''}

${(userProfile.projects || []).length > 0 ? `Projects:
${(userProfile.projects || []).map(proj => `- ${proj.name}: ${Array.isArray(proj.description) ? proj.description.join('. ') : proj.description || ''} (${(proj.skills || []).join(', ')})`).join('\n')}` : ''}

${(userProfile.certifications || []).length > 0 ? `Certifications:
${(userProfile.certifications || []).map(cert => `- ${cert.name}${cert.issuer ? ` from ${cert.issuer}` : ''}${cert.date ? ` (${cert.date})` : ''}`).join('\n')}` : ''}

${(userProfile.awards || []).length > 0 ? `Awards:
${(userProfile.awards || []).map(award => `- ${award.name}${award.issuer ? ` from ${award.issuer}` : ''}${award.date ? ` (${award.date})` : ''}`).join('\n')}` : ''}

${(userProfile.languages || []).length > 0 ? `Languages:
${(userProfile.languages || []).map(lang => `- ${lang.language}${lang.proficiency ? ` (${lang.proficiency})` : ''}`).join('\n')}` : ''}

${(userProfile.publications || []).length > 0 ? `Publications:
${(userProfile.publications || []).map(pub => `- ${pub.title}${pub.publisher ? ` in ${pub.publisher}` : ''}${pub.date ? ` (${pub.date})` : ''}`).join('\n')}` : ''}

Generate a ${pages}-page resume tailored to this job. INCLUDE ALL user-provided sections (projects, certifications, awards, languages, publications) in your response.`;

  const response = await axios.post(
    OPENROUTER_API,
    { model: selectedModel, messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ], temperature: 0.3, response_format: { type: 'json_object' } },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://localhost',
        'Content-Type': 'application/json'
      }
    }
  );

  const text = response?.data?.choices?.[0]?.message?.content ?? '{}';
  const aiContent = JSON.parse(text);
  
  // Also merge user's experiences website field if not in AI response
  const mergedExperiences = (aiContent.experiences || []).map((aiExp, idx) => {
    const userExp = (userProfile.experiences || [])[idx];
    return {
      ...aiExp,
      website: aiExp.website || (userExp?.website)
    };
  });
  
  // Return AI content with merged experiences
  // Projects will be merged in resume.js to avoid duplicates
  const mergedContent = {
    ...aiContent,
    experiences: mergedExperiences,
    // Include user's certifications, awards, languages, publications if provided
    certifications: (userProfile.certifications || []).length > 0 
      ? userProfile.certifications 
      : (aiContent.certifications || []),
    awards: (userProfile.awards || []).length > 0 
      ? userProfile.awards 
      : (aiContent.awards || []),
    languages: (userProfile.languages || []).length > 0 
      ? userProfile.languages 
      : (aiContent.languages || []),
    publications: (userProfile.publications || []).length > 0 
      ? userProfile.publications 
      : (aiContent.publications || [])
  };
  
  console.log(`✅ Content generated - Projects: ${mergedContent.projects?.length || 0}, Experiences: ${mergedContent.experiences?.length || 0}`);
  return mergedContent;
}
