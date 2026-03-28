// POST /api/tailor/export-pdf — Generate structured PDF from tailored resume text

import { NextRequest, NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import { parseResume, safeFilename } from "@/lib/resume_parser";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tailoredText =
      typeof body.tailoredText === "string" ? body.tailoredText : "";
    const jobTitle =
      typeof body.jobTitle === "string" ? body.jobTitle : "";
    const company =
      typeof body.company === "string" ? body.company : "";

    if (!tailoredText || tailoredText.length < 50) {
      return NextResponse.json(
        { ok: false, error: "No resume text provided" },
        { status: 400 },
      );
    }

    const resume = parseResume(tailoredText);
    const filename = safeFilename(resume.name, jobTitle, company);

    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 54; // 0.75 inch
    const maxWidth = pageW - margin * 2;
    let y = margin;

    function ensureSpace(needed: number) {
      if (y + needed > pageH - margin) {
        doc.addPage();
        y = margin;
      }
    }

    // Render paragraph text justified (all lines except last), left-align the last line
    function renderJustifiedParagraph(lines: string[], lineH: number) {
      for (let i = 0; i < lines.length; i++) {
        ensureSpace(lineH);
        const isLast = i === lines.length - 1;
        if (isLast || lines[i].trim() === "") {
          doc.text(lines[i], margin, y);
        } else {
          doc.text(lines[i], margin, y, { align: "justify", maxWidth });
        }
        y += lineH;
      }
    }

    // ── Name (22pt bold, left-aligned) + full-width rule below ──
    if (resume.name) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(20, 20, 20);
      ensureSpace(28);
      doc.text(resume.name, margin, y);
      y += 5;
      // Full-width rule under name
      doc.setDrawColor(20, 20, 20);
      doc.setLineWidth(0.75);
      doc.line(margin, y, pageW - margin, y);
      y += 10;
    }

    // ── Contact (10pt, left-aligned, near-black, pipe-separated) ──
    if (resume.contact) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(20, 20, 20);
      const contactLines = doc.splitTextToSize(resume.contact, maxWidth) as string[];
      for (const line of contactLines) {
        ensureSpace(13);
        doc.text(line, margin, y);
        y += 13;
      }
      y += 10; // breathing room before first section
    }

    // ── Sections ──
    for (const section of resume.sections) {
      // Section heading: 13pt bold, centered, underlined — LinkedIn/ATS standard
      if (section.heading) {
        y += 14; // inter-section breathing room
        ensureSpace(22);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(20, 20, 20);
        const headingText = section.heading.toUpperCase();
        const tw = doc.getTextWidth(headingText);
        const hx = (pageW - tw) / 2;
        doc.text(headingText, pageW / 2, y, { align: "center" });
        // Underline the heading text
        doc.setDrawColor(20, 20, 20);
        doc.setLineWidth(0.5);
        doc.line(hx, y + 1.5, hx + tw, y + 1.5);
        y += 14;
      }

      for (const item of section.items) {
        switch (item.kind) {
          case "entry": {
            // Summary / long plain paragraph — render justified
            const isSummaryContent =
              section.type === "summary" ||
              (!item.text.includes("|") && item.text.trim().length > 80);
            if (isSummaryContent) {
              doc.setFont("helvetica", "normal");
              doc.setFontSize(10);
              doc.setTextColor(20, 20, 20);
              const sLines = doc.splitTextToSize(item.text, maxWidth) as string[];
              renderJustifiedParagraph(sLines, 13);
              y += 2;
              break;
            }

            // Entry hierarchy: Role (bold) → Company (left) + Date (right) on same line
            y += 6;
            const rawParts = item.text.split("|").map((p: string) => p.trim()).filter(Boolean);

            if (rawParts.length >= 2) {
              const title = rawParts[0];
              const company = rawParts.length >= 3 ? rawParts[1] : "";
              const date = rawParts[rawParts.length - 1];

              // Role — bold, 11pt, left-aligned
              doc.setFont("helvetica", "bold");
              doc.setFontSize(11);
              doc.setTextColor(20, 20, 20);
              const tLines = doc.splitTextToSize(title, maxWidth) as string[];
              for (const tl of tLines) { ensureSpace(14); doc.text(tl, margin, y); y += 14; }

              // Company (left) + Date (right) — normal, 10pt, near-black, same line
              if (company || date) {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(10);
                doc.setTextColor(20, 20, 20);
                ensureSpace(13);
                if (company) doc.text(company, margin, y);
                if (date) doc.text(date, pageW - margin, y, { align: "right" });
                y += 13;
              }
            } else {
              // No pipe — single bold title line
              doc.setFont("helvetica", "bold");
              doc.setFontSize(11);
              doc.setTextColor(20, 20, 20);
              const eLines = doc.splitTextToSize(item.text, maxWidth) as string[];
              for (const el of eLines) { ensureSpace(14); doc.text(el, margin, y); y += 14; }
            }
            y += 4; // gap before body/bullets
            break;
          }

          case "bullet": {
            const bulletIndent = 16;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(20, 20, 20);
            const normalizedBullet = item.text.replace(/^[\u2022\u25AA\u25BA\u25CF\u2023\u25E6\u2043*\-]+\s*/, "").trim();
            const bLines = doc.splitTextToSize(normalizedBullet, maxWidth - bulletIndent) as string[];
            for (let i = 0; i < bLines.length; i++) {
              ensureSpace(13);
              if (i === 0) doc.text("\u2022", margin + 4, y);
              doc.text(bLines[i], margin + bulletIndent, y);
              y += 13;
            }
            y += 2;
            break;
          }

          case "text": {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(20, 20, 20);
            const tLines = doc.splitTextToSize(item.text, maxWidth) as string[];
            renderJustifiedParagraph(tLines, 13);
            y += 2;
            break;
          }
        }
      }
    }

    const pdfBuffer = doc.output("arraybuffer");

    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}.pdf"`,
      },
    });
  } catch (err) {
    console.error("[export-pdf]", err);
    return NextResponse.json(
      { ok: false, error: "Failed to generate PDF" },
      { status: 500 },
    );
  }
}
