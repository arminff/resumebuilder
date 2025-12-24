import puppeteer from 'puppeteer';
import { PDFDocument } from 'pdf-lib';

// Standard margins in inches
const MARGINS_IN = {
  '1': { top: 0.35, bottom: 0.35, left: 0.45, right: 0.45 },
  '2': { top: 0.45, bottom: 0.45, left: 0.65, right: 0.65 },
  '3': { top: 0.6, bottom: 0.6, left: 0.85, right: 0.85 }
};

export async function launchBrowser() {
  const launchOptions = {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer'
    ]
  };
  
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  return puppeteer.launch(launchOptions);
}

/**
 * Generate PDF from HTML string and measure content fill ratio
 * Returns fill ratio per page to check for white space (90%+ target)
 */
export async function htmlToPdfBuffer(htmlString, pages = '1') {
  const browser = await launchBrowser();
  const margins = MARGINS_IN[pages] || MARGINS_IN['1'];
  
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 816, height: 1056 }); // Letter size at 96 DPI
    await page.setContent(htmlString, { waitUntil: 'networkidle0', timeout: 30000 });
    
    // Measure content height before generating PDF
    const contentMetrics = await page.evaluate(() => {
      const body = document.body;
      const html = document.documentElement;
      const height = Math.max(
        body.scrollHeight, body.offsetHeight,
        html.clientHeight, html.scrollHeight, html.offsetHeight
      );
      return { contentHeight: height };
    });
    
    const pdfBuffer = await page.pdf({ 
      format: 'Letter',
      printBackground: true,
      margin: {
        top: `${margins.top}in`,
        right: `${margins.right}in`,
        bottom: `${margins.bottom}in`,
        left: `${margins.left}in`
      },
      preferCSSPageSize: false,
      displayHeaderFooter: false
    });
    
    await page.close();
    
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const actualPages = pdfDoc.getPageCount();
    
    // Calculate fill ratio
    // Letter page: 11 inches tall = 1056 pixels at 96 DPI
    // Usable height per page = 11 - top margin - bottom margin
    const pageHeightInches = 11;
    const usableHeightPerPageInches = pageHeightInches - margins.top - margins.bottom;
    const usableHeightPerPagePixels = usableHeightPerPageInches * 96; // Convert to pixels (96 DPI)
    
    const contentHeight = contentMetrics.contentHeight;
    const targetPageCount = parseInt(pages);
    
    // Calculate fill ratio: how much of the target pages is filled
    const totalUsableHeight = usableHeightPerPagePixels * targetPageCount;
    const fillRatio = Math.min(1.0, contentHeight / totalUsableHeight);
    
    // Calculate fill per page: average fill across actual pages
    // If content spans fewer pages than target, calculate based on target pages
    const fillPerPage = actualPages > 0 
      ? Math.min(1.0, contentHeight / (usableHeightPerPagePixels * Math.max(actualPages, targetPageCount)))
      : 0;
    
    // For multi-page, also calculate fill for each individual page
    // This is an approximation - we can't measure individual pages easily
    // But we can estimate based on content distribution
    const estimatedFillPerPage = actualPages > 0 
      ? Math.min(1.0, contentHeight / (usableHeightPerPagePixels * actualPages))
      : 0;
    
    return {
      buffer: pdfBuffer,
      actualPages,
      fillRatio,           // Overall fill ratio across target pages
      fillPerPage,         // Average fill per page
      estimatedFillPerPage, // Estimated fill per actual page
      contentHeight,
      usableHeightPerPagePixels
    };
  } finally {
    await browser.close();
  }
}

// Content analysis for estimation
export function analyzeContentForPageTarget(content, targetPages) {
  const experiences = content.experiences || content.experience || [];
  const skills = content.skills || [];
  const education = content.education || [];
  const certifications = content.certifications || [];
  const projects = content.projects || [];
  
  let lineCount = 3;
  
  if (content.summary) {
    lineCount += Math.ceil(content.summary.length / 80);
  }
  
  experiences.forEach(exp => {
    lineCount += 2;
    const bullets = exp.responsibilities || exp.bullets || [];
    bullets.forEach(b => lineCount += Math.ceil(b.length / 90));
    lineCount += 1;
  });
  
  lineCount += Math.ceil(skills.length / 6) + 1;
  lineCount += education.length * 3;
  lineCount += certifications.length * 1.5;
  lineCount += projects.length * 3;
  
  const linesPerPage = 45;
  const estimatedPages = lineCount / linesPerPage;
  const targetCount = parseInt(targetPages);
  
  return {
    lineCount,
    estimatedPages: Math.round(estimatedPages * 10) / 10,
    targetPages: targetCount
  };
}
