import { Router } from 'express';
import { generateSchema, pdfSchema } from '../utils/schemas.js';
import { generateResumeContent } from '../utils/openrouter.js';
import { htmlToPdfBuffer } from '../utils/puppeteer.js';
import { renderResumeTemplate } from '../utils/templates.js';
import { scrapeDynamic, scrapeStatic } from '../utils/scrape.js';
import { canGenerateResume, recordResumeGeneration } from '../utils/supabase.js';

export const resumeRouter = Router();

const normalizeText = (text) => {
  if (!text) return '';
  return String(text).replace(/\s+/g, ' ').trim();
};

const normalizeContent = (content) => ({
  ...content,
  summary: content.summary ? normalizeText(content.summary) : '',
  experiences: (content.experiences || content.experience || []).map(exp => ({
    ...exp,
    title: exp.title ? normalizeText(exp.title) : exp.title,
    company: exp.company ? normalizeText(exp.company) : exp.company,
    companyName: exp.companyName ? normalizeText(exp.companyName) : exp.companyName,
    location: exp.location ? normalizeText(exp.location) : exp.location,
    responsibilities: (exp.responsibilities || exp.bullets || []).map(b => normalizeText(String(b))).filter(Boolean),
    bullets: (exp.responsibilities || exp.bullets || []).map(b => normalizeText(String(b))).filter(Boolean)
  })),
  skills: (content.skills || []).map(s => normalizeText(String(s))).filter(Boolean),
  skillCategories: content.skillCategories || null,
  education: (content.education || []).map(edu => ({
    ...edu,
    school: edu.school ? normalizeText(String(edu.school)) : edu.school,
    institution: edu.institution ? normalizeText(String(edu.institution)) : edu.institution,
    degree: edu.degree ? normalizeText(String(edu.degree)) : edu.degree,
    field: edu.field ? normalizeText(String(edu.field)) : edu.field,
    coursework: Array.isArray(edu.coursework || edu.relevantCoursework)
      ? (edu.coursework || edu.relevantCoursework || []).map(c => normalizeText(String(c))).filter(Boolean)
      : (edu.coursework || edu.relevantCoursework) ? [normalizeText(String(edu.coursework || edu.relevantCoursework))] : []
  })),
  projects: (content.projects || []).map(proj => ({
    ...proj,
    name: proj.name ? normalizeText(proj.name) : proj.name,
    description: Array.isArray(proj.description) 
      ? proj.description.map(d => normalizeText(String(d))).filter(Boolean)
      : proj.description 
        ? [normalizeText(String(proj.description))] 
        : [],
    technologies: (proj.technologies || proj.skills || []).map(t => normalizeText(String(t))).filter(Boolean)
  }))
});

const normalizeUserProfile = (userProfile) => ({
  ...userProfile,
  summary: userProfile.summary || userProfile.objective || '',
  experiences: (userProfile.experiences || []).map(exp => ({
    ...exp,
    website: exp.website || undefined,
    bullets: exp.bullets || []
  })),
  education: (userProfile.education || []).map(edu => ({
    ...edu,
    coursework: Array.isArray(edu.relevantCoursework || edu.coursework)
      ? (edu.relevantCoursework || edu.coursework || [])
      : (edu.relevantCoursework || edu.coursework) ? [edu.relevantCoursework || edu.coursework] : []
  })),
  projects: (userProfile.projects || []).map(proj => ({
    ...proj,
    description: Array.isArray(proj.description) 
      ? proj.description 
      : proj.description 
        ? [proj.description] 
        : [],
    technologies: proj.skills || proj.technologies || []
  }))
});

resumeRouter.post('/generate', async (req, res) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) {
    console.error('Validation error:', parsed.error.errors);
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { jobDescription, jobUrl, userProfile, model, pages } = parsed.data;
  const targetPages = pages || '1';

  try {
    let finalJobDescription = jobDescription;
    if (jobUrl) {
      try {
        const scraped = await scrapeDynamic(jobUrl);
        finalJobDescription = scraped.jobDescription || scraped.text;
      } catch {
        try {
          const scraped = await scrapeStatic(jobUrl);
          finalJobDescription = scraped.jobDescription || scraped.text;
        } catch (staticErr) {
          return res.status(500).json({ error: `Failed to scrape: ${staticErr.message}` });
        }
      }
    }

    if (!finalJobDescription || finalJobDescription.length < 30) {
      return res.status(400).json({ error: 'Job description too short' });
    }

    const content = await generateResumeContent({ 
      jobDescription: finalJobDescription, 
      userProfile: normalizeUserProfile(userProfile), 
      model,
      pages: targetPages
    });
    
    return res.json({ content, targetPages });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Generation failed' });
  }
});

resumeRouter.post('/pdf', async (req, res) => {
  const parsed = pdfSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const { buffer } = await htmlToPdfBuffer(parsed.data.html);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="resume.pdf"');
    return res.end(buffer, 'binary');
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'PDF generation failed' });
  }
});

// Main endpoint: Simple and fast resume generation
resumeRouter.post('/build', async (req, res) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) {
    console.error('Validation error:', parsed.error.errors);
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  
  const { jobDescription, jobUrl, userProfile, model, template, pages, density } = parsed.data;
  const targetPages = pages || '1';
  const templateName = template || 'modern';
  const contentDensity = density || 3;
  
  const normalizedUserProfile = normalizeUserProfile(userProfile);
  
  // Check subscription limits
  const userId = req.user?.id;
  if (userId) {
    const limitCheck = await canGenerateResume(userId);
    if (!limitCheck.allowed) {
      return res.status(429).json({
        error: 'Resume generation limit exceeded',
        message: limitCheck.error || 'Monthly limit reached',
        used: limitCheck.used,
        limit: limitCheck.limit,
        remaining: limitCheck.remaining,
      });
    }
  }
  
  try {
    // Step 1: Get job description
    let finalJobDescription = jobDescription;
    if (jobUrl) {
      console.log(`🔍 Scraping: ${jobUrl}`);
      try {
        const scraped = await scrapeDynamic(jobUrl);
        finalJobDescription = scraped.jobDescription || scraped.text;
        console.log(`✅ Scraped ${finalJobDescription.length} chars`);
      } catch (scrapeErr) {
        console.warn('⚠️ Dynamic scrape failed:', scrapeErr.message);
        try {
          const scraped = await scrapeStatic(jobUrl);
          finalJobDescription = scraped.jobDescription || scraped.text;
        } catch (staticErr) {
          return res.status(500).json({ error: `Scrape failed: ${staticErr.message}` });
        }
      }
    }

    if (!finalJobDescription || finalJobDescription.length < 30) {
      return res.status(400).json({ error: 'Job description too short' });
    }

    // Step 2: Generate AI content (ONE call, no expansion loops)
    console.log(`🤖 Generating ${targetPages}-page resume...`);
    const content = await generateResumeContent({ 
      jobDescription: finalJobDescription, 
      userProfile: normalizedUserProfile, 
      model,
      pages: targetPages
    });
    
    const normalizedContent = normalizeContent(content);
    
    // Ensure user's projects are included (merge with AI projects, avoid duplicates)
    const userProjects = (normalizedUserProfile.projects || []).map(proj => ({
      name: proj.name,
      skills: proj.skills || [],
      technologies: proj.skills || [], // Templates expect technologies field
      date: proj.date,
      description: Array.isArray(proj.description) ? proj.description : (proj.description ? [proj.description] : [])
    }));
    
    // Normalize AI projects
    const aiProjects = (normalizedContent.projects || []).map(proj => ({
      ...proj,
      name: proj.name || '',
      technologies: proj.technologies || proj.skills || [] // Ensure technologies exists
    })).filter(proj => proj.name); // Filter out projects without names
    
    // Merge: user projects first (they take priority), then AI projects that aren't duplicates
    const allProjects = [...userProjects];
    const userProjectNames = new Set(userProjects.map(p => p.name?.toLowerCase()).filter(Boolean));
    
    aiProjects.forEach(aiProj => {
      const aiProjName = aiProj.name?.toLowerCase();
      if (aiProjName && !userProjectNames.has(aiProjName)) {
        allProjects.push(aiProj);
      }
    });
    
    // Always set projects if we have any (even if empty array, to ensure field exists)
    normalizedContent.projects = allProjects;
    console.log(`📦 Final projects count: ${allProjects.length} (${userProjects.length} from user, ${aiProjects.length} from AI, ${aiProjects.filter(p => !userProjectNames.has(p.name?.toLowerCase())).length} unique AI)`);

    // Step 3: Prepare content with user contact info
    const preparedContent = {
      ...normalizedContent,
      projects: normalizedContent.projects || [], // Ensure projects are explicitly included
      email: normalizedUserProfile.email ? normalizeText(normalizedUserProfile.email) : undefined,
      phone: normalizedUserProfile.phone ? normalizeText(normalizedUserProfile.phone) : undefined,
      location: normalizedUserProfile.location ? normalizeText(normalizedUserProfile.location) : undefined,
      linkedin: normalizedUserProfile.linkedin ? normalizeText(normalizedUserProfile.linkedin) : undefined,
      website: normalizedUserProfile.website ? normalizeText(normalizedUserProfile.website) : undefined
    };
    
    console.log(`📋 Content summary: ${preparedContent.experiences?.length || 0} experiences, ${preparedContent.projects?.length || 0} projects, ${preparedContent.skills?.length || 0} skills`);
    
    // Step 4: Generate HTML with density-based CSS spacing
    const html = renderResumeTemplate(
      normalizeText(normalizedUserProfile.fullName),
      preparedContent,
      templateName,
      targetPages,
      contentDensity  // Density controls CSS spacing, not content amount
    );
    
    // Step 5: Generate PDF (ONE call, no loops)
    console.log(`📄 Generating PDF (density: ${contentDensity}/5)...`);
    const { buffer, actualPages } = await htmlToPdfBuffer(html, targetPages);
    
    console.log(`✅ Done: ${actualPages} page(s)`);
    
    // Send response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="resume.pdf"');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('X-Actual-Pages', actualPages.toString());
    res.setHeader('X-Target-Pages', targetPages);
    res.setHeader('X-Density', contentDensity.toString());
    
    if (userId) {
      const { error } = await recordResumeGeneration(userId);
      if (error) console.error('⚠️ Record failed:', error);
    }
    
    res.end(buffer, 'binary');
  } catch (err) {
    console.error('❌ Build error:', err);
    if (!res.headersSent) {
      return res.status(500).json({ error: err?.message || 'Build failed' });
    }
  }
});

// Preview endpoint
resumeRouter.post('/preview', async (req, res) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  
  const { jobDescription, jobUrl, userProfile, model, template, pages, density } = parsed.data;
  const targetPages = pages || '1';
  const contentDensity = density || 3;
  
  const normalizedUserProfile = normalizeUserProfile(userProfile);
  
  try {
    let finalJobDescription = jobDescription;
    if (jobUrl) {
      try {
        const scraped = await scrapeDynamic(jobUrl);
        finalJobDescription = scraped.jobDescription || scraped.text;
      } catch {
        try {
          const scraped = await scrapeStatic(jobUrl);
          finalJobDescription = scraped.jobDescription || scraped.text;
        } catch (e) {
          return res.status(500).json({ error: `Scrape failed: ${e.message}` });
        }
      }
    }

    if (!finalJobDescription || finalJobDescription.length < 30) {
      return res.status(400).json({ error: 'Job description too short' });
    }

    const content = await generateResumeContent({ 
      jobDescription: finalJobDescription, 
      userProfile: normalizedUserProfile, 
      model,
      pages: targetPages
    });
    
    const normalizedContent = normalizeContent(content);
    
    const html = renderResumeTemplate(
      normalizeText(normalizedUserProfile.fullName),
      { 
        ...normalizedContent, 
        email: normalizedUserProfile.email, 
        phone: normalizedUserProfile.phone, 
        location: normalizedUserProfile.location,
        website: normalizedUserProfile.website
      },
      template || 'modern',
      targetPages,
      contentDensity
    );
    
    return res.json({ html, content: normalizedContent });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Preview failed' });
  }
});

resumeRouter.post('/preview', async (req, res) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  
  const { jobDescription, jobUrl, userProfile, model, template, pages, density } = parsed.data;
  const targetPages = pages || '1';
  const contentDensity = density || 3;
  
  const normalizedUserProfile = normalizeUserProfile(userProfile);
  
  try {
    let finalJobDescription = jobDescription;
    if (jobUrl) {
      try {
        const scraped = await scrapeDynamic(jobUrl);
        finalJobDescription = scraped.jobDescription || scraped.text;
      } catch {
        try {
          const scraped = await scrapeStatic(jobUrl);
          finalJobDescription = scraped.jobDescription || scraped.text;
        } catch (e) {
          return res.status(500).json({ error: `Scrape failed: ${e.message}` });
        }
      }
    }

    if (!finalJobDescription || finalJobDescription.length < 30) {
      return res.status(400).json({ error: 'Job description too short' });
    }

    const content = await generateResumeContent({ 
      jobDescription: finalJobDescription, 
      userProfile: normalizedUserProfile, 
      model,
      pages: targetPages
    });
    
    const normalizedContent = normalizeContent(content);
    
    const html = renderResumeTemplate(
      normalizeText(normalizedUserProfile.fullName),
      { 
        ...normalizedContent, 
        email: normalizedUserProfile.email, 
        phone: normalizedUserProfile.phone, 
        location: normalizedUserProfile.location,
        website: normalizedUserProfile.website
      },
      template || 'modern',
      targetPages,
      contentDensity
    );
    
    return res.json({ html, content: normalizedContent });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Preview failed' });
  }
});

resumeRouter.post('/view', async (req, res) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) {
    console.error('Validation error:', parsed.error.errors);
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  
  const { jobDescription, jobUrl, userProfile, model, template, pages, density } = parsed.data;
  const targetPages = pages || '1';
  const templateName = template || 'modern';
  const contentDensity = density || 3;
  
  const normalizedUserProfile = normalizeUserProfile(userProfile);
  
  // Check subscription limits
  const userId = req.user?.id;
  if (userId) {
    const limitCheck = await canGenerateResume(userId);
    if (!limitCheck.allowed) {
      return res.status(429).json({
        error: 'Resume generation limit exceeded',
        message: limitCheck.error || 'Monthly limit reached',
        used: limitCheck.used,
        limit: limitCheck.limit,
        remaining: limitCheck.remaining,
      });
    }
  }
  
  try {
    // Step 1: Get job description
    let finalJobDescription = jobDescription;
    if (jobUrl) {
      console.log(`🔍 Scraping: ${jobUrl}`);
      try {
        const scraped = await scrapeDynamic(jobUrl);
        finalJobDescription = scraped.jobDescription || scraped.text;
        console.log(`✅ Scraped ${finalJobDescription.length} chars`);
      } catch (scrapeErr) {
        console.warn('⚠️ Dynamic scrape failed:', scrapeErr.message);
        try {
          const scraped = await scrapeStatic(jobUrl);
          finalJobDescription = scraped.jobDescription || scraped.text;
        } catch (staticErr) {
          return res.status(500).json({ error: `Scrape failed: ${staticErr.message}` });
        }
      }
    }

    if (!finalJobDescription || finalJobDescription.length < 30) {
      return res.status(400).json({ error: 'Job description too short' });
    }

    // Step 2: Generate AI content
    console.log(`🤖 Generating ${targetPages}-page resume for viewing...`);
    const content = await generateResumeContent({ 
      jobDescription: finalJobDescription, 
      userProfile: normalizedUserProfile, 
      model,
      pages: targetPages
    });
    
    const normalizedContent = normalizeContent(content);
    
    // Merge user projects with AI projects
    const userProjects = (normalizedUserProfile.projects || []).map(proj => ({
      name: proj.name,
      skills: proj.skills || [],
      technologies: proj.skills || [],
      date: proj.date,
      description: Array.isArray(proj.description) ? proj.description : (proj.description ? [proj.description] : [])
    }));
    
    const aiProjects = (normalizedContent.projects || []).map(proj => ({
      ...proj,
      name: proj.name || '',
      technologies: proj.technologies || proj.skills || []
    })).filter(proj => proj.name);
    
    const allProjects = [...userProjects];
    const userProjectNames = new Set(userProjects.map(p => p.name?.toLowerCase()).filter(Boolean));
    
    aiProjects.forEach(aiProj => {
      const aiProjName = aiProj.name?.toLowerCase();
      if (aiProjName && !userProjectNames.has(aiProjName)) {
        allProjects.push(aiProj);
      }
    });
    
    normalizedContent.projects = allProjects;

    // Step 3: Prepare content with user contact info
    const preparedContent = {
      ...normalizedContent,
      projects: normalizedContent.projects || [],
      email: normalizedUserProfile.email ? normalizeText(normalizedUserProfile.email) : undefined,
      phone: normalizedUserProfile.phone ? normalizeText(normalizedUserProfile.phone) : undefined,
      location: normalizedUserProfile.location ? normalizeText(normalizedUserProfile.location) : undefined,
      linkedin: normalizedUserProfile.linkedin ? normalizeText(normalizedUserProfile.linkedin) : undefined,
      website: normalizedUserProfile.website ? normalizeText(normalizedUserProfile.website) : undefined
    };
    
    // Step 4: Generate HTML
    const html = renderResumeTemplate(
      normalizeText(normalizedUserProfile.fullName),
      preparedContent,
      templateName,
      targetPages,
      contentDensity
    );
    
    // Step 5: Generate PDF
    console.log(`📄 Generating PDF for viewing (density: ${contentDensity}/5)...`);
    const { buffer, actualPages } = await htmlToPdfBuffer(html, targetPages);
    
    console.log(`✅ PDF ready for viewing: ${actualPages} page(s)`);
    
    // Send response with inline disposition for browser viewing
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="resume.pdf"'); // inline instead of attachment
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('X-Actual-Pages', actualPages.toString());
    res.setHeader('X-Target-Pages', targetPages);
    res.setHeader('X-Density', contentDensity.toString());
    
    if (userId) {
      const { error } = await recordResumeGeneration(userId);
      if (error) console.error('⚠️ Record failed:', error);
    }
    
    res.end(buffer, 'binary');
  } catch (err) {
    console.error('❌ View error:', err);
    if (!res.headersSent) {
      return res.status(500).json({ error: err?.message || 'View failed' });
    }
  }
});

// Preview endpoint
resumeRouter.post('/preview', async (req, res) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  
  const { jobDescription, jobUrl, userProfile, model, template, pages, density } = parsed.data;
  const targetPages = pages || '1';
  const contentDensity = density || 3;
  
  const normalizedUserProfile = normalizeUserProfile(userProfile);
  
  try {
    let finalJobDescription = jobDescription;
    if (jobUrl) {
      try {
        const scraped = await scrapeDynamic(jobUrl);
        finalJobDescription = scraped.jobDescription || scraped.text;
      } catch {
        try {
          const scraped = await scrapeStatic(jobUrl);
          finalJobDescription = scraped.jobDescription || scraped.text;
        } catch (e) {
          return res.status(500).json({ error: `Scrape failed: ${e.message}` });
        }
      }
    }

    if (!finalJobDescription || finalJobDescription.length < 30) {
      return res.status(400).json({ error: 'Job description too short' });
    }

    const content = await generateResumeContent({ 
      jobDescription: finalJobDescription, 
      userProfile: normalizedUserProfile, 
      model,
      pages: targetPages
    });
    
    const normalizedContent = normalizeContent(content);
    
    const html = renderResumeTemplate(
      normalizeText(normalizedUserProfile.fullName),
      { 
        ...normalizedContent, 
        email: normalizedUserProfile.email, 
        phone: normalizedUserProfile.phone, 
        location: normalizedUserProfile.location,
        website: normalizedUserProfile.website
      },
      template || 'modern',
      targetPages,
      contentDensity
    );
    
    return res.json({ html, content: normalizedContent });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Preview failed' });
  }
});

resumeRouter.post('/view', async (req, res) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) {
    console.error('Validation error:', parsed.error.errors);
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  
  const { jobDescription, jobUrl, userProfile, model, template, pages, density } = parsed.data;
  const targetPages = pages || '1';
  const templateName = template || 'modern';
  const contentDensity = density || 3;
  
  const normalizedUserProfile = normalizeUserProfile(userProfile);
  
  // Check subscription limits
  const userId = req.user?.id;
  if (userId) {
    const limitCheck = await canGenerateResume(userId);
    if (!limitCheck.allowed) {
      return res.status(429).json({
        error: 'Resume generation limit exceeded',
        message: limitCheck.error || 'Monthly limit reached',
        used: limitCheck.used,
        limit: limitCheck.limit,
        remaining: limitCheck.remaining,
      });
    }
  }
  
  try {
    // Step 1: Get job description
    let finalJobDescription = jobDescription;
    if (jobUrl) {
      console.log(`🔍 Scraping: ${jobUrl}`);
      try {
        const scraped = await scrapeDynamic(jobUrl);
        finalJobDescription = scraped.jobDescription || scraped.text;
        console.log(`✅ Scraped ${finalJobDescription.length} chars`);
      } catch (scrapeErr) {
        console.warn('⚠️ Dynamic scrape failed:', scrapeErr.message);
        try {
          const scraped = await scrapeStatic(jobUrl);
          finalJobDescription = scraped.jobDescription || scraped.text;
        } catch (staticErr) {
          return res.status(500).json({ error: `Scrape failed: ${staticErr.message}` });
        }
      }
    }

    if (!finalJobDescription || finalJobDescription.length < 30) {
      return res.status(400).json({ error: 'Job description too short' });
    }

    // Step 2: Generate AI content
    console.log(`🤖 Generating ${targetPages}-page resume for viewing...`);
    const content = await generateResumeContent({ 
      jobDescription: finalJobDescription, 
      userProfile: normalizedUserProfile, 
      model,
      pages: targetPages
    });
    
    const normalizedContent = normalizeContent(content);
    
    // Merge user projects with AI projects
    const userProjects = (normalizedUserProfile.projects || []).map(proj => ({
      name: proj.name,
      skills: proj.skills || [],
      technologies: proj.skills || [],
      date: proj.date,
      description: Array.isArray(proj.description) ? proj.description : (proj.description ? [proj.description] : [])
    }));
    
    const aiProjects = (normalizedContent.projects || []).map(proj => ({
      ...proj,
      name: proj.name || '',
      technologies: proj.technologies || proj.skills || []
    })).filter(proj => proj.name);
    
    const allProjects = [...userProjects];
    const userProjectNames = new Set(userProjects.map(p => p.name?.toLowerCase()).filter(Boolean));
    
    aiProjects.forEach(aiProj => {
      const aiProjName = aiProj.name?.toLowerCase();
      if (aiProjName && !userProjectNames.has(aiProjName)) {
        allProjects.push(aiProj);
      }
    });
    
    normalizedContent.projects = allProjects;

    // Step 3: Prepare content with user contact info
    const preparedContent = {
      ...normalizedContent,
      projects: normalizedContent.projects || [],
      email: normalizedUserProfile.email ? normalizeText(normalizedUserProfile.email) : undefined,
      phone: normalizedUserProfile.phone ? normalizeText(normalizedUserProfile.phone) : undefined,
      location: normalizedUserProfile.location ? normalizeText(normalizedUserProfile.location) : undefined,
      linkedin: normalizedUserProfile.linkedin ? normalizeText(normalizedUserProfile.linkedin) : undefined,
      website: normalizedUserProfile.website ? normalizeText(normalizedUserProfile.website) : undefined
    };
    
    // Step 4: Generate HTML
    const html = renderResumeTemplate(
      normalizeText(normalizedUserProfile.fullName),
      preparedContent,
      templateName,
      targetPages,
      contentDensity
    );
    
    // Step 5: Generate PDF
    console.log(`📄 Generating PDF for viewing (density: ${contentDensity}/5)...`);
    const { buffer, actualPages } = await htmlToPdfBuffer(html, targetPages);
    
    console.log(`✅ PDF ready for viewing: ${actualPages} page(s)`);
    
    // Send response with inline disposition for browser viewing
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="resume.pdf"'); // inline instead of attachment
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('X-Actual-Pages', actualPages.toString());
    res.setHeader('X-Target-Pages', targetPages);
    res.setHeader('X-Density', contentDensity.toString());
    
    if (userId) {
      const { error } = await recordResumeGeneration(userId);
      if (error) console.error('⚠️ Record failed:', error);
    }
    
    res.end(buffer, 'binary');
  } catch (err) {
    console.error('❌ View error:', err);
    if (!res.headersSent) {
      return res.status(500).json({ error: err?.message || 'View failed' });
    }
  }
});

// Preview endpoint
resumeRouter.post('/preview', async (req, res) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  
  const { jobDescription, jobUrl, userProfile, model, template, pages, density } = parsed.data;
  const targetPages = pages || '1';
  const contentDensity = density || 3;
  
  const normalizedUserProfile = normalizeUserProfile(userProfile);
  
  try {
    let finalJobDescription = jobDescription;
    if (jobUrl) {
      try {
        const scraped = await scrapeDynamic(jobUrl);
        finalJobDescription = scraped.jobDescription || scraped.text;
      } catch {
        try {
          const scraped = await scrapeStatic(jobUrl);
          finalJobDescription = scraped.jobDescription || scraped.text;
        } catch (e) {
          return res.status(500).json({ error: `Scrape failed: ${e.message}` });
        }
      }
    }

    if (!finalJobDescription || finalJobDescription.length < 30) {
      return res.status(400).json({ error: 'Job description too short' });
    }

    const content = await generateResumeContent({ 
      jobDescription: finalJobDescription, 
      userProfile: normalizedUserProfile, 
      model,
      pages: targetPages
    });
    
    const normalizedContent = normalizeContent(content);
    
    const html = renderResumeTemplate(
      normalizeText(normalizedUserProfile.fullName),
      { 
        ...normalizedContent, 
        email: normalizedUserProfile.email, 
        phone: normalizedUserProfile.phone, 
        location: normalizedUserProfile.location,
        website: normalizedUserProfile.website
      },
      template || 'modern',
      targetPages,
      contentDensity
    );
    
    return res.json({ html, content: normalizedContent });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Preview failed' });
  }
});
