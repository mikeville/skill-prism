declare module 'hyphen/en' {
  export interface HyphenateOptions {
    hyphenChar?: string;
    minWordLength?: number;
    debug?: boolean;
    [key: string]: unknown;
  }
  export function hyphenateSync(text: string, options?: HyphenateOptions): string;
  export function hyphenate(text: string, options?: HyphenateOptions): Promise<string>;
}
