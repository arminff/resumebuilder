// Professional resume templates with smart layout for exact page control

function normalizeText(text) {
  if (!text) return '';
  return String(text)
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

function escapeHtml(text) {
  if (!text) return '';
  return normalizeText(String(text))
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Base layout configuration
const BASE_LAYOUT = {
    bodyFontSize: 10.5,
  headerFontSize: 18,
    sectionTitleSize: 11,
    lineHeight: 1.35,
    sectionMargin: 10,
    itemMargin: 6,
    bulletMargin: 2,
  headerMargin: 8,
    summaryLineHeight: 1.3,
    bulletFontSize: 10,
  contactFontSize: 9.5,
  skillsLineHeight: 1.35,
  pageMargins: { top: 0.5, bottom: 0.5, left: 0.6, right: 0.6 }
};

// Special layout for reference template (matches PDF exactly - tight, clean spacing)
const REFERENCE_LAYOUT = {
  bodyFontSize: 10.5,
    headerFontSize: 18,
  sectionTitleSize: 11,
  lineHeight: 1.2,  // Tighter line height for cleaner look
  sectionMargin: 6,  // Reduced spacing between sections
  itemMargin: 4,    // Tighter spacing between items
  bulletMargin: 1.5, // Minimal gap between bullets
  headerMargin: 5,
  summaryLineHeight: 1.2,
  bulletFontSize: 10,
  contactFontSize: 9.5,
  skillsLineHeight: 1.2,
  pageMargins: { top: 0.45, bottom: 0.45, left: 0.5, right: 0.5 } // Minimal margins for maximum content
};

// Density multipliers: 1 = spacious, 5 = compact
// Higher density = tighter spacing, more content fits
const DENSITY_MULTIPLIERS = {
  1: { spacing: 1.4, lineHeight: 1.15, margins: 1.3 },   // Very spacious
  2: { spacing: 1.2, lineHeight: 1.08, margins: 1.15 },  // Spacious
  3: { spacing: 1.0, lineHeight: 1.0, margins: 1.0 },    // Balanced
  4: { spacing: 0.8, lineHeight: 0.92, margins: 0.85 },  // Compact
  5: { spacing: 0.6, lineHeight: 0.85, margins: 0.7 }    // Very compact
};

function getLayout(pages, density = 3) {
  const mult = DENSITY_MULTIPLIERS[density] || DENSITY_MULTIPLIERS[3];
  
  return {
    bodyFontSize: BASE_LAYOUT.bodyFontSize,
    headerFontSize: BASE_LAYOUT.headerFontSize,
    sectionTitleSize: BASE_LAYOUT.sectionTitleSize,
    lineHeight: BASE_LAYOUT.lineHeight * mult.lineHeight,
    sectionMargin: Math.round(BASE_LAYOUT.sectionMargin * mult.spacing),
    itemMargin: Math.round(BASE_LAYOUT.itemMargin * mult.spacing),
    bulletMargin: Math.max(1, Math.round(BASE_LAYOUT.bulletMargin * mult.spacing)),
    headerMargin: Math.round(BASE_LAYOUT.headerMargin * mult.spacing),
    summaryLineHeight: BASE_LAYOUT.summaryLineHeight * mult.lineHeight,
    bulletFontSize: BASE_LAYOUT.bulletFontSize,
    contactFontSize: BASE_LAYOUT.contactFontSize,
    skillsLineHeight: BASE_LAYOUT.skillsLineHeight * mult.lineHeight,
    pageMargins: {
      top: BASE_LAYOUT.pageMargins.top * mult.margins,
      bottom: BASE_LAYOUT.pageMargins.bottom * mult.margins,
      left: BASE_LAYOUT.pageMargins.left * mult.margins,
      right: BASE_LAYOUT.pageMargins.right * mult.margins
    }
  };
}

export function renderResumeTemplate(name, content, templateName = 'modern', pages = '1', density = 3) {
  const safe = (x) => (Array.isArray(x) ? x : [x]).filter(Boolean);
  
  const templates = {
    modern: modernTemplate,
    classic: classicTemplate,
    minimal: minimalTemplate,
    reference: referenceTemplate,
  };
  
  const template = templates[templateName] || templates.modern;
  // Use fixed layout for reference template to match PDF exactly
  const layout = templateName === 'reference' ? REFERENCE_LAYOUT : getLayout(pages, density);
  
  return template(name, content, safe, pages, layout);
}

// Helper: Generate skills as a grid for better space utilization
function generateSkillsGrid(skills, safe, layout) {
  if (!skills || skills.length === 0) return '';
  
  return `
    <div class="skills-grid">
      ${safe(skills).map(s => `<span class="skill-tag">${escapeHtml(s)}</span>`).join('')}
    </div>
  `;
}

// Helper: Generate skills with categories
function generateCategorizedSkills(skillCategories, safe, layout) {
  if (!skillCategories) return '';
  
  return Object.entries(skillCategories).map(([category, categorySkills]) => `
    <div class="skills-category">
      <span class="skills-category-title">${escapeHtml(category)}:</span>
      <span class="skills-list">${safe(categorySkills).map(s => escapeHtml(s)).join(' • ')}</span>
    </div>
  `).join('');
}

// Helper: Generate a key highlights section (professional space filler)
function generateHighlightsSection(content, safe, pages, layout) {
  if (pages === '1') return ''; // Don't add for 1-page resumes
  
  // Extract potential highlights from experiences
  const experiences = safe(content.experiences || content.experience);
  const highlights = [];
  
  experiences.forEach(exp => {
    const bullets = safe(exp.responsibilities || exp.bullets);
    // Find bullets with numbers/metrics (these are usually achievements)
    bullets.forEach(bullet => {
      if (/\d+%|\$\d+|\d+\+|\d+ (years|months|clients|users|projects)/i.test(bullet)) {
        if (highlights.length < 4) {
          highlights.push(bullet);
        }
      }
    });
  });
  
  if (highlights.length < 2) return '';
  
  return `
    <div class="section highlights-section">
      <div class="section-title">Key Achievements</div>
      <div class="highlights-grid">
        ${highlights.map(h => `<div class="highlight-item">✓ ${escapeHtml(h)}</div>`).join('')}
      </div>
    </div>
  `;
}

function modernTemplate(name, content, safe, pages, layout) {
  const experiences = safe(content.experiences || content.experience);
  const skills = safe(content.skills);
  const skillCategories = content.skillCategories || null;
  const education = safe(content.education);
  const certifications = safe(content.certifications);
  const projects = safe(content.projects);
  const awards = safe(content.awards);
  const languages = safe(content.languages);
  const publications = safe(content.publications);
  const summary = content.summary || content.professionalSummary || '';
  
  // Determine if we should use enhanced layouts
  const useSkillsGrid = pages !== '1' && skills.length > 8;
  const showExtras = pages !== '1';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Resume - ${name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      white-space: normal;
    }
    @page { 
      margin: ${layout.pageMargins.top}in ${layout.pageMargins.right}in ${layout.pageMargins.bottom}in ${layout.pageMargins.left}in;
      size: letter; 
    }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: ${layout.bodyFontSize}pt;
      line-height: ${layout.lineHeight};
      color: #000;
      background: #fff;
    }
    
    /* Header */
    .header {
      text-align: center;
      margin-bottom: ${pages === '2' ? 10 : layout.headerMargin}pt;
      border-bottom: ${pages === '2' ? '1.5pt' : '2pt'} solid #000;
      padding-bottom: ${pages === '2' ? 6 : 8}pt;
    }
    .header h1 {
      font-size: ${layout.headerFontSize}pt;
      font-weight: bold;
      margin-bottom: ${pages === '2' ? 4 : 6}pt;
      text-transform: uppercase;
      letter-spacing: ${pages === '2' ? '0.5pt' : '1pt'};
    }
    .contact {
      font-size: ${layout.contactFontSize}pt;
      line-height: ${pages === '2' ? 1.4 : 1.5};
    }
    .contact span {
      margin: 0 ${pages === '2' ? 6 : 8}pt;
      white-space: nowrap;
    }
    .contact span:empty { display: none; }
    
    /* Sections */
    .section {
      margin-bottom: ${layout.sectionMargin}pt;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: ${layout.sectionTitleSize}pt;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: ${pages === '2' ? 4 : 6}pt;
      border-bottom: ${pages === '2' ? '0.75pt' : '1pt'} solid #000;
      padding-bottom: ${pages === '2' ? 1.5 : 2}pt;
      letter-spacing: ${pages === '2' ? '0.5pt' : '0pt'};
    }
    
    /* Summary */
    .summary {
      font-size: ${layout.bodyFontSize}pt;
      line-height: ${layout.summaryLineHeight};
      text-align: ${pages === '2' ? 'left' : 'justify'};
      margin-bottom: ${pages === '2' ? 2 : 0}pt;
    }
    
    /* Experience */
    .experience-item {
      margin-bottom: ${layout.itemMargin}pt;
      page-break-inside: avoid;
    }
    .job-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: ${pages === '2' ? 3 : 4}pt;
      flex-wrap: wrap;
    }
    .job-title {
      font-weight: bold;
      font-size: ${layout.bodyFontSize}pt;
    }
    .job-company {
      font-size: ${layout.bodyFontSize}pt;
      font-style: ${pages === '2' ? 'normal' : 'italic'};
      font-weight: ${pages === '2' ? '500' : 'normal'};
    }
    .job-location {
      font-size: ${layout.bodyFontSize - 0.5}pt;
      color: #333;
    }
    .job-date {
      font-size: ${layout.bodyFontSize - 1}pt;
      white-space: nowrap;
      font-weight: ${pages === '2' ? '500' : 'normal'};
    }
    .responsibilities {
      margin-top: ${pages === '2' ? 3 : 4}pt;
      padding-left: ${pages === '2' ? 16 : 18}pt;
      list-style-position: outside;
    }
    .responsibilities li {
      font-size: ${layout.bulletFontSize}pt;
      line-height: ${layout.lineHeight};
      margin-bottom: ${layout.bulletMargin}pt;
      text-align: justify;
    }
    .responsibilities li:empty { display: none; }
    
    /* Skills */
    .skills {
      font-size: ${layout.bodyFontSize}pt;
      line-height: ${layout.skillsLineHeight};
    }
    .skills-category {
      margin-bottom: 4pt;
    }
    .skills-category-title {
      font-weight: bold;
    }
    .skills-list {
      font-size: ${layout.bodyFontSize}pt;
    }
    
    /* Skills Grid (for multi-page) */
    .skills-grid {
      display: flex;
      flex-wrap: wrap;
      gap: ${pages === '2' ? 5 : 6}pt;
      margin-top: ${pages === '2' ? 3 : 4}pt;
    }
    .skill-tag {
      background: ${pages === '2' ? 'transparent' : '#f5f5f5'};
      border: ${pages === '2' ? 'none' : '0.5pt solid #ddd'};
      padding: ${pages === '2' ? '2pt 6pt' : '3pt 8pt'};
      font-size: ${layout.bulletFontSize}pt;
      border-radius: ${pages === '2' ? '0' : '2pt'};
    }
    
    /* Highlights Section */
    .highlights-section {
      background: #fafafa;
      border: 0.5pt solid #e0e0e0;
      padding: 8pt;
      margin-bottom: ${layout.sectionMargin}pt;
    }
    .highlights-section .section-title {
      border-bottom: none;
      margin-bottom: 6pt;
    }
    .highlights-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6pt;
    }
    .highlight-item {
      font-size: ${layout.bulletFontSize}pt;
      line-height: ${layout.lineHeight};
      padding: 2pt 0;
    }
    
    /* Education */
    .education-item {
      margin-bottom: ${pages === '2' ? 5 : 6}pt;
    }
    .education-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: ${pages === '2' ? 1.5 : 2}pt;
    }
    .school {
      font-weight: bold;
      font-size: ${layout.bodyFontSize}pt;
    }
    .degree {
      font-size: ${layout.bodyFontSize}pt;
    }
    .edu-details {
      font-size: ${layout.bodyFontSize - 0.5}pt;
      color: #333;
      margin-top: 2pt;
    }
    .edu-date {
      font-size: ${layout.bodyFontSize - 1}pt;
    }
    .coursework {
      font-size: ${layout.bodyFontSize - 1}pt;
      color: #333;
      margin-top: 2pt;
    }
    
    /* Additional Sections */
    .cert-item, .project-item, .award-item, .pub-item {
      margin-bottom: 6pt;
    }
    .cert-name, .project-name, .award-name, .pub-title {
      font-weight: bold;
      font-size: ${layout.bodyFontSize}pt;
    }
    .cert-details, .project-details, .award-details, .pub-details {
      font-size: ${layout.bodyFontSize - 0.5}pt;
      color: #333;
    }
    .project-tech {
      font-size: ${layout.bodyFontSize - 1}pt;
      color: #444;
      font-style: italic;
      margin-top: 2pt;
    }
    
    /* Languages */
    .languages {
      font-size: ${layout.bodyFontSize}pt;
    }
    .language-item {
      display: inline;
    }
    .language-item:not(:last-child)::after {
      content: " • ";
    }
    
    /* Two-column layout for compact sections */
    .two-column {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8pt 16pt;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(name)}</h1>
    <div class="contact">
${[content.email, content.phone, content.location, content.linkedin, content.website].filter(Boolean).map(item => `      <span>${escapeHtml(item)}</span>`).join('')}
    </div>
  </div>
  
  ${summary ? `
  <div class="section">
    <div class="section-title">Professional Summary</div>
    <div class="summary">${escapeHtml(summary)}</div>
  </div>
  ` : ''}
  
  ${experiences.length > 0 ? `
  <div class="section">
    <div class="section-title">Professional Experience</div>
    ${experiences.map(exp => `
      <div class="experience-item">
        <div class="job-header">
          <div>
            <span class="job-title">${escapeHtml(exp.title || exp.jobTitle || '')}</span>
            ${exp.company || exp.companyName ? ` <span class="job-company">${pages === '2' ? '—' : '|'} ${escapeHtml(exp.company || exp.companyName)}</span>` : ''}
            ${exp.location ? ` <span class="job-location">${pages === '2' ? '•' : '|'} ${escapeHtml(exp.location)}</span>` : ''}
          </div>
          ${(exp.startDate || exp.endDate) ? `
            <span class="job-date">${exp.startDate || ''} ${pages === '2' ? '–' : '-'} ${exp.endDate || 'Present'}</span>
          ` : ''}
        </div>
        ${exp.responsibilities || exp.bullets ? `
          <ul class="responsibilities">
            ${safe(exp.responsibilities || exp.bullets).map(b => `<li>${escapeHtml(b)}</li>`).join('')}
          </ul>
        ` : ''}
      </div>
    `).join('')}
  </div>
  ` : ''}
  
  ${skills.length > 0 || skillCategories ? `
  <div class="section">
    <div class="section-title">Technical Skills</div>
    ${skillCategories && showExtras ? generateCategorizedSkills(skillCategories, safe, layout) : 
      useSkillsGrid ? generateSkillsGrid(skills, safe, layout) :
      `<div class="skills">${skills.map(s => escapeHtml(s)).join(' • ')}</div>`
    }
  </div>
  ` : ''}
  
  ${education.length > 0 ? `
  <div class="section">
    <div class="section-title">Education</div>
    ${education.map(edu => `
      <div class="education-item">
        <div class="education-header">
          <div>
            <span class="school">${escapeHtml(edu.school || edu.institution || '')}</span>
            ${edu.degree ? ` <span class="degree">${pages === '2' ? '—' : '—'} ${escapeHtml(edu.degree)}${edu.field ? ` in ${escapeHtml(edu.field)}` : ''}</span>` : ''}
          </div>
          ${edu.year || edu.graduationYear ? `
            <span class="edu-date">${escapeHtml(edu.year || edu.graduationYear)}</span>
          ` : ''}
        </div>
        ${(edu.gpa || edu.honors) && showExtras ? `
          <div class="edu-details">
            ${edu.gpa ? `GPA: ${escapeHtml(edu.gpa)}` : ''}${edu.gpa && edu.honors ? ' | ' : ''}${edu.honors ? escapeHtml(edu.honors) : ''}
          </div>
        ` : ''}
        ${edu.coursework && edu.coursework.length > 0 && showExtras ? `
          <div class="coursework">Relevant Coursework: ${safe(edu.coursework).map(c => escapeHtml(c)).join(', ')}</div>
        ` : ''}
      </div>
    `).join('')}
  </div>
  ` : ''}
  
  ${certifications.length > 0 && showExtras ? `
  <div class="section">
    <div class="section-title">Certifications</div>
    ${certifications.length > 3 ? `<div class="two-column">` : ''}
    ${certifications.map(cert => `
      <div class="cert-item">
        <span class="cert-name">${escapeHtml(cert.name)}</span>
        ${cert.issuer || cert.date ? `
          <span class="cert-details"> — ${[cert.issuer, cert.date].filter(Boolean).map(x => escapeHtml(x)).join(', ')}</span>
        ` : ''}
      </div>
    `).join('')}
    ${certifications.length > 3 ? `</div>` : ''}
  </div>
  ` : ''}
  
  ${projects.length > 0 ? `
  <div class="section">
    <div class="section-title">Projects</div>
    ${projects.map(proj => `
      <div class="project-item">
        <div class="project-name">${escapeHtml(proj.name)}</div>
        ${proj.description ? `<div class="project-details">${Array.isArray(proj.description) ? proj.description.map(d => escapeHtml(d)).join(' ') : escapeHtml(proj.description)}</div>` : ''}
        ${(proj.technologies || proj.skills) && (proj.technologies || proj.skills).length > 0 ? `
          <div class="project-tech">Technologies: ${safe(proj.technologies || proj.skills).map(t => escapeHtml(t)).join(', ')}</div>
        ` : ''}
      </div>
    `).join('')}
  </div>
  ` : ''}
  
  ${awards.length > 0 && showExtras ? `
  <div class="section">
    <div class="section-title">Awards & Honors</div>
    ${awards.map(award => `
      <div class="award-item">
        <span class="award-name">${escapeHtml(award.name)}</span>
        ${award.issuer || award.date ? `
          <span class="award-details"> — ${[award.issuer, award.date].filter(Boolean).map(x => escapeHtml(x)).join(', ')}</span>
        ` : ''}
        ${award.description ? `<div class="award-details">${escapeHtml(award.description)}</div>` : ''}
      </div>
    `).join('')}
  </div>
  ` : ''}
  
  ${publications.length > 0 && showExtras ? `
  <div class="section">
    <div class="section-title">Publications</div>
    ${publications.map(pub => `
      <div class="pub-item">
        <span class="pub-title">"${escapeHtml(pub.title)}"</span>
        ${pub.publisher || pub.date ? `
          <span class="pub-details"> — ${[pub.publisher, pub.date].filter(Boolean).map(x => escapeHtml(x)).join(', ')}</span>
        ` : ''}
      </div>
    `).join('')}
  </div>
  ` : ''}
  
  ${languages.length > 0 && showExtras ? `
  <div class="section">
    <div class="section-title">Languages</div>
    <div class="languages">
      ${languages.map(lang => `<span class="language-item">${escapeHtml(lang.language)}${lang.proficiency ? ` (${escapeHtml(lang.proficiency)})` : ''}</span>`).join('')}
    </div>
  </div>
  ` : ''}
</body>
</html>`;
}

function classicTemplate(name, content, safe, pages, layout) {
  const experiences = safe(content.experiences || content.experience);
  const skills = safe(content.skills);
  const skillCategories = content.skillCategories || null;
  const education = safe(content.education);
  const certifications = safe(content.certifications);
  const projects = safe(content.projects);
  const awards = safe(content.awards);
  const languages = safe(content.languages);
  const summary = content.summary || content.professionalSummary || '';
  const showExtras = pages !== '1';
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Resume - ${name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    @page {
      margin: ${layout.pageMargins.top}in ${layout.pageMargins.right}in ${layout.pageMargins.bottom}in ${layout.pageMargins.left}in;
      size: letter;
    }
    body {
      font-family: 'Times New Roman', serif;
      line-height: ${layout.lineHeight};
      color: #000;
      font-size: ${layout.bodyFontSize}pt;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #000;
      padding-bottom: 10px;
      margin-bottom: ${layout.headerMargin}pt;
    }
    .header h1 {
      font-size: ${layout.headerFontSize}pt;
      margin-bottom: 8px;
      font-weight: bold;
      text-transform: uppercase;
    }
    .contact-info {
      font-size: ${layout.contactFontSize}pt;
      color: #333;
    }
    .section {
      margin-bottom: ${layout.sectionMargin}pt;
    }
    .section-title {
      font-size: ${layout.sectionTitleSize}pt;
      font-weight: bold;
      margin-bottom: 8px;
      text-transform: uppercase;
      border-bottom: 1px solid #000;
      padding-bottom: 3px;
    }
    .experience-item {
      margin-bottom: ${layout.itemMargin}pt;
      page-break-inside: avoid;
    }
    .job-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 3px;
    }
    .job-title { font-weight: bold; font-size: ${layout.bodyFontSize}pt; }
    .company { font-style: italic; font-size: ${layout.bodyFontSize - 0.5}pt; }
    .job-date { font-size: ${layout.bodyFontSize - 1}pt; }
    .responsibilities {
      margin-top: 5px;
      padding-left: 20px;
      list-style-position: outside;
    }
    .responsibilities li {
      margin-bottom: ${layout.bulletMargin}pt;
      font-size: ${layout.bulletFontSize}pt;
      line-height: ${layout.lineHeight + 0.05};
    }
    .responsibilities li:empty { display: none; }
    .skills {
      font-size: ${layout.bodyFontSize}pt;
      line-height: ${layout.skillsLineHeight};
    }
    .skills-category { margin-bottom: ${4 * multiplier}pt; }
    .skills-category-title { font-weight: bold; }
    .education-item { margin-bottom: ${8 * multiplier}pt; }
    .education-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }
    .edu-details {
      font-size: ${layout.bodyFontSize - 1}pt;
      color: #333;
      margin-top: 2pt;
    }
    .cert-item, .project-item, .award-item { margin-bottom: 6pt; }
    .cert-name, .project-name, .award-name { font-weight: bold; }
    .cert-details, .project-details, .award-details {
      font-size: ${layout.bodyFontSize - 1}pt;
      color: #333;
    }
    .project-tech {
      font-size: ${layout.bodyFontSize - 1}pt;
      font-style: italic;
      color: #444;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(name)}</h1>
    <div class="contact-info">
${[content.email, content.phone, content.location, content.linkedin, content.website].filter(Boolean).map((item, i) => `${i > 0 ? ' | ' : ''}${escapeHtml(item)}`).join('')}
    </div>
  </div>
  
  ${summary ? `
  <div class="section">
    <div class="section-title">Professional Summary</div>
    <p style="text-align: justify; line-height: ${layout.summaryLineHeight};">${escapeHtml(summary)}</p>
  </div>
  ` : ''}
  
  ${experiences.length > 0 ? `
  <div class="section">
    <div class="section-title">Experience</div>
    ${experiences.map(exp => `
      <div class="experience-item">
        <div class="job-header">
          <div><span class="job-title">${escapeHtml(exp.title || exp.jobTitle || '')}</span></div>
          <span class="job-date">${exp.startDate || ''} - ${exp.endDate || 'Present'}</span>
        </div>
        <div class="company">${escapeHtml(exp.company || exp.companyName || '')}${exp.location ? `, ${escapeHtml(exp.location)}` : ''}</div>
        ${exp.responsibilities || exp.bullets ? `
          <ul class="responsibilities">
            ${safe(exp.responsibilities || exp.bullets).map(b => `<li>${escapeHtml(b)}</li>`).join('')}
          </ul>
        ` : ''}
      </div>
    `).join('')}
  </div>
  ` : ''}
  
  ${skills.length > 0 || skillCategories ? `
  <div class="section">
    <div class="section-title">Skills</div>
    ${skillCategories && showExtras ? generateCategorizedSkills(skillCategories, safe, layout) : 
      `<div class="skills">${skills.map(s => escapeHtml(s)).join(' • ')}</div>`}
  </div>
  ` : ''}
  
  ${education.length > 0 ? `
  <div class="section">
    <div class="section-title">Education</div>
    ${education.map(edu => `
      <div class="education-item">
        <div class="education-header">
          <div>
            <strong>${escapeHtml(edu.school || edu.institution || '')}</strong>
            ${edu.degree ? ` — ${escapeHtml(edu.degree)}${edu.field ? ` in ${escapeHtml(edu.field)}` : ''}` : ''}
          </div>
          ${edu.year || edu.graduationYear ? `<span>${escapeHtml(edu.year || edu.graduationYear)}</span>` : ''}
        </div>
        ${(edu.gpa || edu.honors) && showExtras ? `
          <div class="edu-details">${edu.gpa ? `GPA: ${escapeHtml(edu.gpa)}` : ''}${edu.gpa && edu.honors ? ' | ' : ''}${edu.honors || ''}</div>
        ` : ''}
        ${edu.coursework && edu.coursework.length > 0 && showExtras ? `
          <div class="edu-details">Relevant Coursework: ${safe(edu.coursework).map(c => escapeHtml(c)).join(', ')}</div>
        ` : ''}
      </div>
    `).join('')}
  </div>
  ` : ''}
  
  ${certifications.length > 0 && showExtras ? `
  <div class="section">
    <div class="section-title">Certifications</div>
    ${certifications.map(cert => `
      <div class="cert-item">
        <span class="cert-name">${escapeHtml(cert.name)}</span>
        ${cert.issuer || cert.date ? `<span class="cert-details"> — ${[cert.issuer, cert.date].filter(Boolean).map(x => escapeHtml(x)).join(', ')}</span>` : ''}
      </div>
    `).join('')}
  </div>
  ` : ''}
  
  ${projects.length > 0 ? `
  <div class="section">
    <div class="section-title">Projects</div>
    ${projects.map(proj => `
      <div class="project-item">
        <div class="project-name">${escapeHtml(proj.name)}</div>
        ${proj.description ? `<div class="project-details">${Array.isArray(proj.description) ? proj.description.map(d => escapeHtml(d)).join(' ') : escapeHtml(proj.description)}</div>` : ''}
        ${(proj.technologies || proj.skills) && (proj.technologies || proj.skills).length > 0 ? `<div class="project-tech">Technologies: ${safe(proj.technologies || proj.skills).map(t => escapeHtml(t)).join(', ')}</div>` : ''}
      </div>
    `).join('')}
  </div>
  ` : ''}
  
  ${awards.length > 0 && showExtras ? `
  <div class="section">
    <div class="section-title">Awards & Honors</div>
    ${awards.map(award => `
      <div class="award-item">
        <span class="award-name">${escapeHtml(award.name)}</span>
        ${award.issuer || award.date ? `<span class="award-details"> — ${[award.issuer, award.date].filter(Boolean).map(x => escapeHtml(x)).join(', ')}</span>` : ''}
        ${award.description ? `<div class="award-details">${escapeHtml(award.description)}</div>` : ''}
      </div>
    `).join('')}
  </div>
  ` : ''}
  
  ${languages.length > 0 && showExtras ? `
  <div class="section">
    <div class="section-title">Languages</div>
    <div>${languages.map(lang => `${escapeHtml(lang.language)}${lang.proficiency ? ` (${escapeHtml(lang.proficiency)})` : ''}`).join(' • ')}</div>
  </div>
  ` : ''}
</body>
</html>`;
}

function minimalTemplate(name, content, safe, pages, layout) {
  const experiences = safe(content.experiences || content.experience);
  const skills = safe(content.skills);
  const skillCategories = content.skillCategories || null;
  const education = safe(content.education);
  const certifications = safe(content.certifications);
  const projects = safe(content.projects);
  const awards = safe(content.awards);
  const languages = safe(content.languages);
  const summary = content.summary || content.professionalSummary || '';
  const showExtras = pages !== '1';
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Resume - ${name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    @page {
      margin: ${layout.pageMargins.top}in ${layout.pageMargins.right}in ${layout.pageMargins.bottom}in ${layout.pageMargins.left}in;
      size: letter;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      line-height: ${layout.lineHeight};
      color: #2d3748;
      font-size: ${layout.bodyFontSize}pt;
      background: #fff;
    }
    .header {
      margin-bottom: ${layout.headerMargin}pt;
      padding-bottom: 12pt;
      border-bottom: 1px solid #e2e8f0;
    }
    .header h1 {
      font-size: ${layout.headerFontSize}pt;
      font-weight: 300;
      color: #1a202c;
      margin-bottom: 8pt;
      letter-spacing: -0.5px;
    }
    .contact {
      font-size: ${layout.contactFontSize}pt;
      color: #718096;
    }
    .section {
      margin-bottom: ${layout.sectionMargin}pt;
    }
    .section-title {
      font-size: ${layout.sectionTitleSize}pt;
      font-weight: 600;
      color: #4a5568;
      margin-bottom: 10pt;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .summary {
      font-size: ${layout.bodyFontSize}pt;
      color: #4a5568;
      line-height: ${layout.summaryLineHeight};
    }
    .experience-item {
      margin-bottom: ${layout.itemMargin}pt;
      page-break-inside: avoid;
    }
    .job-header { margin-bottom: 6pt; }
    .job-title {
      font-size: ${layout.bodyFontSize + 0.5}pt;
      font-weight: 600;
      color: #2d3748;
    }
    .job-meta {
      font-size: ${layout.contactFontSize}pt;
      color: #718096;
      margin-top: 2pt;
    }
    .responsibilities {
      margin-top: 8pt;
      padding-left: 0;
      list-style: none;
    }
    .responsibilities li {
      font-size: ${layout.bulletFontSize}pt;
      color: #4a5568;
      margin-bottom: ${layout.bulletMargin}pt;
      padding-left: 15pt;
      position: relative;
      line-height: ${layout.lineHeight + 0.1};
    }
    .responsibilities li:empty { display: none; }
    .responsibilities li:before {
      content: '•';
      position: absolute;
      left: 0;
      color: #a0aec0;
    }
    .skills {
      font-size: ${layout.bodyFontSize}pt;
      color: #4a5568;
      line-height: ${layout.skillsLineHeight};
    }
    .skills-category { margin-bottom: ${6 * multiplier}pt; }
    .skills-category-title { font-weight: 600; color: #2d3748; }
    .education-item { margin-bottom: ${8 * multiplier}pt; }
    .school { font-weight: 600; color: #2d3748; }
    .edu-details {
      font-size: ${layout.bodyFontSize - 1}pt;
      color: #718096;
      margin-top: ${2 * multiplier}pt;
    }
    .cert-item, .project-item, .award-item { margin-bottom: ${8 * multiplier}pt; }
    .cert-name, .project-name, .award-name { font-weight: 600; color: #2d3748; }
    .cert-details, .project-details, .award-details {
      font-size: ${layout.bodyFontSize - 1}pt;
      color: #718096;
    }
    .project-tech {
      font-size: ${layout.bodyFontSize - 1}pt;
      color: #a0aec0;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(name)}</h1>
    <div class="contact">
${[content.email, content.phone, content.location, content.linkedin, content.website].filter(Boolean).map((item, i) => `${i > 0 ? ' · ' : ''}${escapeHtml(item)}`).join('')}
    </div>
  </div>
  
  ${summary ? `
  <div class="section">
    <div class="section-title">Summary</div>
    <div class="summary">${escapeHtml(summary)}</div>
  </div>
  ` : ''}
  
  ${experiences.length > 0 ? `
  <div class="section">
    <div class="section-title">Experience</div>
    ${experiences.map(exp => `
      <div class="experience-item">
        <div class="job-header">
          <div class="job-title">${escapeHtml(exp.title || exp.jobTitle || '')}</div>
          <div class="job-meta">
            ${escapeHtml(exp.company || exp.companyName || '')}
            ${exp.location ? ` · ${escapeHtml(exp.location)}` : ''}
            ${(exp.startDate || exp.endDate) ? ` · ${exp.startDate || ''} - ${exp.endDate || 'Present'}` : ''}
          </div>
        </div>
        ${exp.responsibilities || exp.bullets ? `
          <ul class="responsibilities">
            ${safe(exp.responsibilities || exp.bullets).map(b => `<li>${escapeHtml(b)}</li>`).join('')}
          </ul>
        ` : ''}
      </div>
    `).join('')}
  </div>
  ` : ''}
  
  ${skills.length > 0 || skillCategories ? `
  <div class="section">
    <div class="section-title">Skills</div>
    ${skillCategories && showExtras ? generateCategorizedSkills(skillCategories, safe, layout) :
      `<div class="skills">${skills.map(s => escapeHtml(s)).join(' · ')}</div>`}
  </div>
  ` : ''}
  
  ${education.length > 0 ? `
  <div class="section">
    <div class="section-title">Education</div>
    ${education.map(edu => `
      <div class="education-item">
        <div>
          <span class="school">${escapeHtml(edu.school || edu.institution || '')}</span>
          ${edu.degree ? ` · ${escapeHtml(edu.degree)}${edu.field ? ` in ${escapeHtml(edu.field)}` : ''}` : ''}
          ${edu.year || edu.graduationYear ? ` · ${escapeHtml(edu.year || edu.graduationYear)}` : ''}
        </div>
        ${(edu.gpa || edu.honors) && showExtras ? `
          <div class="edu-details">${edu.gpa ? `GPA: ${escapeHtml(edu.gpa)}` : ''}${edu.gpa && edu.honors ? ' · ' : ''}${edu.honors || ''}</div>
        ` : ''}
        ${edu.coursework && edu.coursework.length > 0 && showExtras ? `
          <div class="edu-details">Relevant Coursework: ${safe(edu.coursework).map(c => escapeHtml(c)).join(', ')}</div>
        ` : ''}
      </div>
    `).join('')}
  </div>
  ` : ''}
  
  ${certifications.length > 0 && showExtras ? `
  <div class="section">
    <div class="section-title">Certifications</div>
    ${certifications.map(cert => `
      <div class="cert-item">
        <span class="cert-name">${escapeHtml(cert.name)}</span>
        ${cert.issuer || cert.date ? `<span class="cert-details"> · ${[cert.issuer, cert.date].filter(Boolean).map(x => escapeHtml(x)).join(', ')}</span>` : ''}
      </div>
    `).join('')}
  </div>
  ` : ''}
  
  ${projects.length > 0 && showExtras ? `
  <div class="section">
    <div class="section-title">Projects</div>
    ${projects.map(proj => `
      <div class="project-item">
        <div class="project-name">${escapeHtml(proj.name)}</div>
        ${proj.description ? `<div class="project-details">${escapeHtml(proj.description)}</div>` : ''}
        ${proj.technologies && proj.technologies.length > 0 ? `<div class="project-tech">${safe(proj.technologies).map(t => escapeHtml(t)).join(' · ')}</div>` : ''}
      </div>
    `).join('')}
  </div>
  ` : ''}
  
  ${awards.length > 0 && showExtras ? `
  <div class="section">
    <div class="section-title">Awards</div>
    ${awards.map(award => `
      <div class="award-item">
        <span class="award-name">${escapeHtml(award.name)}</span>
        ${award.issuer || award.date ? `<span class="award-details"> · ${[award.issuer, award.date].filter(Boolean).map(x => escapeHtml(x)).join(', ')}</span>` : ''}
        ${award.description ? `<div class="award-details">${escapeHtml(award.description)}</div>` : ''}
      </div>
    `).join('')}
  </div>
  ` : ''}
  
  ${languages.length > 0 && showExtras ? `
  <div class="section">
    <div class="section-title">Languages</div>
    <div class="skills">${languages.map(lang => `${escapeHtml(lang.language)}${lang.proficiency ? ` (${escapeHtml(lang.proficiency)})` : ''}`).join(' · ')}</div>
  </div>
  ` : ''}
</body>
</html>`;
}

// Reference template - matches exact layout from provided resume PDF
function referenceTemplate(name, content, safe, pages, layout) {
  const experiences = safe(content.experiences || content.experience);
  const skills = safe(content.skills);
  const skillCategories = content.skillCategories || null;
  const education = safe(content.education);
  const projects = safe(content.projects);
  const objective = content.summary || content.objective || '';
  
  // Build contact info with | separators
  const contactParts = [
    content.location,
    content.phone,
    content.email,
    content.website
  ].filter(Boolean);
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Resume - ${name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      white-space: normal;
    }
    @page { 
      margin: ${layout.pageMargins.top}in ${layout.pageMargins.right}in ${layout.pageMargins.bottom}in ${layout.pageMargins.left}in;
      size: letter; 
    }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: ${layout.bodyFontSize}pt;
      line-height: ${layout.lineHeight};
      color: #000;
      background: #fff;
    }
    
    /* Header */
    .header {
      text-align: center;
      margin-bottom: ${layout.headerMargin}pt;
    }
    .header h1 {
      font-size: ${layout.headerFontSize}pt;
      font-weight: bold;
      margin-bottom: 4pt;
      text-transform: none;
      letter-spacing: 0;
    }
    .contact {
      font-size: ${layout.contactFontSize}pt;
      line-height: 1.4;
    }
    .contact span:not(:last-child)::after {
      content: " | ";
    }
    
    /* Sections */
    .section {
      margin-bottom: ${layout.sectionMargin}pt;
      page-break-inside: avoid;
    }
    /* For 2-page resumes: Education must end on page 1 */
    .education-section {
      page-break-after: ${pages === '2' ? 'always' : 'auto'};
      page-break-inside: avoid;
    }
    .section-title {
      font-size: ${layout.sectionTitleSize}pt;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 3pt;
      border-bottom: 1pt solid #000;
      padding-bottom: 1.5pt;
      letter-spacing: 0;
    }
    
    /* Objective */
    .objective {
      font-size: ${layout.bodyFontSize}pt;
      line-height: ${layout.summaryLineHeight};
      text-align: left;
      margin-bottom: 0;
    }
    
    /* Experience */
    .experience-item {
      margin-bottom: ${layout.itemMargin}pt;
      page-break-inside: avoid;
    }
    .exp-company-line {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 1.5pt;
    }
    .exp-company {
      font-size: ${layout.bodyFontSize}pt;
      font-weight: normal;
    }
    .exp-date {
      font-size: ${layout.bodyFontSize}pt;
      white-space: nowrap;
    }
    .exp-title {
      font-weight: bold;
      font-size: ${layout.bodyFontSize}pt;
      margin-bottom: 1.5pt;
    }
    .exp-website {
      font-size: ${layout.bodyFontSize - 0.5}pt;
      color: #333;
      margin-bottom: 1.5pt;
    }
    .exp-bullets {
      margin-top: 2pt;
      padding-left: 18pt;
      list-style-position: outside;
      margin-left: 0;
    }
    .exp-bullets li {
      font-size: ${layout.bulletFontSize}pt;
      line-height: ${layout.lineHeight};
      margin-bottom: ${layout.bulletMargin}pt;
      padding-left: 0;
      text-indent: 0;
    }
    .exp-bullets li:empty { display: none; }
    
    /* Education */
    .education-item {
      margin-bottom: ${layout.itemMargin}pt;
    }
    .edu-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 1.5pt;
    }
    .edu-school {
      font-weight: bold;
      font-size: ${layout.bodyFontSize}pt;
    }
    .edu-date {
      font-size: ${layout.bodyFontSize}pt;
      white-space: nowrap;
    }
    .edu-degree {
      font-size: ${layout.bodyFontSize}pt;
      margin-bottom: 1.5pt;
    }
    .edu-coursework {
      margin-top: 2pt;
      padding-left: 18pt;
      font-size: ${layout.bulletFontSize}pt;
      line-height: ${layout.lineHeight};
    }
    
    /* Skills */
    .skills-category {
      margin-bottom: 3pt;
    }
    .skills-category-title {
      font-weight: bold;
      font-size: ${layout.bodyFontSize}pt;
    }
    .skills-list {
      font-size: ${layout.bodyFontSize}pt;
      margin-left: 2pt;
    }
    
    /* Projects */
    .project-item {
      margin-bottom: ${layout.itemMargin}pt;
    }
    .project-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 1.5pt;
    }
    .project-meta {
      font-size: ${layout.bodyFontSize}pt;
    }
    .project-date {
      font-size: ${layout.bodyFontSize}pt;
      white-space: nowrap;
    }
    .project-name {
      font-weight: bold;
      font-size: ${layout.bodyFontSize}pt;
      margin-bottom: 1.5pt;
    }
    .project-bullets {
      margin-top: 2pt;
      padding-left: 18pt;
      list-style-position: outside;
      margin-left: 0;
    }
    .project-bullets li {
      font-size: ${layout.bulletFontSize}pt;
      line-height: ${layout.lineHeight};
      margin-bottom: ${layout.bulletMargin}pt;
      padding-left: 0;
      text-indent: 0;
    }
    .project-bullets li:empty { display: none; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(name)}</h1>
    <div class="contact">
      ${contactParts.map(part => `<span>${escapeHtml(part)}</span>`).join('')}
    </div>
  </div>
  
  ${objective ? `
  <div class="section">
    <div class="section-title">OBJECTIVE</div>
    <div class="objective">${escapeHtml(objective)}</div>
  </div>
  ` : ''}
  
  ${experiences.length > 0 ? `
  <div class="section">
    <div class="section-title">EXPERIENCE</div>
    ${experiences.map(exp => `
      <div class="experience-item">
        <div class="exp-company-line">
          <div class="exp-company">
            ${escapeHtml(exp.company || exp.companyName || '')}${exp.location ? `, ${escapeHtml(exp.location)}` : ''}
          </div>
          ${(exp.startDate || exp.endDate) ? `
            <span class="exp-date">${exp.startDate || ''} ${exp.endDate === 'Present' ? '- Present' : exp.endDate ? ` - ${escapeHtml(exp.endDate)}` : ''}</span>
          ` : ''}
        </div>
        <div class="exp-title">${escapeHtml(exp.title || exp.jobTitle || '')}</div>
        ${exp.website ? `<div class="exp-website">${escapeHtml(exp.website)}</div>` : ''}
        ${exp.responsibilities || exp.bullets ? `
          <ul class="exp-bullets">
            ${safe(exp.responsibilities || exp.bullets).map(b => `<li>${escapeHtml(b)}</li>`).join('')}
          </ul>
        ` : ''}
      </div>
    `).join('')}
  </div>
  ` : ''}
  
  ${education.length > 0 ? `
  <div class="section education-section">
    <div class="section-title">EDUCATION</div>
    ${education.map(edu => `
      <div class="education-item">
        <div class="edu-header">
          <div class="edu-school">${escapeHtml(edu.school || edu.institution || '')}</div>
          ${edu.year || edu.graduationYear ? `
            <span class="edu-date">Expected Graduation: ${escapeHtml(edu.year || edu.graduationYear)}</span>
          ` : ''}
        </div>
        ${edu.degree ? `<div class="edu-degree">${escapeHtml(edu.degree)}${edu.field ? ` in ${escapeHtml(edu.field)}` : ''}</div>` : ''}
        ${(edu.coursework || edu.relevantCoursework) ? `
          <div class="edu-coursework">Relevant coursework: ${Array.isArray(edu.coursework || edu.relevantCoursework) 
            ? safe(edu.coursework || edu.relevantCoursework).map(c => escapeHtml(c)).join(', ')
            : escapeHtml(edu.coursework || edu.relevantCoursework)}</div>
        ` : ''}
      </div>
    `).join('')}
  </div>
  ` : ''}
  
  ${skills.length > 0 || skillCategories ? `
  <div class="section">
    <div class="section-title">SKILLS</div>
    ${skillCategories ? Object.entries(skillCategories).map(([category, categorySkills]) => `
      <div class="skills-category">
        <span class="skills-category-title">${escapeHtml(category)}:</span>
        <span class="skills-list">${safe(categorySkills).map(s => escapeHtml(s)).join(', ')}</span>
      </div>
    `).join('') : `
      <div class="skills-list">${skills.map(s => escapeHtml(s)).join(', ')}</div>
    `}
  </div>
  ` : ''}
  
  ${projects.length > 0 ? `
  <div class="section">
    <div class="section-title">Projects</div>
    ${projects.map(proj => `
      <div class="project-item">
        <div class="project-header">
          <div class="project-meta">
            ${(proj.technologies || proj.skills || []).length > 0 ? safe(proj.technologies || proj.skills).map(t => escapeHtml(t)).join(', ') : ''}
          </div>
          ${proj.date ? `<span class="project-date">${escapeHtml(proj.date)}</span>` : ''}
        </div>
        <div class="project-name">${escapeHtml(proj.name)}</div>
        ${proj.description ? `
          <ul class="project-bullets">
            ${Array.isArray(proj.description) 
              ? safe(proj.description).map(d => `<li>${escapeHtml(d)}</li>`).join('')
              : `<li>${escapeHtml(proj.description)}</li>`
            }
          </ul>
        ` : ''}
      </div>
    `).join('')}
  </div>
  ` : ''}
</body>
</html>`;
}


export { getLayout, DENSITY_MULTIPLIERS };
