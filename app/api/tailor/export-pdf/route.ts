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
      // Section heading: 10.5pt bold uppercase + ultra-light rule
      if (section.heading) {
        y += 12; // inter-section breathing room
        ensureSpace(22);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        doc.setTextColor(30, 30, 30);
        doc.text(section.heading.toUpperCase(), margin, y);
        y += 3;
        doc.setDrawColor(218, 218, 218); // near-invisible hairline
        doc.setLineWidth(0.25);
        doc.line(margin, y, pageW - margin, y);
        y += 9;
      }

      for (const item of section.items) {
        switch (item.kind) {
          case "entry": {
            // Split "Title | Company | Date" — title bold, details lighter
            y += 4;
            doc.setFontSize(10.5);
            const rawParts = item.text.split("|").map((p: string) => p.trim()).filter(Boolean);

            if (rawParts.length >= 2) {
              const title = rawParts[0];
              const detail = rawParts.slice(1).join("  |  ");
              const sep = "  |  ";

              // Measure with correct fonts before rendering
              doc.setFont("helvetica", "bold");
              const titleW = doc.getTextWidth(title);
              doc.setFont("helvetica", "normal");
              const fitsOneLine = titleW + doc.getTextWidth(sep + detail) <= maxWidth;

              ensureSpace(13);
              if (fitsOneLine) {
                // Title bold + details normal, lighter — all on one line
                doc.setFont("helvetica", "bold");
                doc.setTextColor(20, 20, 20);
                doc.text(title, margin, y);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(72, 72, 72);
                doc.text(sep + detail, margin + titleW, y);
                doc.setTextColor(20, 20, 20);
                y += 13;
              } else {
                // Title on its own line, detail beneath in 9.5pt subdued
                doc.setFont("helvetica", "bold");
                doc.setTextColor(20, 20, 20);
                const tLines = doc.splitTextToSize(title, maxWidth) as string[];
                for (const tl of tLines) { ensureSpace(13); doc.text(tl, margin, y); y += 13; }
                doc.setFont("helvetica", "normal");
                doc.setFontSize(9.5);
                doc.setTextColor(72, 72, 72);
                ensureSpace(12);
                doc.text(detail, margin, y);
                doc.setTextColor(20, 20, 20);
                doc.setFontSize(10.5);
                y += 12;
              }
            } else {
              // No pipe — single bold line
              doc.setFont("helvetica", "bold");
              doc.setTextColor(20, 20, 20);
              const eLines = doc.splitTextToSize(item.text, maxWidth) as string[];
              for (const el of eLines) { ensureSpace(13); doc.text(el, margin, y); y += 13; }
            }
            y += 2;
            break;
          }

          case "bullet": {
            const bulletIndent = 14;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(20, 20, 20);
            const normalizedBullet = item.text.replace(/^[\u2022\u25AA\u25BA\u25CF\u2023\u25E6\u2043*\-]+\s*/, "").trim();
            const bLines = doc.splitTextToSize(
              normalizedBullet,
              maxWidth - bulletIndent,
            ) as string[];
            for (let i = 0; i < bLines.length; i++) {
              ensureSpace(13);
              if (i === 0) doc.text("\u2022", margin + 3, y);
              doc.text(bLines[i], margin + bulletIndent, y);
              y += 13;
            }
            y += 1.5;
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
