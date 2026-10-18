import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { ResumeContentV1 } from "@candidate/contracts";
import type { RenderedResume } from "./index.js";

/** Synthetic-only fixture; metadata remains outside canonical v1 content. */
export const syntheticResume: {
  schemaVersion: 1;
  snapshot: { name: string; email: string; location: string };
  content: ResumeContentV1;
} = {
  schemaVersion: 1,
  snapshot: { name: "Zoë García", email: "zoe.garcia@example.invalid", location: "Example City, Example Region" },
  content: {
    company: "Synthetic Systems", title: "Senior Software Engineer",
    summary: "Synthetic demonstration profile for document-engine feasibility. Builds reliable interfaces, accessible tools, and carefully tested data workflows. All names, companies, achievements, and contact details in this document are fictional.",
    skills: [{ Engineering: ["TypeScript", "React", "PostgreSQL", "Accessibility"] }, { Collaboration: ["Design reviews", "Mentoring", "Documentation"] }],
    experience: Array.from({ length: 5 }, (_, index) => ({
      title: index === 0 ? "Senior Software Engineer" : "Software Engineer",
      company: `Fictional Studio ${index + 1}`,
      sentences: [
        "Designed a synthetic candidate workspace with clear validation, recoverable operations, and accessible feedback across large and small screens.",
        "Collaborated with a fictional team to improve a demonstration workflow. This illustrative statement is not a claim about a real candidate or employer.",
        "Documented independent outcomes for document generation, local saving, database synchronization, and clipboard operations so a partial failure cannot appear as complete success.",
      ],
    })),
    education: [{ degree: "BSc Computer Science - Fictional Example University" }],
  },
};

export interface FeasibilityFonts { regular: Uint8Array; bold: Uint8Array }

export async function sha256(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes);
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", copy)), value => value.toString(16).padStart(2, "0")).join("");
}

/** Phase 0 single-style probe, not the production validator/template pipeline. */
export async function renderFeasibilityResume(fonts: FeasibilityFonts, fixture = syntheticResume): Promise<RenderedResume> {
  if (fixture.schemaVersion !== 1) throw new Error("Unsupported resume content version.");
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const regular = await document.embedFont(fonts.regular, { subset: true });
  const bold = await document.embedFont(fonts.bold, { subset: true });
  document.setTitle("Synthetic resume feasibility sample");
  document.setAuthor("Candidate Platform synthetic fixture");
  document.setCreator("candidate-resume-engine/phase0-1");
  document.setProducer("pdf-lib 1.17.1");
  document.setCreationDate(new Date("2026-10-17T00:00:00.000Z"));
  document.setModificationDate(new Date("2026-10-17T00:00:00.000Z"));
  const width = 612;
  const height = 792;
  const margin = 48;
  const bottom = 58;
  const lineHeight = 15;
  let page: PDFPage;
  let y = height - margin;
  const nextPage = () => { page = document.addPage([width, height]); y = height - margin; };
  nextPage();
  const fits = (font: PDFFont, text: string, size: number, max: number) => font.widthOfTextAtSize(text, size) <= max;
  function wrap(text: string, font = regular, size = 10.5, indent = 0) {
    const supported = new Set(font.getCharacterSet());
    for (const char of text) {
      if (!supported.has(char.codePointAt(0)!)) throw new Error(`Bundled font does not support U+${char.codePointAt(0)!.toString(16).toUpperCase()}. No text was replaced.`);
    }
    const max = width - 2 * margin - indent;
    const lines: string[] = [];
    let line = "";
    for (const word of text.split(/\s+/).filter(Boolean)) {
      if (line && !fits(font, `${line} ${word}`, size, max)) { lines.push(line); line = ""; }
      if (!fits(font, word, size, max)) {
        // Very long words/URLs split explicitly, rather than overflow or disappear.
        for (const char of word) {
          if (line && !fits(font, line + char, size, max)) { lines.push(line); line = ""; }
          line += char;
        }
      } else line = line ? `${line} ${word}` : word;
    }
    if (line) lines.push(line);
    return lines;
  }
  function ensure(lines: number) { if (y - lines * lineHeight < bottom) nextPage(); }
  function draw(lines: string[], font = regular, size = 10.5, indent = 0) {
    for (const line of lines) {
      ensure(1);
      page.drawText(line, { x: margin + indent, y, size, font, color: rgb(.09, .16, .2) });
      y -= lineHeight;
    }
  }
  function paragraph(text: string, indent = 0) { draw(wrap(text, regular, 10.5, indent), regular, 10.5, indent); y -= 7; }
  function heading(text: string, followingLines = 2) {
    const lines = wrap(text, bold, 12);
    ensure(lines.length + followingLines + 1);
    y -= 6;
    draw(lines, bold, 12);
    y -= 5;
  }
  draw(wrap(fixture.snapshot.name, bold, 23), bold, 23);
  y -= 11;
  paragraph(`${fixture.snapshot.email} | ${fixture.snapshot.location}`);
  heading(fixture.content.title);
  paragraph(`Target: ${fixture.content.company} | Synthetic demonstration only`);
  heading("Professional summary");
  paragraph(fixture.content.summary);
  heading("Skills");
  for (const category of fixture.content.skills) {
    for (const [name, values] of Object.entries(category)) paragraph(`${name}: ${values.join(", ")}`);
  }
  heading("Experience", 4);
  for (const role of fixture.content.experience) {
    const firstBulletLines = role.sentences[0] ? wrap(`• ${role.sentences[0]}`, regular, 10.5, 8).length : 0;
    heading(`${role.title} | ${role.company}`, Math.min(firstBulletLines, 3));
    for (const sentence of role.sentences) paragraph(`• ${sentence}`, 8);
  }
  heading("Education");
  for (const entry of fixture.content.education) paragraph(entry.degree);
  const pages = document.getPages();
  pages.forEach((sheet, index) => {
    sheet.drawLine({ start: { x: margin, y: 42 }, end: { x: width - margin, y: 42 }, thickness: .5, color: rgb(.65, .72, .75) });
    sheet.drawText(`SYNTHETIC DATA - NOT AN APPLICATION | ${index + 1} / ${pages.length}`, { x: margin, y: 27, size: 8, font: regular, color: rgb(.3, .4, .45) });
  });
  const bytes = await document.save({ useObjectStreams: false });
  return { bytes, pageCount: pages.length, sha256: await sha256(bytes) };
}
