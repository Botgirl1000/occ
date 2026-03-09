declare module 'mammoth' {
  interface ConvertResult {
    value: string;
    messages: unknown[];
  }
  interface InputOptions {
    path?: string;
    buffer?: Buffer;
  }
  function extractRawText(input: InputOptions): Promise<ConvertResult>;
  function convertToHtml(input: InputOptions): Promise<ConvertResult>;
  export default { extractRawText, convertToHtml };
}
