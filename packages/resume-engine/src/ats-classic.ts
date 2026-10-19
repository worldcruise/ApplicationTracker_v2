import { PDFDocument, rgb, degrees, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { validateResume, type CandidateProfile, type ResumeContentV1, type ResumeReviewInput } from "@candidate/contracts";
import { sha256, type FeasibilityFonts } from "./feasibility.js";
export const ATS_CLASSIC = { id: "a7000000-0000-4000-9000-000000000001", version: 1, renderer: "ats-classic/1.0.0", width: 612, height: 792, margin: 48, fontSize: 10.5, lineHeight: 15,
  fonts: { regular: "b85c38ecea8a7cfb39c24e395a4007474fa5a4fc864f6ee33309eb4948d232d5", bold: "c976e4b1b99edc88775377fcc21692ca4bfa46b6d6ca6522bfda505b28ff9d6a" } } as const;
export interface AtsInput { rawJson: string; snapshot: CandidateProfile; mapping: ResumeReviewInput; reviewed: boolean; renderedAt: string; templateVersionId: string }
export interface AtsRender { bytes: Uint8Array; sha256: string; pageCount: number; rendererVersion: string; renderedAt: string; warnings: string[]; text: string }
interface Block { lines: string[]; size: number; bold: boolean; indent: number; after: number; keepNext: number }

/** One measured layout path for preview/export/recovery. No content truncation,
 * remote assets, HTML, dynamic templates or automatic font shrinking. */
export async function renderAtsClassic(fonts: FeasibilityFonts, input: AtsInput): Promise<AtsRender> {
  const validation = validateResume(input.rawJson); if (!validation.content) throw new Error("Validate canonical v1 JSON before rendering.");
  if (input.templateVersionId !== ATS_CLASSIC.id || !Number.isFinite(Date.parse(input.renderedAt))) throw new Error("Unsupported template or render timestamp.");
  if (await sha256(fonts.regular) !== ATS_CLASSIC.fonts.regular || await sha256(fonts.bold) !== ATS_CLASSIC.fonts.bold) throw new Error("Pinned ATS Classic font hashes do not match.");
  const content: ResumeContentV1 = validation.content;
  const doc = await PDFDocument.create(); doc.registerFontkit(fontkit);
  const regular = await doc.embedFont(fonts.regular, { subset: true }); const bold = await doc.embedFont(fonts.bold, { subset: true });
  doc.setTitle(`${input.snapshot.fullName ?? "Resume"} - ${content.title}`); doc.setAuthor(input.snapshot.fullName ?? "");
  doc.setCreator(ATS_CLASSIC.renderer); doc.setProducer("pdf-lib 1.17.1"); doc.setCreationDate(new Date(input.renderedAt)); doc.setModificationDate(new Date(input.renderedAt));
  const supported = new Map<PDFFont, Set<number>>([[regular, new Set(regular.getCharacterSet())], [bold, new Set(bold.getCharacterSet())]]);
  const blocks: Block[] = [];
  function add(text: string, size = 10.5, isBold = false, indent = 0, after = 6, keepNext = 0) {
    if (!text.trim()) return;
    const font = isBold ? bold : regular; const width = 612 - 96 - indent; const lines: string[] = [];
    for (const char of text) if (!/[\t\n\r]/.test(char) && !supported.get(font)!.has(char.codePointAt(0)!)) throw new Error(`Bundled font does not support U+${char.codePointAt(0)!.toString(16).toUpperCase()}. No text was substituted.`);
    for (const paragraph of text.split(/\r?\n/)) {
      let line = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        if (line && font.widthOfTextAtSize(`${line} ${word}`, size) > width) { lines.push(line); line = ""; }
        if (font.widthOfTextAtSize(word, size) > width) {
          for (const char of word) { if (line && font.widthOfTextAtSize(line + char, size) > width) { lines.push(line); line = ""; } line += char; }
        } else line = line ? `${line} ${word}` : word;
      }
      if (line) lines.push(line);
    }
    blocks.push({ lines, size, bold: isBold, indent, after, keepNext });
  }
  const heading = (title: string) => add(title, 12, true, 0, 7, 2);
  add(input.snapshot.fullName ?? "", 22, true, 0, 12, 1);
  add([input.snapshot.email, input.snapshot.phone, input.snapshot.location].filter(Boolean).join(" | "), 9.5, false, 0, 9);
  add(input.snapshot.links.map(l => l.url).join(" | "), 9, false, 0, 9);
  add(content.title, 12, true, 0, 9, 1);
  if (content.summary.trim()) { heading("Professional summary"); add(content.summary); }
  if (content.skills.some(g => Object.values(g).some(v => v.some(s => s.trim())))) {
    heading("Skills"); for (const category of content.skills) for (const [name, skills] of Object.entries(category)) if (skills.some(s => s.trim())) add(`${name}: ${skills.filter(s => s.trim()).join(", ")}`);
  }
  if (content.experience.length) {
    heading("Experience"); content.experience.forEach((entry, i) => {
      const source = input.snapshot.experiences.find(w => w.id === input.mapping.experienceIds[i]);
      add([entry.title, entry.company].filter(Boolean).join(" | "), 11, true, 0, 4, 1);
      if (source) add([source.startDate && `${source.startDate}${source.current ? " - Present" : source.endDate ? ` - ${source.endDate}` : ""}`, !source.startDate && source.endDate ? source.endDate : null, source.location].filter(Boolean).join(" | "), 9, false, 0, 4, entry.sentences.length ? 1 : 0);
      entry.sentences.filter(s => s.trim()).forEach(sentence => add(`\u2022 ${sentence}`, 10.5, false, 10, 5));
    });
  }
  if (content.education.length) {
    heading("Education"); content.education.forEach((entry, i) => {
      const source = input.snapshot.educations.find(e => e.id === input.mapping.educationIds[i]);
      add(entry.degree, 10.5, true, 0, 3, source?.institution ? 1 : 0);
      if (source) add([source.institution, source.startDate && `${source.startDate}${source.endDate ? ` - ${source.endDate}` : ""}`, !source.startDate ? source.endDate : null].filter(Boolean).join(" | "), 9.5);
    });
  }
  if (!blocks.length) add("No resume content supplied.");
  let page: PDFPage; let y = 744; const top = 744; const bottom = 58; const textLines: string[] = [];
  function nextPage() { if (doc.getPageCount() >= 100) throw new Error("Layout exceeds the 100-page safety limit. Shorten the source; no content was truncated."); page = doc.addPage([612, 792]); y = top; }
  nextPage();
  function followingHeight(index: number, count: number): number {
    const b = blocks[index]; if (!b || !count) return 0;
    const lines = b.keepNext ? b.lines.length : Math.min(count, b.lines.length);
    return lines * Math.max(15, b.size + 4) + b.after + followingHeight(index + 1, b.keepNext);
  }
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!; const lineHeight = Math.max(15, block.size + 4);
    const needed = block.lines.length * lineHeight + block.after + followingHeight(i + 1, block.keepNext);
    if (block.keepNext && needed <= top - bottom && y - needed < bottom) nextPage();
    for (const line of block.lines) {
      if (y - lineHeight < bottom) nextPage();
      page!.drawText(line, { x: 48 + block.indent, y, size: block.size, font: block.bold ? bold : regular, color: rgb(.08, .1, .12) });
      textLines.push(line); y -= lineHeight;
    }
    y -= block.after;
  }
  const pages = doc.getPages();
  pages.forEach((sheet, i) => {
    if (!input.reviewed) sheet.drawText("UNVERIFIED", { x: 122, y: 335, size: 49, font: bold, color: rgb(.65, .1, .1), opacity: .13, rotate: degrees(35) });
    sheet.drawLine({ start: { x: 48, y: 42 }, end: { x: 564, y: 42 }, thickness: .4, color: rgb(.65, .65, .65) });
    sheet.drawText(`${input.reviewed ? "" : "UNVERIFIED | "}${i + 1} / ${pages.length}`, { x: 48, y: 28, size: 8, font: regular, color: rgb(.35, .35, .35) });
  });
  const bytes = await doc.save({ useObjectStreams: false });
  return { bytes, sha256: await sha256(bytes), pageCount: pages.length, rendererVersion: ATS_CLASSIC.renderer, renderedAt: input.renderedAt,
    warnings: [...(!input.reviewed ? ["Unverified factual review: watermark remains on every page."] : []), ...(pages.length > 3 ? [`Resume spans ${pages.length} pages. Review length; text has not been reduced or truncated.`] : [])], text: textLines.join("\n") };
}
