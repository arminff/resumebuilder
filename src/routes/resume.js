import { Router } from 'express';
import { generateSchema, pdfSchema } from '../utils/schemas.js';
import { generateResumeContent } from '../utils/openrouter.js';
import { htmlToPdfBuffer } from '../utils/puppeteer.js';
import { renderResumeTemplate } from '../utils/templates.js';
import { scrapeDynamic, scrapeStatic } from '../utils/scrape.js';

export const resumeRouter = Router();

resumeRouter.post('/generate', async (req, res) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) {
    console.error('Validation error:', parsed.error.errors);
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { jobDescription, jobUrl, userProfile, model } = parsed.data;

  try {
    // If jobUrl provided, scrape it first
    let finalJobDescription = jobDescription;
    if (jobUrl) {
      console.log(`Scraping job from: ${jobUrl}`);
      try {
        const scraped = await scrapeDynamic(jobUrl);
        finalJobDescription = scraped.jobDescription || scraped.text;
        console.log(`Scraped ${finalJobDescription.length} characters from job posting`);
      } catch (scrapeErr) {
        console.warn('Dynamic scrape failed, trying static:', scrapeErr.message);
        try {
          const scraped = await scrapeStatic(jobUrl);
          finalJobDescription = scraped.jobDescription || scraped.text;
        } catch (staticErr) {
          return res.status(500).json({ error: `Failed to scrape job URL: ${staticErr.message}` });
        }
      }
    }

    if (!finalJobDescription || finalJobDescription.length < 30) {
      return res.status(400).json({ error: 'Job description too short or could not be extracted' });
    }

    const content = await generateResumeContent({ jobDescription: finalJobDescription, userProfile, model });
    return res.json({ content, jobDescription: finalJobDescription.substring(0, 200) + '...' });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Generation failed' });
  }
});

resumeRouter.post('/pdf', async (req, res) => {
  const parsed = pdfSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const buffer = await htmlToPdfBuffer(parsed.data.html);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="resume.pdf"');
    return res.end(buffer, 'binary');
  } catch (err) {
    console.error('PDF generation error:', err);
    return res.status(500).json({ error: err?.message || 'PDF generation failed' });
  }
});

// Convenience endpoint: generate AI content then render to PDF using professional templates
// Supports both jobDescription text and jobUrl for automatic scraping
resumeRouter.post('/build', async (req, res) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) {
    console.error('Validation error:', parsed.error.errors);
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { jobDescription, jobUrl, userProfile, model, template } = parsed.data;
  
  try {
    // If jobUrl provided, scrape it first
    let finalJobDescription = jobDescription;
    if (jobUrl) {
      console.log(`🔍 Scraping job from: ${jobUrl}`);
      try {
        const scraped = await scrapeDynamic(jobUrl);
        finalJobDescription = scraped.jobDescription || scraped.text;
        console.log(`✅ Scraped ${finalJobDescription.length} characters from job posting`);
      } catch (scrapeErr) {
        console.warn('⚠️ Dynamic scrape failed, trying static:', scrapeErr.message);
        try {
          const scraped = await scrapeStatic(jobUrl);
          finalJobDescription = scraped.jobDescription || scraped.text;
        } catch (staticErr) {
          return res.status(500).json({ error: `Failed to scrape job URL: ${staticErr.message}` });
        }
      }
    }

    if (!finalJobDescription || finalJobDescription.length < 30) {
      return res.status(400).json({ error: 'Job description too short or could not be extracted' });
    }

    console.log('🤖 Generating AI resume content...');
    const content = await generateResumeContent({ jobDescription: finalJobDescription, userProfile, model });
    
    console.log('📄 Rendering PDF with template:', template || 'modern');
    const html = renderResumeTemplate(
      userProfile.fullName, 
      { 
        ...content, 
        email: userProfile.email, 
        phone: userProfile.phone,
        location: userProfile.location
      }, 
      template || 'modern'
    );
    
    const buffer = await htmlToPdfBuffer(html);
    
    // Ensure we only send one response
    if (res.headersSent) {
      console.warn('⚠️ Response already sent, skipping PDF generation');
      return;
    }
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="resume.pdf"');
    res.setHeader('Content-Length', buffer.length);
    console.log('✅ PDF generated successfully');
    res.end(buffer, 'binary');
  } catch (err) {
    console.error('❌ PDF generation error:', err);
    // Make sure we don't send PDF content if there's an error
    if (!res.headersSent) {
      return res.status(500).json({ error: err?.message || 'Build failed' });
    }
  }
});



