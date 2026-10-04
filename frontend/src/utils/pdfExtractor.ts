import * as pdfjsLib from 'pdfjs-dist';

// Use standard CDN worker matching installed pdfjs-dist version or local fallback
if (typeof window !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
}

export interface ExtractedPageText {
    pageNumber: number;
    text: string;
    lines: string[];
}

export async function extractAllTextFromPdf(file: File | Blob): Promise<{
    numPages: number;
    pages: ExtractedPageText[];
    fullText: string;
}> {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;
    const pages: ExtractedPageText[] = [];

    for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Group items roughly by line based on Y coordinate transform
        const items = textContent.items as Array<{ str: string; transform: number[]; hasEOL?: boolean }>;
        let pageLines: string[] = [];
        let currentLine = '';
        let lastY: number | null = null;

        for (const item of items) {
            if ('str' in item) {
                const y = Math.round(item.transform[5]);
                if (lastY !== null && Math.abs(y - lastY) > 3) {
                    if (currentLine.trim()) {
                        pageLines.push(currentLine.trim());
                    }
                    currentLine = item.str;
                } else {
                    currentLine += (currentLine.endsWith(' ') || item.str.startsWith(' ') ? '' : ' ') + item.str;
                }
                lastY = y;
            }
        }
        if (currentLine.trim()) {
            pageLines.push(currentLine.trim());
        }

        const pageText = pageLines.join('\n');
        pages.push({
            pageNumber: i,
            text: pageText,
            lines: pageLines
        });
    }

    const fullText = pages.map(p => `--- PAGE ${p.pageNumber} ---\n${p.text}`).join('\n\n');

    return {
        numPages,
        pages,
        fullText
    };
}

export async function renderPdfPageToCanvas(
    file: File | Blob,
    pageNumber: number,
    canvas: HTMLCanvasElement,
    scale: number = 1.5
): Promise<{ width: number; height: number }> {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(pageNumber);
    
    const viewport = page.getViewport({ scale });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get canvas 2d context');

    await page.render({
        canvasContext: context,
        viewport: viewport
    }).promise;

    return {
        width: viewport.width,
        height: viewport.height
    };
}
