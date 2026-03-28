// POST /api/tailor/export-docx — Generate structured DOCX from tailored resume text

import { NextRequest, NextResponse } from "next/server";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  BorderStyle,
} from "docx";
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

    const children: Paragraph[] = [];

    // ── Name (18pt bold, centered) ──
    if (resume.name) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: resume.name,
              bold: true,
              font: "Calibri",
              size: 36, // half-points → 18pt
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 40 },
        }),
      );
    }

    // ── Contact (10pt, centered, gray) ──
    if (resume.contact) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: resume.contact,
              font: "Calibri",
              size: 20, // 10pt
              color: "555555",
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),
      );
    }

    // ── Sections ──
    for (const section of resume.sections) {
      // Section heading: bold, small-caps feel, bottom border
      if (section.heading) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: section.heading.toUpperCase(),
                bold: true,
                font: "Calibri",
                size: 24, // 12pt
              }),
            ],
            spacing: { before: 240, after: 80 },
            border: {
              bottom: {
                style: BorderStyle.SINGLE,
                size: 6, // eighths of a point
                color: "999999",
                space: 2,
              },
            },
          }),
        );
      }

      for (const item of section.items) {
        switch (item.kind) {
          case "entry": {
            // Summary sections or long plain-text paragraphs: render as body text.
            const isSummaryContent =
              section.type === "summary" ||
              (!item.text.includes("|") && item.text.trim().length > 80);
            if (isSummaryContent) {
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: item.text,
                      font: "Calibri",
                      size: 22, // 11pt
                    }),
                  ],
                  spacing: { after: 60 },
                }),
              );
              break;
            }
            // Experience / education entries: split "Title | Company | Date" into
            // two lines — role title (bold) then company · date (gray, smaller).
            const rawParts = item.text
              .split("|")
              .map((p: string) => p.trim())
              .filter(Boolean);
            if (rawParts.length >= 2) {
              const title = rawParts[0];
              const co = rawParts.length >= 3 ? rawParts[1] : "";
              const date = rawParts[rawParts.length - 1];
              const subLine = co ? `${co}  ·  ${date}` : date;
              // Line 1: Role title — bold 11pt
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: title,
                      bold: true,
                      font: "Calibri",
                      size: 22, // 11pt
                    }),
                  ],
                  spacing: { before: 160, after: 20 },
                }),
              );
              // Line 2: Company · Date — normal 9pt gray
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: subLine,
                      font: "Calibri",
                      size: 18, // 9pt
                      color: "666666",
                    }),
                  ],
                  spacing: { after: 60 },
                }),
              );
            } else {
              // Single-segment entry (no pipe) — bold title line
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: item.text,
                      bold: true,
                      font: "Calibri",
                      size: 22, // 11pt
                    }),
                  ],
                  spacing: { before: 160, after: 40 },
                }),
              );
            }
            break;
          }

          case "bullet":
            children.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: "\u2022  " + item.text,
                    font: "Calibri",
                    size: 22, // 11pt
                  }),
                ],
                indent: { left: 360, hanging: 180 },
                spacing: { after: 40 },
              }),
            );
            break;

          case "text":
            children.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: item.text,
                    font: "Calibri",
                    size: 22, // 11pt
                  }),
                ],
                spacing: { after: 60 },
              }),
            );
            break;
        }
      }
    }

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1080,  // 0.75 inch — standard resume margin
                right: 1080,
                bottom: 1080,
                left: 1080,
              },
            },
          },
          children,
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}.docx"`,
      },
    });
  } catch (err) {
    console.error("[export-docx]", err);
    return NextResponse.json(
      { ok: false, error: "Failed to generate DOCX" },
      { status: 500 },
    );
  }
}
