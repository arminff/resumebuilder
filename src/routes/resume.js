import { Router } from 'express';
import { generateSchema } from '../utils/schemas.js';
import { generateResumeContent } from '../utils/openrouter.js';
import { renderResumeLatex, compileLatexToPdf } from '../utils/latex.js';
import { scrapeDynamic, scrapeStatic } from '../utils/scrape.js';
import { canGenerateResume, recordResumeGeneration } from '../utils/supabase.js';

export const resumeRouter = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeText(text) {
  if (!text) return '';
  return String(text).replace(/\s+/g, ' ').trim();
}

function normalizeContent(content) {
  return {
    ...content,
    summary: content.summary ? normalizeText(content.summary) : '',
    experiences: safe(content.experiences || content.experience).map((exp) => ({
      ...exp,
      title: normalizeText(exp.title),
      company: normalizeText(exp.company || exp.companyName),
      companyName: normalizeText(exp.companyName || exp.company),
      location: normalizeText(exp.location),
      responsibilities: safe(exp.responsibilities || exp.bullets).map((b) => normalizeText(String(b))).filter(Boolean),
      bullets: safe(exp.responsibilities || exp.bullets).map((b) => normalizeText(String(b))).filter(Boolean),
    })),
    skills: safe(content.skills).map((s) => normalizeText(String(s))).filter(Boolean),
    skillCategories: content.skillCategories || null,
    education: safe(content.education).map((edu) => ({
      ...edu,
      school: normalizeText(edu.school || edu.institution),
      institution: normalizeText(edu.institution || edu.school),
      degree: normalizeText(edu.degree),
      field: normalizeText(edu.field),
      coursework: Array.isArray(edu.coursework || edu.relevantCoursework)
        ? safe(edu.coursework || edu.relevantCoursework).map((c) => normalizeText(String(c))).filter(Boolean)
        : (edu.coursework || edu.relevantCoursework)
          ? [normalizeText(String(edu.coursework || edu.relevantCoursework))]
          : [],
    })),
    projects: safe(content.projects).map((proj) => ({
      ...proj,
      name: normalizeText(proj.name),
      description: Array.isArray(proj.description)
        ? proj.description.map((d) => normalizeText(String(d))).filter(Boolean)
        : proj.description
          ? [normalizeText(String(proj.description))]
          : [],
      technologies: safe(proj.technologies || proj.skills).map((t) => normalizeText(String(t))).filter(Boolean),
    })),
  };
}

function normalizeUserProfile(profile) {
  return {
    ...profile,
    summary: profile.summary || profile.objective || '',
    experiences: safe(profile.experiences).map((exp) => ({
      ...exp,
      website: exp.website || undefined,
      bullets: exp.bullets || [],
    })),
    education: safe(profile.education).map((edu) => ({
      ...edu,
      coursework: Array.isArray(edu.relevantCoursework || edu.coursework)
        ? safe(edu.relevantCoursework || edu.coursework)
        : (edu.relevantCoursework || edu.coursework)
          ? [edu.relevantCoursework || edu.coursework]
          : [],
    })),
    projects: safe(profile.projects).map((proj) => ({
      ...proj,
      description: Array.isArray(proj.description) ? proj.description : proj.description ? [proj.description] : [],
      technologies: proj.skills || proj.technologies || [],
    })),
  };
}

const safe = (x) => (Array.isArray(x) ? x : x ? [x] : []).filter(Boolean);

// ---------------------------------------------------------------------------
// Shared: resolve job description from URL or direct text
// ---------------------------------------------------------------------------

async function resolveJobDescription({ jobUrl, jobDescription }) {
  if (jobDescription) return jobDescription;
  if (!jobUrl) throw Object.assign(new Error('Either jobUrl or jobDescription required'), { statusCode: 400 });

  console.log(`🔍 Scraping: ${jobUrl}`);
  try {
    const scraped = await scrapeDynamic(jobUrl);
    const text = scraped.jobDescription || scraped.text;
    console.log(`✅ Scraped ${text.length} chars`);
    return text;
  } catch (err) {
    console.warn('⚠️ Dynamic scrape failed:', err.message);
    try {
      const scraped = await scrapeStatic(jobUrl);
      return scraped.jobDescription || scraped.text;
    } catch (staticErr) {
      throw new Error(`Scrape failed: ${staticErr.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Shared: merge user projects with AI-generated projects
// ---------------------------------------------------------------------------

function mergeProjects(normalizedContent, normalizedProfile) {
  const userProjects = safe(normalizedProfile.projects).map((p) => ({
    name: p.name,
    skills: p.skills || [],
    technologies: p.skills || [],
    date: p.date,
    description: Array.isArray(p.description) ? p.description : p.description ? [p.description] : [],
  }));

  const aiProjects = safe(normalizedContent.projects)
    .map((p) => ({ ...p, technologies: p.technologies || p.skills || [] }))
    .filter((p) => p.name);

  const merged = [...userProjects];
  const seen = new Set(userProjects.map((p) => p.name?.toLowerCase()).filter(Boolean));

  for (const ai of aiProjects) {
    if (ai.name && !seen.has(ai.name.toLowerCase())) {
      merged.push(ai);
    }
  }

  normalizedContent.projects = merged;
}

// ---------------------------------------------------------------------------
// Shared: full pipeline  scrape → AI → normalize → LaTeX → PDF
// ---------------------------------------------------------------------------

async function buildResumePdf({ jobUrl, jobDescription, userProfile, model, template, pages }) {
  const targetPages = pages || '1';
  const templateName = template || 'modern';
  const normalizedProfile = normalizeUserProfile(userProfile);

  // 1. Resolve job description
  const finalJobDescription = await resolveJobDescription({ jobUrl, jobDescription });
  if (!finalJobDescription || finalJobDescription.length < 30) {
    throw Object.assign(new Error('Job description too short'), { statusCode: 400 });
  }

  // 2. AI content
  console.log(`🤖 Generating ${targetPages}-page resume…`);
  const content = await generateResumeContent({
    jobDescription: finalJobDescription,
    userProfile: normalizedProfile,
    model,
    pages: targetPages,
  });

  // 3. Normalize + merge
  const normalizedContent = normalizeContent(content);
  mergeProjects(normalizedContent, normalizedProfile);

  const preparedContent = {
    ...normalizedContent,
    email: normalizedProfile.email ? normalizeText(normalizedProfile.email) : undefined,
    phone: normalizedProfile.phone ? normalizeText(normalizedProfile.phone) : undefined,
    location: normalizedProfile.location ? normalizeText(normalizedProfile.location) : undefined,
    linkedin: normalizedProfile.linkedin ? normalizeText(normalizedProfile.linkedin) : undefined,
    website: normalizedProfile.website ? normalizeText(normalizedProfile.website) : undefined,
  };

  console.log(
    `📋 Content: ${preparedContent.experiences?.length || 0} experiences, ` +
      `${preparedContent.projects?.length || 0} projects, ` +
      `${preparedContent.skills?.length || 0} skills`,
  );

  // 4. Render LaTeX
  const latex = renderResumeLatex(normalizeText(normalizedProfile.fullName), preparedContent, templateName, targetPages);

  // 5. Compile → PDF
  console.log('📄 Compiling LaTeX → PDF…');
  const { buffer, actualPages } = await compileLatexToPdf(latex);
  console.log(`✅ Done: ${actualPages} page(s)`);

  return { buffer, actualPages, targetPages, content: normalizedContent };
}

// ---------------------------------------------------------------------------
// Shared: send a PDF response (used by /build and /view)
// ---------------------------------------------------------------------------

async function handlePdfRequest(req, res, disposition) {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const userId = req.user?.id;

  // Usage-limit check
  if (userId) {
    const check = await canGenerateResume(userId);
    if (!check.allowed) {
      return res.status(429).json({
        error: 'Resume generation limit exceeded',
        message: check.error || 'Monthly limit reached',
        used: check.used,
        limit: check.limit,
        remaining: check.remaining,
      });
    }
  }

  try {
    const { buffer, actualPages, targetPages } = await buildResumePdf(parsed.data);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${disposition}; filename="resume.pdf"`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('X-Actual-Pages', String(actualPages));
    res.setHeader('X-Target-Pages', targetPages);

    // Record usage
    if (userId) {
      const { error } = await recordResumeGeneration(userId);
      if (error) console.error('⚠️ Usage record failed:', error);
    }

    res.end(buffer, 'binary');
  } catch (err) {
    console.error('❌ PDF error:', err);
    if (!res.headersSent) {
      return res.status(err.statusCode || 500).json({ error: err?.message || 'PDF generation failed' });
    }
  }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/** POST /generate — AI content only (JSON, no PDF) */
resumeRouter.post('/generate', async (req, res) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { jobDescription, jobUrl, userProfile, model, pages } = parsed.data;
  const targetPages = pages || '1';

  try {
    const finalJobDescription = await resolveJobDescription({ jobUrl, jobDescription });
    if (!finalJobDescription || finalJobDescription.length < 30) {
      return res.status(400).json({ error: 'Job description too short' });
    }

    const content = await generateResumeContent({
      jobDescription: finalJobDescription,
      userProfile: normalizeUserProfile(userProfile),
      model,
      pages: targetPages,
    });

    return res.json({ content, targetPages });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err?.message || 'Generation failed' });
  }
});

/** POST /build — Full pipeline → PDF download */
resumeRouter.post('/build', (req, res) => handlePdfRequest(req, res, 'attachment'));

/** POST /view — Full pipeline → PDF inline (browser preview) */
resumeRouter.post('/view', (req, res) => handlePdfRequest(req, res, 'inline'));

/** POST /preview — AI content only (for frontend preview / debugging) */
resumeRouter.post('/preview', async (req, res) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { jobDescription, jobUrl, userProfile, model, pages } = parsed.data;
  const targetPages = pages || '1';
  const normalizedProfile = normalizeUserProfile(userProfile);

  try {
    const finalJobDescription = await resolveJobDescription({ jobUrl, jobDescription });
    if (!finalJobDescription || finalJobDescription.length < 30) {
      return res.status(400).json({ error: 'Job description too short' });
    }

    const content = await generateResumeContent({
      jobDescription: finalJobDescription,
      userProfile: normalizedProfile,
      model,
      pages: targetPages,
    });

    return res.json({ content: normalizeContent(content) });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err?.message || 'Preview failed' });
  }
});
