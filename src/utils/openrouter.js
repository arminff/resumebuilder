import axios from 'axios';

const OPENROUTER_API = 'https://openrouter.ai/api/v1/chat/completions';

// ---------------------------------------------------------------------------
// Adaptive content budget: estimates LaTeX line costs per section, then
// distributes the remaining line budget as bullet counts so the resume
// fills exactly the requested page count with no overflow or whitespace.
// ---------------------------------------------------------------------------

const LINES_PER_PAGE = 50;
const LINE_COSTS = {
  header: 4,
  summarySection: 5,
  skillCategoryRow: 1.5,
  skillSectionHeader: 2,
  expSubheading: 3,
  expBullet: 1.3,
  projSubheading: 3,
  projBullet: 1.3,
  eduEntry: 3,
  sectionHeader: 2,
  miscItem: 1.2,
};

function computeContentBudget(userProfile, pages) {
  const totalPages = Number(pages) || 1;
  const totalLines = totalPages * LINES_PER_PAGE;

  const numExp = (userProfile.experiences || []).length || 1;
  const numProj = (userProfile.projects || []).length;
  const numEdu = (userProfile.education || []).length || 1;
  const numCerts = (userProfile.certifications || []).length;
  const numAwards = (userProfile.awards || []).length;
  const numLangs = (userProfile.languages || []).length;
  const numPubs = (userProfile.publications || []).length;

  const skillCategories = Math.min(3 + totalPages, 6);
  const summarySentences = totalPages === 1 ? 3 : totalPages === 2 ? 4 : 5;
  const skillsCount = totalPages === 1 ? 15 : totalPages === 2 ? 25 : 35;

  let fixedCost = LINE_COSTS.header
    + LINE_COSTS.summarySection
    + LINE_COSTS.skillSectionHeader + skillCategories * LINE_COSTS.skillCategoryRow
    + LINE_COSTS.sectionHeader + numEdu * LINE_COSTS.eduEntry;

  if (numCerts > 0) fixedCost += LINE_COSTS.sectionHeader + numCerts * LINE_COSTS.miscItem;
  if (numAwards > 0) fixedCost += LINE_COSTS.sectionHeader + numAwards * LINE_COSTS.miscItem;
  if (numLangs > 0) fixedCost += LINE_COSTS.sectionHeader + Math.ceil(numLangs / 3) * LINE_COSTS.miscItem;
  if (numPubs > 0) fixedCost += LINE_COSTS.sectionHeader + numPubs * LINE_COSTS.miscItem;

  const expOverhead = LINE_COSTS.sectionHeader + numExp * LINE_COSTS.expSubheading;
  const projOverhead = numProj > 0 ? LINE_COSTS.sectionHeader + numProj * LINE_COSTS.projSubheading : 0;

  const bulletLines = Math.max(totalLines - fixedCost - expOverhead - projOverhead, 8);
  const totalBulletSlots = Math.floor(bulletLines / LINE_COSTS.expBullet);

  let expBulletSlots, projBulletSlots;
  if (numProj > 0) {
    const expShare = numExp / (numExp + numProj * 0.6);
    expBulletSlots = Math.round(totalBulletSlots * expShare);
    projBulletSlots = totalBulletSlots - expBulletSlots;
  } else {
    expBulletSlots = totalBulletSlots;
    projBulletSlots = 0;
  }

  const bulletsPerJob = Math.max(2, Math.min(Math.round(expBulletSlots / numExp), 8));
  const bulletsPerProject = numProj > 0
    ? Math.max(1, Math.min(Math.round(projBulletSlots / numProj), 4))
    : 0;

  return {
    bulletsPerJob,
    bulletsPerProject,
    totalExpBullets: expBulletSlots,
    totalProjBullets: projBulletSlots,
    skillsCount,
    summarySentences,
    skillCategories,
    numExp,
    numProj,
  };
}

// ---------------------------------------------------------------------------
// Helpers: serialize user profile sections into a detailed text block
// ---------------------------------------------------------------------------

function formatExperiences(experiences) {
  if (!experiences?.length) return '';
  const lines = experiences.map(exp => {
    const parts = [`  Title: ${exp.title}`];
    if (exp.company) parts.push(`  Company: ${exp.company}`);
    if (exp.location) parts.push(`  Location: ${exp.location}`);
    if (exp.startDate || exp.endDate) parts.push(`  Dates: ${exp.startDate || '?'} – ${exp.endDate || 'Present'}`);
    const techs = exp.technologies || exp.skills || [];
    if (techs.length) parts.push(`  Technologies: ${techs.join(', ')}`);
    if (exp.bullets?.length) parts.push(`  Accomplishments:\n${exp.bullets.map(b => `    • ${b}`).join('\n')}`);
    return parts.join('\n');
  });
  return `EXPERIENCE:\n${lines.join('\n---\n')}\n`;
}

function formatEducation(education) {
  if (!education?.length) return '';
  const lines = education.map(edu => {
    const parts = [`  School: ${edu.school}`];
    if (edu.degree) parts.push(`  Degree: ${edu.degree}`);
    if (edu.field) parts.push(`  Field: ${edu.field}`);
    if (edu.year) parts.push(`  Year: ${edu.year}`);
    if (edu.gpa) parts.push(`  GPA: ${edu.gpa}`);
    const cw = Array.isArray(edu.relevantCoursework || edu.coursework)
      ? (edu.relevantCoursework || edu.coursework)
      : (edu.relevantCoursework || edu.coursework) ? [edu.relevantCoursework || edu.coursework] : [];
    if (cw.length) parts.push(`  Coursework: ${cw.join(', ')}`);
    return parts.join('\n');
  });
  return `EDUCATION:\n${lines.join('\n---\n')}\n`;
}

function formatProjects(projects) {
  if (!projects?.length) return '';
  const lines = projects.map(proj => {
    const parts = [`  Name: ${proj.name}`];
    if (proj.date) parts.push(`  Date: ${proj.date}`);
    const techs = proj.technologies || proj.skills || [];
    if (techs.length) parts.push(`  Technologies: ${techs.join(', ')}`);
    const desc = Array.isArray(proj.description) ? proj.description : proj.description ? [proj.description] : [];
    if (desc.length) parts.push(`  Description:\n${desc.map(d => `    • ${d}`).join('\n')}`);
    return parts.join('\n');
  });
  return `PROJECTS:\n${lines.join('\n---\n')}\n`;
}

function formatSimpleList(label, items, formatter) {
  if (!items?.length) return '';
  return `${label}:\n${items.map(i => `  - ${formatter(i)}`).join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// Build the system prompt with two-phase JD analysis + resume generation
// ---------------------------------------------------------------------------

function buildSystemPrompt(pages, budget) {
  const projSection = budget.numProj > 0
    ? `- Projects: ${budget.numProj} project(s) × ~${budget.bulletsPerProject} bullets each = ~${budget.totalProjBullets} total project bullets`
    : '- Projects: none provided — skip this section';

  return `You are a senior professional resume writer with deep expertise in ATS optimization and hiring-manager psychology. Your task is to generate a highly tailored resume.

═══════════════════════════════════════════════════
PHASE 1 — JOB DESCRIPTION ANALYSIS (internal only)
═══════════════════════════════════════════════════
Before writing anything, mentally analyze the job description to identify:
  (a) Target job title and seniority level
  (b) Required hard skills and technologies (exact terms)
  (c) Preferred/nice-to-have skills
  (d) Key responsibilities and action verbs used
  (e) Industry-specific terminology and buzzwords
  (f) Soft skills or cultural values emphasized
Keep this analysis internal — do NOT include it in your JSON output. Use it to guide every section below.

═══════════════════════════════════════════════════
PHASE 2 — RESUME GENERATION
═══════════════════════════════════════════════════

PAGE COUNT: Exactly ${pages} page(s). This is non-negotiable.

ADAPTIVE CONTENT BUDGET (computed from the candidate's profile):
The numbers below are calibrated to fill exactly ${pages} page(s) in the LaTeX template.
Follow them closely — going over causes overflow, going under leaves blank space.
- Summary: ${budget.summarySentences} sentences
- Experience: ${budget.numExp} job(s) × ~${budget.bulletsPerJob} bullets each = ~${budget.totalExpBullets} total experience bullets
  → Give MORE bullets (up to ${Math.min(budget.bulletsPerJob + 2, 8)}) to JD-relevant roles, FEWER (down to ${Math.max(budget.bulletsPerJob - 2, 2)}) to older/less relevant ones
${projSection}
- Skills: ~${budget.skillsCount} skills across ~${budget.skillCategories} categories
- Education, certs, awards, languages, publications: include as provided (fixed size)

CRITICAL FILL RULE: The resume MUST use all ${pages} page(s) with no large blank areas.
If you have spare budget, expand the most relevant experience bullets or add detail to projects.
If content is tight, trim the least relevant older role bullets first.

PROFESSIONAL SUMMARY:
- ${budget.summarySentences} sentences, written in first person (no "I" — implied subject)
- First sentence: state years of experience + core role identity, mirroring the JD's title
- Include 3–4 of the JD's top required skills/technologies by exact name
- End with a value proposition tied to the JD's primary business goal

EXPERIENCE BULLETS — XYZ FORMAT:
Each bullet MUST follow: "Accomplished [X] as measured by [Y] by doing [Z]"
- Start every bullet with a strong past-tense action verb (Engineered, Orchestrated, Spearheaded, Optimized, Architected, Reduced, Accelerated, etc.)
- At least 60% of bullets must contain a quantified metric (%, $, time, users, throughput, uptime, etc.)
- If the user provided specific metrics, preserve them exactly
- If the user's bullet lacks metrics, add plausible professional context (e.g., "serving 10K+ users", "across 5 microservices") — but NEVER invent false numbers
- Each bullet should map to a JD requirement where possible
- Vary what bullets demonstrate: technical depth, leadership, cross-team collaboration, business impact
- Preserve the user's original startDate, endDate, location, and company — do NOT change these factual fields
- Include the technologies/tools used in each role in the "technologies" array, prioritizing JD-relevant ones

SKILLS & SKILL CATEGORIES:
- Return BOTH "skills" (flat array) and "skillCategories" (grouped object)
- The first category in skillCategories MUST match the JD's primary technology domain (e.g., "Frontend Development" if the JD is for a React role, "Cloud & Infrastructure" if DevOps)
- Within each category, list JD-matched skills first
- Include all skills the user listed, supplemented with JD-relevant skills the user likely has given their experience
- Do NOT add skills the user clearly doesn't have based on their profile

EDUCATION:
- Preserve all factual data (school, degree, field, year, GPA) exactly as provided
- Include relevant coursework if provided, prioritizing JD-relevant courses

PROJECTS:
- Rewrite descriptions as impact-driven bullets using the same XYZ approach
- Highlight technologies that overlap with JD requirements
- If user provided projects, enhance them — do not drop any

ATS KEYWORD OPTIMIZATION:
- Use exact keywords and phrases from the JD (e.g., if JD says "CI/CD pipelines", write "CI/CD pipelines" not "continuous integration")
- Mirror the JD's terminology for tools, frameworks, and methodologies
- Include both acronyms and full forms where natural (e.g., "Amazon Web Services (AWS)")

SECTIONS TO INCLUDE:
- ALWAYS include: summary, experiences, skills, skillCategories, education
- Include IF user provided them: projects, certifications, awards, languages, publications
- If user provided a section, you MUST return it — never silently drop sections

OUTPUT — Return ONLY this JSON (no markdown, no explanation):
{
  "summary": "...",
  "experiences": [{"title": "", "company": "", "location": "", "startDate": "", "endDate": "", "responsibilities": ["XYZ-format bullets..."], "technologies": ["..."]}],
  "skills": ["..."],
  "skillCategories": {"PrimaryDomain": ["skill1", "skill2"], "SecondaryDomain": ["..."]},
  "education": [{"school": "", "degree": "", "field": "", "year": "", "gpa": "", "coursework": ["..."]}],
  "projects": [{"name": "", "description": ["impact-driven bullets..."], "technologies": ["..."], "date": ""}],
  "certifications": [{"name": "", "issuer": "", "date": ""}],
  "awards": [{"name": "", "issuer": "", "date": "", "description": ""}],
  "languages": [{"language": "", "proficiency": ""}],
  "publications": [{"title": "", "publisher": "", "date": ""}]
}`;
}

// ---------------------------------------------------------------------------
// Build user message with complete profile data
// ---------------------------------------------------------------------------

function buildUserMessage(jobDescription, userProfile, pages) {
  const sections = [
    `═══ JOB DESCRIPTION ═══\n${jobDescription}`,
    `\n═══ CANDIDATE PROFILE ═══`,
    `Name: ${userProfile.fullName}`,
    `Email: ${userProfile.email}`,
  ];

  if (userProfile.phone) sections.push(`Phone: ${userProfile.phone}`);
  if (userProfile.location) sections.push(`Location: ${userProfile.location}`);
  if (userProfile.website) sections.push(`Website: ${userProfile.website}`);
  if (userProfile.linkedin) sections.push(`LinkedIn: ${userProfile.linkedin}`);

  const summary = userProfile.objective || userProfile.summary;
  if (summary) sections.push(`\nCAREER OBJECTIVE:\n${summary}`);

  sections.push('');
  sections.push(formatExperiences(userProfile.experiences));
  sections.push(formatEducation(userProfile.education));

  if (userProfile.skills?.length) {
    sections.push(`SKILLS: ${userProfile.skills.join(', ')}`);
  }

  sections.push(formatProjects(userProfile.projects));

  sections.push(formatSimpleList('CERTIFICATIONS', userProfile.certifications,
    c => `${c.name}${c.issuer ? ` — ${c.issuer}` : ''}${c.date ? ` (${c.date})` : ''}`));
  sections.push(formatSimpleList('AWARDS', userProfile.awards,
    a => `${a.name}${a.issuer ? ` — ${a.issuer}` : ''}${a.date ? ` (${a.date})` : ''}`));
  sections.push(formatSimpleList('LANGUAGES', userProfile.languages,
    l => `${l.language}${l.proficiency ? ` (${l.proficiency})` : ''}`));
  sections.push(formatSimpleList('PUBLICATIONS', userProfile.publications,
    p => `${p.title}${p.publisher ? ` in ${p.publisher}` : ''}${p.date ? ` (${p.date})` : ''}`));

  sections.push(`\n═══ INSTRUCTIONS ═══
Generate a ${pages}-page resume that is deeply tailored to the job description above.
Preserve all factual data (dates, companies, schools, GPAs) exactly as provided.
Rewrite bullets for maximum impact using the XYZ format.
Prioritize JD-relevant skills and experiences.
Include ALL sections the candidate provided — do not drop any.
Return ONLY valid JSON.`);

  return sections.filter(Boolean).join('\n');
}

export async function generateResumeContent({ jobDescription, userProfile, model, pages = '1' }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY missing');

  const selectedModel = model || process.env.OPENROUTER_MODEL || 'openai/gpt-4o';
  const budget = computeContentBudget(userProfile, pages);
  
  console.log(`🤖 Generating ${pages}-page resume (budget: ${budget.totalExpBullets} exp bullets across ${budget.numExp} jobs, ${budget.totalProjBullets} proj bullets across ${budget.numProj} projects)...`);

  const systemPrompt = buildSystemPrompt(pages, budget);
  const userMessage = buildUserMessage(jobDescription, userProfile, pages);

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

// ---------------------------------------------------------------------------
// Generate or improve bullet points for experience/project (resume portal)
// ---------------------------------------------------------------------------

function parseBulletsResponse(text) {
  const raw = (text || '').trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const jsonStr = jsonMatch ? jsonMatch[0] : raw;
  const parsed = JSON.parse(jsonStr);
  const bullets = Array.isArray(parsed?.bullets) ? parsed.bullets : [];
  return bullets.filter((b) => typeof b === 'string' && b.trim());
}

export async function generateBullets({ type, context = {}, existingBullets = [], model }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY missing');

  const isImprove = Array.isArray(existingBullets) && existingBullets.length > 0;
  const selectedModel = model || process.env.OPENROUTER_MODEL || 'openai/gpt-4o';

  const systemPrompt =
    type === 'experience'
      ? `You are a senior resume writer. Your task is to ${isImprove ? 'improve/rewrite' : 'generate'} resume bullet points for a job experience.
Each bullet MUST use the XYZ format: "Accomplished [X] as measured by [Y] by doing [Z]".
Use strong past-tense action verbs (Engineered, Led, Optimized, Reduced, etc.). Include quantified metrics (%, $, time, users) where plausible.
Return ONLY a JSON object with a single key "bullets" whose value is an array of strings. No markdown, no explanation. Example: {"bullets": ["First bullet.", "Second bullet."]}`
      : `You are a senior resume writer. Your task is to ${isImprove ? 'improve/rewrite' : 'generate'} resume bullet points for a project.
Each bullet should be impact-driven, mention technologies where relevant, and use strong action verbs. Include metrics if plausible.
Return ONLY a JSON object with a single key "bullets" whose value is an array of strings. No markdown, no explanation. Example: {"bullets": ["First bullet.", "Second bullet."]}`;

  const contextParts = [];
  if (type === 'experience') {
    if (context.title) contextParts.push(`Job title: ${context.title}`);
    if (context.company) contextParts.push(`Company: ${context.company}`);
  } else {
    if (context.name) contextParts.push(`Project name: ${context.name}`);
    if (context.skills?.length) contextParts.push(`Technologies/skills: ${context.skills.join(', ')}`);
  }
  const contextBlock = contextParts.length ? `Context:\n${contextParts.join('\n')}\n\n` : '';

  const userContent = isImprove
    ? `${contextBlock}Improve these bullet points (keep similar count, make them stronger and more impactful):\n${existingBullets.map((b) => `- ${b}`).join('\n')}`
    : `${contextBlock}Generate 3–5 resume bullet points for this ${type}.`;

  const response = await axios.post(
    OPENROUTER_API,
    {
      model: selectedModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.4,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://localhost',
        'Content-Type': 'application/json',
      },
    }
  );

  const text = response?.data?.choices?.[0]?.message?.content ?? '{}';
  const bullets = parseBulletsResponse(text);
  if (bullets.length === 0) throw new Error('AI did not return valid bullets');
  return { bullets };
}
