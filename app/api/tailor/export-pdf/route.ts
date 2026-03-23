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
    const margin = 72; // 1 inch
    const maxWidth = pageW - margin * 2;
    let y = margin;

    function ensureSpace(needed: number) {
      if (y + needed > pageH - margin) {
        doc.addPage();
        y = margin;
      }
    }

    // ── Name (18pt bold, centered) ──
    if (resume.name) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(0, 0, 0);
      ensureSpace(22);
      doc.text(resume.name, pageW / 2, y, { align: "center" });
      y += 22;
    }

    // ── Contact (10pt, centered, gray) ──
    if (resume.contact) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      const contactLines = doc.splitTextToSize(
        resume.contact,
        maxWidth,
      ) as string[];
      for (const line of contactLines) {
        ensureSpace(13);
        doc.text(line, pageW / 2, y, { align: "center" });
        y += 13;
      }
      doc.setTextColor(0, 0, 0);
      y += 8;
    }

    // ── Sections ──
    for (const section of resume.sections) {
      // Section heading: bold 12pt + underline rule
      if (section.heading) {
        y += 10;
        ensureSpace(20);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text(section.heading.toUpperCase(), margin, y);
        y += 4;
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.5);
        doc.line(margin, y, pageW - margin, y);
        y += 10;
      }

      for (const item of section.items) {
        switch (item.kind) {
          case "entry": {
            y += 4;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.setTextColor(0, 0, 0);
            const entryLines = doc.splitTextToSize(
              item.text,
              maxWidth,
            ) as string[];
            for (const el of entryLines) {
              ensureSpace(14);
              doc.text(el, margin, y);
              y += 14;
            }
            y += 1;
            break;
          }

          case "bullet": {
            const bulletIndent = 20;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10.5);
            doc.setTextColor(0, 0, 0);
            const bLines = doc.splitTextToSize(
              item.text,
              maxWidth - bulletIndent,
            ) as string[];
            for (let i = 0; i < bLines.length; i++) {
              ensureSpace(13);
              if (i === 0) doc.text("\u2022", margin + 6, y);
              doc.text(bLines[i], margin + bulletIndent, y);
              y += 13;
            }
            y += 1;
            break;
          }

          case "text": {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10.5);
            doc.setTextColor(0, 0, 0);
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
