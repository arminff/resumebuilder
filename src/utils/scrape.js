import axios from 'axios';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';

// Smart job description extractor
function extractJobDescription($) {
  // Remove common unwanted elements
  $('script, style, nav, header, footer, .nav, .header, .footer, .menu, .sidebar, .ad, .advertisement').remove();
  
  // Common selectors for job descriptions (priority order)
  const selectors = [
    '[data-job-description]',
    '[data-testid*="job"]',
    '.job-description',
    '.jobDescription',
    '.job-description-text',
    'article.job-description',
    'article[role="article"]',
    '.job-details',
    '.job-content',
    '.job-body',
    '[class*="job-description"]',
    '[id*="job-description"]',
    '[id*="description"]',
    'article',
    '.description',
    '[role="article"]',
    '.posting-description',
    '.job-posting-description'
  ];

  for (const selector of selectors) {
    const element = $(selector).first();
    if (element.length) {
      const text = element.text().trim();
      // Check if it's substantial content (not just navigation/menu)
      if (text.length > 300 && !text.includes('Cookie') && !text.includes('Privacy Policy')) {
        // Clean up the text
        return text.replace(/\s+/g, ' ').replace(/\n\s*\n/g, '\n').trim();
      }
    }
  }

  // Fallback: get main content area
  const mainContent = $('main, .content, .main, #content, #main').first();
  if (mainContent.length) {
    const text = mainContent.text().trim();
    if (text.length > 300) {
      return text.replace(/\s+/g, ' ').replace(/\n\s*\n/g, '\n').trim();
    }
  }

  // Last resort: get body text but clean it up
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  // Remove common navigation/menu text
  return bodyText.replace(/Cookie|Privacy|Terms|Sign in|Sign up|Login|Register/gi, '').trim();
}

export async function scrapeStatic(url) {
  const res = await axios.get(url, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
  const $ = cheerio.load(res.data);
  const title = $('title').text().trim();
  const jobDescription = extractJobDescription($);
  const text = $('body').text().replace(/\s+/g, ' ').trim();
  
  return { 
    title, 
    text, 
    jobDescription: jobDescription || text,
    html: res.data 
  };
}

export async function scrapeDynamic(url) {
  const browser = await puppeteer.launch({ 
    headless: 'new', 
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  });
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    // Navigate and wait for content
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for dynamic content using Promise instead of waitForTimeout
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Try to wait for common job description elements
    try {
      await page.waitForSelector('article, .job-description, [data-job-description], .description', { timeout: 5000 });
    } catch (e) {
      // If selector not found, continue anyway
    }
    
    const html = await page.content();
    const $ = cheerio.load(html);
    const title = $('title').text().trim();
    const jobDescription = extractJobDescription($);
    const text = $('body').text().replace(/\s+/g, ' ').trim();
    
    return { 
      title, 
      text, 
      jobDescription: jobDescription || text,
      html 
    };
  } finally {
    await browser.close();
  }
}


