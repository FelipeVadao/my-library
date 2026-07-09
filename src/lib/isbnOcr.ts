function isValidIsbn10(candidate: string): boolean {
  if (!/^\d{9}[\dX]$/.test(candidate)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += (i + 1) * Number(candidate[i]);
  sum += 10 * (candidate[9] === 'X' ? 10 : Number(candidate[9]));
  return sum % 11 === 0;
}

function isValidIsbn13(candidate: string): boolean {
  if (!/^(97[89])\d{10}$/.test(candidate)) return false;
  let sum = 0;
  for (let i = 0; i < 13; i++) sum += Number(candidate[i]) * (i % 2 === 0 ? 1 : 3);
  return sum % 10 === 0;
}

// OCR text from a photographed ISBN is noisy: it may include the "ISBN"
// label, a price tag, or a line break under the barcode. We cluster runs of
// digits/X tolerating hyphen/space/newline separators, then test each
// cluster for a checksum-valid ISBN before falling back to format-only
// matches (which still land safely on the existing "not found" screen if
// wrong, since they just feed into the normal lookupIsbn pipeline).
const CLUSTER_RE = /[0-9Xx](?:[0-9Xx]|[ \t-]|\r?\n){0,30}[0-9Xx]|[0-9Xx]/g;

export function extractIsbnFromText(text: string): string | null {
  const clusters = text.match(CLUSTER_RE) ?? [];
  const compacted = clusters.map((c) => c.replace(/[^0-9Xx]/g, '').toUpperCase()).filter(Boolean);

  for (const c of compacted) {
    for (let i = 0; i + 13 <= c.length; i++) {
      const window13 = c.slice(i, i + 13);
      if (isValidIsbn13(window13)) return window13;
    }
  }
  for (const c of compacted) {
    for (let i = 0; i + 10 <= c.length; i++) {
      const window10 = c.slice(i, i + 10);
      if (isValidIsbn10(window10)) return window10;
    }
  }
  for (const c of compacted) {
    if (/^(97[89])\d{10}$/.test(c)) return c;
  }
  for (const c of compacted) {
    if (c.length === 10 && /^\d{9}[\dX]$/.test(c)) return c;
  }
  return null;
}

export async function recognizeIsbnFromImage(source: Blob | HTMLCanvasElement): Promise<string | null> {
  try {
    const Tesseract = await import('tesseract.js');
    const { data } = await Tesseract.recognize(source, 'eng');
    return extractIsbnFromText(data.text);
  } catch {
    return null;
  }
}
