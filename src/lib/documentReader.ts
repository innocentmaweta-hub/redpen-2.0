import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

export type ExtractedDocument = { text: string; images: string[]; warnings: string[] };

const MAX_TEXT = 85000;
const MAX_IMAGES = 3;

function imageFromCanvas(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/jpeg', 0.68);
}

export async function extractDocument(file: File): Promise<ExtractedDocument> {
  if (file.type.startsWith('image/')) {
    return { text: '', images: [await fileToDataUrl(file)], warnings: [] };
  }
  if (file.type === 'text/plain' || /\.txt$/i.test(file.name)) {
    return { text: (await file.text()).slice(0, MAX_TEXT), images: [], warnings: [] };
  }
  if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
    throw new Error(`Unsupported document format: ${file.name}. Use PDF, image or plain text.`);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data: bytes }).promise;
  const chunks: string[] = [];
  let total = 0;
  for (let pageNumber = 1; pageNumber <= pdf.numPages && total < MAX_TEXT; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map(item => 'str' in item ? item.str : '').join(' ');
    chunks.push(`[Page ${pageNumber}]\n${text}`);
    total += text.length;
  }
  const extracted = chunks.join('\n\n').slice(0, MAX_TEXT);
  if (extracted.trim().length >= 35) return { text: extracted, images: [], warnings: [] };

  const images: string[] = [];
  for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, MAX_IMAGES); pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.25 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not render a scanned PDF page.');
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    images.push(imageFromCanvas(canvas));
    canvas.width = 0; canvas.height = 0;
  }
  if (!images.length) throw new Error('This PDF contains no readable text or pages.');
  return { text: '', images, warnings: pdf.numPages > MAX_IMAGES ? ['This scanned PDF has ' + pdf.numPages + ' pages; only the first ' + MAX_IMAGES + ' pages were sent for AI review. Check the remaining pages manually.'] : [] };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read image file.'));
    reader.onerror = () => reject(new Error('Could not read image file.'));
    reader.readAsDataURL(file);
  });
}
