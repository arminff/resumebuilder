/**
 * LaTeX-based resume rendering and PDF compilation.
 *
 * Replaces the old HTML-template + Puppeteer pipeline with:
 *   normalized content → .tex string → pdflatex → PDF buffer
 */

import { writeFileSync, readFileSync, mkdtempSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execFileSync } from 'child_process';

// ---------------------------------------------------------------------------
// LaTeX escaping
// ---------------------------------------------------------------------------

/**
 * Escape special LaTeX characters in plain-text user content.
 * Order matters: backslash must be first so that replacements introducing
 * backslashes (like \&) are not re-escaped.
 */
export function escapeLatex(text) {
  if (!text) return '';
  return String(text)
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const safe = (x) => (Array.isArray(x) ? x : x ? [x] : []).filter(Boolean);

function buildContactLine(content, sep) {
  return [content.email, content.phone, content.location, content.linkedin, content.website]
    .filter(Boolean)
    .map((p) => escapeLatex(p))
    .join(sep);
}

/** Page-count → margin map (inches). Tighter for 1-page, roomier for multi. */
const MARGINS = {
  '1': '0.5in',
  '2': '0.6in',
  '3': '0.7in',
};

// ---------------------------------------------------------------------------
// Section generators (shared across templates; style differs via preamble)
// ---------------------------------------------------------------------------

function sectionSummary(summary) {
  if (!summary) return '';
  return `\\section{PROFESSIONAL SUMMARY}\n${escapeLatex(summary)}\n\n`;
}

function sectionExperience(content, expStyle = 'modern') {
  const experiences = safe(content.experiences || content.experience);
  if (experiences.length === 0) return '';

  let tex = '\\section{PROFESSIONAL EXPERIENCE}\n';

  for (const exp of experiences) {
    const title = escapeLatex(exp.title || exp.jobTitle || '');
    const company = escapeLatex(exp.company || exp.companyName || '');
    const location = exp.location ? escapeLatex(exp.location) : '';
    const start = escapeLatex(exp.startDate || '');
    const end = escapeLatex(exp.endDate || 'Present');
    const dateRange = `${start} -- ${end}`;

    if (expStyle === 'minimal') {
      tex += `\\textbf{${title}}\\\\\n`;
      const meta = [company, location, dateRange].filter(Boolean).join(' $\\cdot$ ');
      tex += `{\\small ${meta}}\n`;
    } else {
      tex += `\\textbf{${title}} \\hfill ${dateRange}\\\\\n`;
      if (company) tex += `\\textit{${company}}`;
      if (company && location) tex += `, ${location}`;
      else if (location) tex += location;
      tex += '\n';
    }

    const bullets = safe(exp.responsibilities || exp.bullets);
    if (bullets.length > 0) {
      tex += '\\begin{itemize}[leftmargin=18pt, topsep=2pt, itemsep=1pt, parsep=0pt]\n';
      for (const b of bullets) {
        if (b) tex += `  \\item ${escapeLatex(b)}\n`;
      }
      tex += '\\end{itemize}\n';
    }
    tex += '\\vspace{2pt}\n';
  }
  return tex + '\n';
}

function sectionSkills(content) {
  const skills = safe(content.skills);
  const categories = content.skillCategories;
  if (skills.length === 0 && !categories) return '';

  let tex = '\\section{TECHNICAL SKILLS}\n';

  if (categories && typeof categories === 'object') {
    for (const [cat, items] of Object.entries(categories)) {
      tex += `\\textbf{${escapeLatex(cat)}:} ${safe(items).map((s) => escapeLatex(s)).join(', ')}\\\\\n`;
    }
  } else {
    tex += skills.map((s) => escapeLatex(s)).join(' \\textbullet{} ') + '\n';
  }
  return tex + '\n';
}

function sectionEducation(content) {
  const education = safe(content.education);
  if (education.length === 0) return '';

  let tex = '\\section{EDUCATION}\n';

  for (const edu of education) {
    const school = escapeLatex(edu.school || edu.institution || '');
    const degree = edu.degree ? escapeLatex(edu.degree) : '';
    const field = edu.field ? escapeLatex(edu.field) : '';
    const year = escapeLatex(edu.year || edu.graduationYear || '');

    tex += `\\textbf{${school}}`;
    if (degree) tex += ` --- ${degree}${field ? ` in ${field}` : ''}`;
    if (year) tex += ` \\hfill ${year}`;
    tex += '\\\\\n';

    const coursework = safe(edu.coursework || edu.relevantCoursework);
    if (coursework.length > 0) {
      tex += `{\\small Relevant Coursework: ${coursework.map((c) => escapeLatex(c)).join(', ')}}\\\\\n`;
    }
    if (edu.gpa) tex += `{\\small GPA: ${escapeLatex(edu.gpa)}}\\\\\n`;
    tex += '\\vspace{2pt}\n';
  }
  return tex + '\n';
}

function sectionProjects(content) {
  const projects = safe(content.projects);
  if (projects.length === 0) return '';

  let tex = '\\section{PROJECTS}\n';

  for (const proj of projects) {
    const name = escapeLatex(proj.name || '');
    const techs = safe(proj.technologies || proj.skills);

    tex += `\\textbf{${name}}`;
    if (techs.length > 0) tex += ` | {\\small\\textit{${techs.map((t) => escapeLatex(t)).join(', ')}}}`;
    if (proj.date) tex += ` \\hfill ${escapeLatex(proj.date)}`;
    tex += '\\\\\n';

    const descriptions = safe(proj.description);
    if (descriptions.length > 0) {
      tex += '\\begin{itemize}[leftmargin=18pt, topsep=2pt, itemsep=1pt, parsep=0pt]\n';
      for (const d of descriptions) {
        if (d) tex += `  \\item ${escapeLatex(d)}\n`;
      }
      tex += '\\end{itemize}\n';
    }
    tex += '\\vspace{2pt}\n';
  }
  return tex + '\n';
}

function sectionCertifications(content) {
  const certs = safe(content.certifications);
  if (certs.length === 0) return '';

  let tex = '\\section{CERTIFICATIONS}\n';
  for (const cert of certs) {
    tex += `\\textbf{${escapeLatex(cert.name)}}`;
    if (cert.issuer) tex += ` --- ${escapeLatex(cert.issuer)}`;
    if (cert.date) tex += ` \\hfill ${escapeLatex(cert.date)}`;
    tex += '\\\\\n';
  }
  return tex + '\n';
}

function sectionAwards(content) {
  const awards = safe(content.awards);
  if (awards.length === 0) return '';

  let tex = '\\section{AWARDS \\& HONORS}\n';
  for (const award of awards) {
    tex += `\\textbf{${escapeLatex(award.name)}}`;
    if (award.issuer) tex += ` --- ${escapeLatex(award.issuer)}`;
    if (award.date) tex += ` \\hfill ${escapeLatex(award.date)}`;
    tex += '\\\\\n';
    if (award.description) tex += `${escapeLatex(award.description)}\\\\\n`;
  }
  return tex + '\n';
}

function sectionLanguages(content) {
  const langs = safe(content.languages);
  if (langs.length === 0) return '';

  let tex = '\\section{LANGUAGES}\n';
  tex +=
    langs
      .map((l) => {
        let s = escapeLatex(l.language);
        if (l.proficiency) s += ` (${escapeLatex(l.proficiency)})`;
        return s;
      })
      .join(' \\textbullet{} ') + '\n';
  return tex + '\n';
}

function sectionPublications(content) {
  const pubs = safe(content.publications);
  if (pubs.length === 0) return '';

  let tex = '\\section{PUBLICATIONS}\n';
  for (const pub of pubs) {
    tex += `\\textit{${escapeLatex(pub.title)}}`;
    if (pub.publisher) tex += ` --- ${escapeLatex(pub.publisher)}`;
    if (pub.date) tex += ` \\hfill ${escapeLatex(pub.date)}`;
    tex += '\\\\\n';
  }
  return tex + '\n';
}

// ---------------------------------------------------------------------------
// Template: Modern  (Latin Modern serif, clean rules, ATS-friendly)
// ---------------------------------------------------------------------------

function modernTemplate(name, content, pages) {
  const margin = MARGINS[pages] || MARGINS['1'];
  const contactLine = buildContactLine(content, ' \\textbullet{} ');
  const summary = content.summary || content.professionalSummary || '';

  return `\\documentclass[10.5pt,letterpaper]{article}

\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{lmodern}
\\usepackage[top=${margin},bottom=${margin},left=${margin},right=${margin}]{geometry}
\\usepackage{enumitem}
\\usepackage{titlesec}
\\usepackage[hidelinks]{hyperref}

\\pagestyle{empty}
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{0pt}

% Section: bold, rule below
\\titleformat{\\section}{\\large\\bfseries\\raggedright}{}{0em}{}[\\vspace{-6pt}\\titlerule]
\\titlespacing*{\\section}{0pt}{8pt}{4pt}

\\begin{document}

% --- Header ---
\\begin{center}
{\\LARGE\\bfseries ${escapeLatex(name)}}\\\\[4pt]
{\\small ${contactLine}}
\\end{center}
\\vspace{2pt}

${sectionSummary(summary)}${sectionExperience(content, 'modern')}${sectionSkills(content)}${sectionEducation(content)}${sectionProjects(content)}${sectionCertifications(content)}${sectionAwards(content)}${sectionLanguages(content)}${sectionPublications(content)}\\end{document}
`;
}

// ---------------------------------------------------------------------------
// Template: Classic  (Times-like serif, traditional dense layout)
// ---------------------------------------------------------------------------

function classicTemplate(name, content, pages) {
  const margin = MARGINS[pages] || MARGINS['1'];
  const contactLine = buildContactLine(content, ' | ');
  const summary = content.summary || content.professionalSummary || '';

  return `\\documentclass[10.5pt,letterpaper]{article}

\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{mathptmx}
\\usepackage[top=${margin},bottom=${margin},left=${margin},right=${margin}]{geometry}
\\usepackage{enumitem}
\\usepackage{titlesec}
\\usepackage[hidelinks]{hyperref}

\\pagestyle{empty}
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{0pt}

% Section: bold with thicker rule
\\titleformat{\\section}{\\normalsize\\bfseries}{}{0em}{}[\\titlerule]
\\titlespacing*{\\section}{0pt}{8pt}{4pt}

\\begin{document}

% --- Header ---
\\begin{center}
{\\LARGE\\bfseries ${escapeLatex(name)}}\\\\[2pt]
{\\small ${contactLine}}
\\end{center}
\\vspace{-2pt}
\\noindent\\rule{\\textwidth}{1.2pt}
\\vspace{6pt}

${sectionSummary(summary)}${sectionExperience(content, 'classic')}${sectionSkills(content)}${sectionEducation(content)}${sectionProjects(content)}${sectionCertifications(content)}${sectionAwards(content)}${sectionLanguages(content)}${sectionPublications(content)}\\end{document}
`;
}

// ---------------------------------------------------------------------------
// Template: Minimal  (Sans-serif, clean, airy)
// ---------------------------------------------------------------------------

function minimalTemplate(name, content, pages) {
  const margin = MARGINS[pages] || MARGINS['1'];
  const contactLine = buildContactLine(content, ' $\\cdot$ ');
  const summary = content.summary || content.professionalSummary || '';

  return `\\documentclass[10pt,letterpaper]{article}

\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{lmodern}
\\renewcommand{\\familydefault}{\\sfdefault}
\\usepackage[top=${margin},bottom=${margin},left=${margin},right=${margin}]{geometry}
\\usepackage{enumitem}
\\usepackage{titlesec}
\\usepackage[hidelinks]{hyperref}

\\pagestyle{empty}
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{0pt}

% Section: bold, thin rule
\\titleformat{\\section}{\\normalsize\\bfseries\\raggedright}{}{0em}{}[\\vspace{-6pt}\\titlerule[0.4pt]]
\\titlespacing*{\\section}{0pt}{10pt}{5pt}

\\begin{document}

% --- Header ---
{\\LARGE ${escapeLatex(name)}}\\\\[4pt]
{\\small ${contactLine}}
\\vspace{8pt}

${sectionSummary(summary)}${sectionExperience(content, 'minimal')}${sectionSkills(content)}${sectionEducation(content)}${sectionProjects(content)}${sectionCertifications(content)}${sectionAwards(content)}${sectionLanguages(content)}${sectionPublications(content)}\\end{document}
`;
}

// ---------------------------------------------------------------------------
// Public: render template
// ---------------------------------------------------------------------------

export function renderResumeLatex(name, content, templateName = 'modern', pages = '1') {
  const templates = { modern: modernTemplate, classic: classicTemplate, minimal: minimalTemplate };
  const render = templates[templateName] || templates.modern;
  return render(name, content, pages);
}

// ---------------------------------------------------------------------------
// Public: compile .tex → PDF buffer
// ---------------------------------------------------------------------------

export async function compileLatexToPdf(texString) {
  // Verify pdflatex is available
  try {
    execFileSync('which', ['pdflatex'], { stdio: 'pipe' });
  } catch {
    throw new Error(
      'pdflatex not found. Install a TeX distribution (e.g. texlive-base, texlive-latex-extra, texlive-fonts-recommended).',
    );
  }

  const tempDir = mkdtempSync(join(tmpdir(), 'resume-'));
  const texPath = join(tempDir, 'resume.tex');
  const pdfPath = join(tempDir, 'resume.pdf');

  try {
    writeFileSync(texPath, texString, 'utf8');

    execFileSync(
      'pdflatex',
      ['-interaction=nonstopmode', '-halt-on-error', `-output-directory=${tempDir}`, texPath],
      { timeout: 30000, stdio: 'pipe', cwd: tempDir },
    );

    if (!existsSync(pdfPath)) {
      throw new Error('pdflatex ran but no PDF was produced');
    }

    const buffer = readFileSync(pdfPath);

    // Count pages (lightweight — parse the PDF trailer for /Count)
    const actualPages = countPdfPages(buffer);

    return { buffer, actualPages };
  } catch (err) {
    // Grab the last 800 chars of the LaTeX log for debugging
    const logPath = join(tempDir, 'resume.log');
    let logTail = '';
    try {
      logTail = readFileSync(logPath, 'utf8').slice(-800);
    } catch {
      /* no log */
    }
    console.error('LaTeX compilation failed:', err.message);
    if (logTail) console.error('LaTeX log (tail):\n', logTail);
    throw new Error('PDF generation failed');
  } finally {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      /* best-effort cleanup */
    }
  }
}

/**
 * Quick page count by scanning the PDF buffer for /Type /Page entries.
 * This avoids pulling in pdf-lib just for a page count.
 */
function countPdfPages(buffer) {
  const str = buffer.toString('latin1');
  const matches = str.match(/\/Type\s*\/Page[^s]/g);
  return matches ? matches.length : 1;
}
