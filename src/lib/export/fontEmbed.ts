// Builds an inlined @font-face CSS string for Anybody Variable that html-to-image
// can embed into the captured output. We bypass html-to-image's automatic
// stylesheet walk because Vite-served @fontsource woff2 URLs are inconsistently
// inlined across browsers, leading to fallback-font renders inside exports.
//
// Strategy: import each woff2 as a Vite asset URL, fetch it, base64-encode, and
// build a self-contained @font-face block with the exact unicode-ranges from
// @fontsource-variable/anybody/standard.css. Cached per session.

import latinUrl from '@fontsource-variable/anybody/files/anybody-latin-standard-normal.woff2?url';
import latinExtUrl from '@fontsource-variable/anybody/files/anybody-latin-ext-standard-normal.woff2?url';
import vietnameseUrl from '@fontsource-variable/anybody/files/anybody-vietnamese-standard-normal.woff2?url';

type FaceSpec = {
  url: string;
  unicodeRange: string;
};

const FACES: FaceSpec[] = [
  {
    url: latinUrl,
    unicodeRange:
      'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
  },
  {
    url: latinExtUrl,
    unicodeRange:
      'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
  },
  {
    url: vietnameseUrl,
    unicodeRange:
      'U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB',
  },
];

let cached: string | null = null;
let pending: Promise<string> | null = null;

async function fetchAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch font: ${url}`);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function getAnybodyFontEmbedCss(): Promise<string> {
  if (cached) return cached;
  if (pending) return pending;

  pending = (async () => {
    const blocks = await Promise.all(
      FACES.map(async (f) => {
        const dataUrl = await fetchAsDataUrl(f.url);
        return `@font-face {
  font-family: "Anybody Variable";
  font-style: normal;
  font-display: block;
  font-weight: 100 900;
  font-stretch: 50% 150%;
  src: url(${dataUrl}) format("woff2-variations");
  unicode-range: ${f.unicodeRange};
}`;
      }),
    );
    cached = blocks.join('\n');
    return cached;
  })();

  try {
    return await pending;
  } finally {
    pending = null;
  }
}
