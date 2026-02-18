// lib/resume_extract.ts

import pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';

function bad(message: string): Error {
  return new Error(message);
}

function getExt(name: string): string {
  const n = (name || '').trim().toLowerCase();
  const idx = n.lastIndexOf('.');
  if (idx < 0) return '';
  return n.slice(idx + 1);
}

function normalizeText(s: string): string {
  return (s || '').replace(/\r\n/g, '\n').trim();
}

export async function extractResumeText(file: File): Promise<string> {
  if (!file) throw bad('Missing file');

  const ext = getExt(file.name);
  const buf = Buffer.from(await file.arrayBuffer());

  if (ext === 'txt') {
    const text = new TextDecoder('utf-8').decode(buf);
    return normalizeText(text);
  }

  if (ext === 'pdf') {
    const parsed = await pdfParse(buf);
    return normalizeText(parsed?.text ?? '');
  }

  if (ext === 'docx') {
    const res = await mammoth.extractRawText({ buffer: buf });
    return normalizeText(res?.value ?? '');
  }

  throw bad(`Unsupported file extension: .${ext || '(none)'}`);
}