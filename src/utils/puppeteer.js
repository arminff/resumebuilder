import puppeteer from 'puppeteer';
import { execSync } from 'child_process';

export async function htmlToPdfBuffer(htmlString) {
  const launchOptions = {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  };
  
  // Use system Chromium if available, otherwise use bundled Chrome
  if (!process.env.PUPPETEER_EXECUTABLE_PATH) {
    try {
      const chromiumPath = execSync('which chromium-browser || which chromium', { encoding: 'utf8' }).trim();
      if (chromiumPath) {
        launchOptions.executablePath = chromiumPath;
        console.log('✅ Using system Chromium:', chromiumPath);
      }
    } catch (e) {
      console.log('⚠️ System Chromium not found, using bundled Chrome');
    }
  } else {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  const browser = await puppeteer.launch(launchOptions);
  try {
    const page = await browser.newPage();
    await page.setContent(htmlString, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}


