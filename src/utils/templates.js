// Professional resume templates

export function renderResumeTemplate(name, content, templateName = 'modern') {
  const safe = (x) => (Array.isArray(x) ? x : [x]).filter(Boolean);
  
  const templates = {
    modern: modernTemplate,
    classic: classicTemplate,
    minimal: minimalTemplate,
  };
  
  const template = templates[templateName] || templates.modern;
  return template(name, content, safe);
}

function modernTemplate(name, content, safe) {
  const experiences = safe(content.experiences || content.experience);
  const skills = safe(content.skills);
  const education = safe(content.education);
  const summary = content.summary || content.professionalSummary || '';
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Resume - ${name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { 
      margin-top: 0.4in;
      margin-bottom: 0.5in;
      margin-left: 0.75in;
      margin-right: 0.75in;
      size: letter; 
    }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      line-height: 1.4;
      color: #000;
      background: #fff;
      margin: 0;
      padding: 0;
    }
    
    /* Header - Simple and clean */
    .header {
      text-align: center;
      margin-bottom: 12pt;
      margin-top: 0;
      border-bottom: 2pt solid #000;
      padding-bottom: 8pt;
    }
    .header h1 {
      font-size: 18pt;
      font-weight: bold;
      margin-bottom: 8pt;
      text-transform: uppercase;
      letter-spacing: 1pt;
    }
    .contact {
      font-size: 10pt;
      line-height: 1.6;
    }
    .contact span {
      margin: 0 8pt;
    }
    
    /* Sections */
    .section {
      margin-bottom: 16pt;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 12pt;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 8pt;
      border-bottom: 1pt solid #000;
      padding-bottom: 3pt;
    }
    
    /* Summary */
    .summary {
      font-size: 11pt;
      line-height: 1.5;
      text-align: justify;
    }
    
    /* Experience */
    .experience-item {
      margin-bottom: 12pt;
      page-break-inside: avoid;
    }
    .job-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4pt;
    }
    .job-title {
      font-weight: bold;
      font-size: 11pt;
    }
    .job-company {
      font-size: 11pt;
      font-style: italic;
    }
    .job-date {
      font-size: 10pt;
      white-space: nowrap;
    }
    .responsibilities {
      margin-top: 6pt;
      padding-left: 20pt;
    }
    .responsibilities li {
      font-size: 10pt;
      line-height: 1.4;
      margin-bottom: 3pt;
    }
    
    /* Skills - Simple comma separated */
    .skills {
      font-size: 11pt;
      line-height: 1.6;
    }
    
    /* Education */
    .education-item {
      margin-bottom: 8pt;
    }
    .education-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 2pt;
    }
    .school {
      font-weight: bold;
      font-size: 11pt;
    }
    .degree {
      font-size: 11pt;
    }
    .edu-date {
      font-size: 10pt;
      white-space: nowrap;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(name)}</h1>
    <div class="contact">
      ${content.email ? `<span>${escapeHtml(content.email)}</span>` : ''}
      ${content.phone ? `<span>${escapeHtml(content.phone)}</span>` : ''}
      ${content.location ? `<span>${escapeHtml(content.location)}</span>` : ''}
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
            ${exp.company || exp.companyName ? ` <span class="job-company">${escapeHtml(exp.company || exp.companyName)}</span>` : ''}
          </div>
          ${(exp.startDate || exp.endDate) ? `
            <span class="job-date">${exp.startDate || ''} ${exp.endDate ? ' - ' + exp.endDate : 'Present'}</span>
          ` : ''}
        </div>
        ${exp.responsibilities || exp.bullets ? `
          <ul class="responsibilities">
            ${safe(exp.responsibilities || exp.bullets).map(b => `
              <li>${escapeHtml(b)}</li>
            `).join('')}
          </ul>
        ` : ''}
      </div>
    `).join('')}
  </div>
  ` : ''}
  
  ${skills.length > 0 ? `
  <div class="section">
    <div class="section-title">Technical Skills</div>
    <div class="skills">${skills.map(s => escapeHtml(s)).join(', ')}</div>
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
            ${edu.degree ? ` <span class="degree">- ${escapeHtml(edu.degree)}</span>` : ''}
          </div>
          ${edu.year || edu.graduationYear ? `
            <span class="edu-date">${escapeHtml(edu.year || edu.graduationYear)}</span>
          ` : ''}
        </div>
      </div>
    `).join('')}
  </div>
  ` : ''}
</body>
</html>`;
}

function classicTemplate(name, content, safe) {
  const experiences = safe(content.experiences || content.experience);
  const skills = safe(content.skills);
  const education = safe(content.education);
  const summary = content.summary || content.professionalSummary || '';
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Resume - ${name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page {
      margin-top: 0.4in;
      margin-bottom: 0.5in;
      margin-left: 0.75in;
      margin-right: 0.75in;
      size: letter;
    }
    body {
      font-family: 'Times New Roman', serif;
      line-height: 1.6;
      color: #000;
      padding: 0;
      margin: 0;
      font-size: 12px;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #000;
      padding-bottom: 12px;
      margin-bottom: 15px;
      margin-top: 0;
    }
    .header h1 {
      font-size: 24px;
      margin-bottom: 10px;
      font-weight: bold;
      text-transform: uppercase;
    }
    .contact-info {
      font-size: 11px;
      color: #333;
    }
    .section {
      margin-bottom: 20px;
    }
    .section-title {
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 10px;
      text-transform: uppercase;
      border-bottom: 1px solid #000;
      padding-bottom: 3px;
    }
    .experience-item {
      margin-bottom: 15px;
    }
    .job-title {
      font-weight: bold;
      font-size: 12px;
    }
    .company {
      font-style: italic;
      font-size: 11px;
    }
    .responsibilities {
      margin-top: 5px;
      padding-left: 20px;
    }
    .responsibilities li {
      margin-bottom: 3px;
      font-size: 11px;
    }
    .skills {
      font-size: 11px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(name)}</h1>
    <div class="contact-info">
      ${content.email ? `${escapeHtml(content.email)}` : ''}
      ${content.phone ? ` | ${escapeHtml(content.phone)}` : ''}
      ${content.location ? ` | ${escapeHtml(content.location)}` : ''}
    </div>
  </div>
  
  ${summary ? `
  <div class="section">
    <div class="section-title">Objective</div>
    <p style="text-align: justify;">${escapeHtml(summary)}</p>
  </div>
  ` : ''}
  
  ${experiences.length > 0 ? `
  <div class="section">
    <div class="section-title">Experience</div>
    ${experiences.map(exp => `
      <div class="experience-item">
        <div class="job-title">${escapeHtml(exp.title || exp.jobTitle || '')}</div>
        <div class="company">${escapeHtml(exp.company || exp.companyName || '')} ${exp.startDate || exp.endDate ? `(${exp.startDate || ''} - ${exp.endDate || 'Present'})` : ''}</div>
        ${exp.responsibilities || exp.bullets ? `
          <ul class="responsibilities">
            ${safe(exp.responsibilities || exp.bullets).map(b => `<li>${escapeHtml(b)}</li>`).join('')}
          </ul>
        ` : ''}
      </div>
    `).join('')}
  </div>
  ` : ''}
  
  ${skills.length > 0 ? `
  <div class="section">
    <div class="section-title">Skills</div>
    <div class="skills">${skills.map(s => escapeHtml(s)).join(', ')}</div>
  </div>
  ` : ''}
  
  ${education.length > 0 ? `
  <div class="section">
    <div class="section-title">Education</div>
    ${education.map(edu => `
      <div>
        <strong>${escapeHtml(edu.school || edu.institution || '')}</strong>
        ${edu.degree ? ` - ${escapeHtml(edu.degree)}` : ''}
        ${edu.year || edu.graduationYear ? ` (${escapeHtml(edu.year || edu.graduationYear)})` : ''}
      </div>
    `).join('')}
  </div>
  ` : ''}
</body>
</html>`;
}

function minimalTemplate(name, content, safe) {
  const experiences = safe(content.experiences || content.experience);
  const skills = safe(content.skills);
  const education = safe(content.education);
  const summary = content.summary || content.professionalSummary || '';
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Resume - ${name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page {
      margin-top: 0.4in;
      margin-bottom: 0.5in;
      margin-left: 0.75in;
      margin-right: 0.75in;
      size: letter;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      line-height: 1.8;
      color: #2d3748;
      padding: 0;
      margin: 0;
      font-size: 11px;
      background: #fafafa;
    }
    .container {
      background: white;
      padding: 30px 50px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header {
      margin-bottom: 20px;
      padding-bottom: 15px;
      margin-top: 0;
      border-bottom: 1px solid #e2e8f0;
    }
    .header h1 {
      font-size: 32px;
      font-weight: 300;
      color: #1a202c;
      margin-bottom: 10px;
      letter-spacing: -0.5px;
    }
    .contact {
      font-size: 10px;
      color: #718096;
    }
    .section {
      margin-bottom: 30px;
    }
    .section-title {
      font-size: 12px;
      font-weight: 600;
      color: #4a5568;
      margin-bottom: 15px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .summary {
      font-size: 11px;
      color: #4a5568;
      line-height: 1.8;
    }
    .experience-item {
      margin-bottom: 20px;
    }
    .job-header {
      margin-bottom: 8px;
    }
    .job-title {
      font-size: 12px;
      font-weight: 600;
      color: #2d3748;
    }
    .job-meta {
      font-size: 10px;
      color: #718096;
      margin-top: 2px;
    }
    .responsibilities {
      margin-top: 10px;
      padding-left: 0;
      list-style: none;
    }
    .responsibilities li {
      font-size: 10px;
      color: #4a5568;
      margin-bottom: 6px;
      padding-left: 15px;
      position: relative;
    }
    .responsibilities li:before {
      content: '•';
      position: absolute;
      left: 0;
      color: #cbd5e0;
    }
    .skills {
      font-size: 10px;
      color: #4a5568;
      line-height: 2;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${escapeHtml(name)}</h1>
      <div class="contact">
        ${content.email ? `${escapeHtml(content.email)}` : ''}
        ${content.phone ? ` · ${escapeHtml(content.phone)}` : ''}
        ${content.location ? ` · ${escapeHtml(content.location)}` : ''}
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
              ${(exp.startDate || exp.endDate) ? ` · ${exp.startDate || ''} - ${exp.endDate || 'Present'}` : ''}
            </div>
          </div>
          ${exp.responsibilities || exp.bullets ? `
            <ul class="responsibilities">
              ${safe(exp.responsibilities || exp.bullets).map(b => `
                <li>${escapeHtml(b)}</li>
              `).join('')}
            </ul>
          ` : ''}
        </div>
      `).join('')}
    </div>
    ` : ''}
    
    ${skills.length > 0 ? `
    <div class="section">
      <div class="section-title">Skills</div>
      <div class="skills">${skills.map(s => escapeHtml(s)).join(' · ')}</div>
    </div>
    ` : ''}
    
    ${education.length > 0 ? `
    <div class="section">
      <div class="section-title">Education</div>
      ${education.map(edu => `
        <div class="job-meta" style="margin-bottom: 8px;">
          <strong>${escapeHtml(edu.school || edu.institution || '')}</strong>
          ${edu.degree ? ` · ${escapeHtml(edu.degree)}` : ''}
          ${edu.year || edu.graduationYear ? ` · ${escapeHtml(edu.year || edu.graduationYear)}` : ''}
        </div>
      `).join('')}
    </div>
    ` : ''}
  </div>
</body>
</html>`;
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

