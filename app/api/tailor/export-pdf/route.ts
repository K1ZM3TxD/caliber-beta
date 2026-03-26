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

    // ── Name (20pt bold, centered) ──
    if (resume.name) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.setTextColor(20, 20, 20);
      ensureSpace(24);
      doc.text(resume.name, pageW / 2, y, { align: "center" });
      y += 24;
    }

    // ── Contact (9.5pt, centered, mid-gray) ──
    if (resume.contact) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(90, 90, 90);
      const contactLines = doc.splitTextToSize(
        resume.contact,
        maxWidth,
      ) as string[];
      for (const line of contactLines) {
        ensureSpace(12);
        doc.text(line, pageW / 2, y, { align: "center" });
        y += 12;
      }
      doc.setTextColor(20, 20, 20);
      y += 10; // breathing room before first section
    }

    // ── Sections ──
    for (const section of resume.sections) {
      // Section heading: 11pt bold uppercase + hairline rule
      if (section.heading) {
        y += 12; // inter-section gap
        ensureSpace(22);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(20, 20, 20);
        doc.text(section.heading.toUpperCase(), margin, y);
        y += 3;
        doc.setDrawColor(205, 205, 205); // light hairline
        doc.setLineWidth(0.3);
        doc.line(margin, y, pageW - margin, y);
        y += 9;
      }

      for (const item of section.items) {
        switch (item.kind) {
          case "entry": {
            y += 3; // slight gap before each role/degree/project title
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10.5);
            doc.setTextColor(20, 20, 20);
            const entryLines = doc.splitTextToSize(
              item.text,
              maxWidth,
            ) as string[];
            for (const el of entryLines) {
              ensureSpace(13);
              doc.text(el, margin, y);
              y += 13;
            }
            y += 1;
            break;
          }

          case "bullet": {
            const bulletIndent = 14; // tighter, less chunky
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(20, 20, 20);
            const normalizedBullet = item.text.replace(/^[\u2022\u25AA\u25BA\u25CF\u2023\u25E6\u2043*\-\u2022]+\s*/, "").trim();
            const bLines = doc.splitTextToSize(
              normalizedBullet,
              maxWidth - bulletIndent,
            ) as string[];
            for (let i = 0; i < bLines.length; i++) {
              ensureSpace(12.5);
              if (i === 0) doc.text("\u2022", margin + 3, y);
              doc.text(bLines[i], margin + bulletIndent, y);
              y += 12.5;
            }
            y += 1;
            break;
          }

          case "text": {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(20, 20, 20);
            const tLines = doc.splitTextToSize(
              item.text,
              maxWidth,
            ) as string[];
            for (const tl of tLines) {
              ensureSpace(13);
              doc.text(tl, margin, y);
              y += 13;
            }
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
