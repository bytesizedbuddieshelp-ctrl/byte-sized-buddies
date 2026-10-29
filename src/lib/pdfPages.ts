// Turns a PDF into one picture per page, in the owner's browser, so a PDF can sit in a slide's photo spot.
// The PDF reader is loaded only when a PDF is chosen, so nothing here costs a visitor anything.
import { safeFileName } from './pictureNames';

/** The most pages taken from one PDF. A slide shows at most four pictures, and the storage plan is small. */
export const MAX_PDF_PAGES = 12;
/** Pages are drawn this wide, which is sharp on a 1920 x 1080 slide without making a huge file. */
const PAGE_WIDTH = 1400;

/** The picture name for a page: "my-handout.pdf" page 2 becomes "my-handout-page-2.png". */
export function pagePictureName(pdfName: string, page: number): string {
  const base = pdfName.replace(/\.pdf$/i, '');
  return safeFileName(`${base}-page-${page}.png`);
}

export interface PdfPictures {
  files: File[];
  /** Pages in the PDF that were left out because of the page limit. */
  skipped: number;
}

/** Draws each page (up to MAX_PDF_PAGES) as a PNG picture. Throws a plain-words error if the PDF can't be read. */
export async function pdfToPictures(pdf: File): Promise<PdfPictures> {
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const task = pdfjs.getDocument({ data: new Uint8Array(await pdf.arrayBuffer()) });
  let doc;
  try {
    doc = await task.promise;
  } catch {
    await task.destroy();
    throw new Error(`"${pdf.name}" could not be opened. It may be damaged or have a password.`);
  }

  try {
    const count = Math.min(doc.numPages, MAX_PDF_PAGES);
    const files: File[] = [];
    for (let number = 1; number <= count; number++) {
      const page = await doc.getPage(number);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: PAGE_WIDTH / base.width });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('This browser could not draw the PDF.');
      // PDF pages have no background of their own, so paint white first.
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/png'));
      if (!blob) throw new Error('This browser could not save the PDF page as a picture.');
      files.push(new File([blob], pagePictureName(pdf.name, number), { type: 'image/png' }));
      page.cleanup();
    }
    return { files, skipped: doc.numPages - count };
  } finally {
    await task.destroy();
  }
}
