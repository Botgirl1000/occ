declare module 'pdf-parse' {
  interface PdfData {
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: unknown;
    text: string;
    version: string;
  }
  interface PdfOptions {
    pagerender?: (pageData: { pageIndex: number; getTextContent: () => Promise<unknown> }) => Promise<string>;
    max?: number;
  }
  function parse(dataBuffer: Buffer, options?: PdfOptions): Promise<PdfData>;
  export default parse;
}
