// Capture an offscreen DOM subtree to PNG (raster, via modern-screenshot),
// SVG (native vectors with outlined text, via the hand-rolled DOM→SVG
// converter), or PDF (true vector, by routing the SVG through svg2pdf.js).

import jsPDF from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';
import { domToBlob } from 'modern-screenshot';
import { buildNativeSvg } from './nativeSvg';
import { getAnybodyFontEmbedCss } from './fontEmbed';

type CommonOpts = {
  width: number;
  height: number;
  // For PNG only — defaults to 1 (the offscreen node is already mounted at the
  // target pixel size, so we don't need a devicePixelRatio multiplier).
  pixelRatio?: number;
};

export async function capturePngBlob(node: HTMLElement, opts: CommonOpts): Promise<Blob> {
  const fontEmbedCSS = await getAnybodyFontEmbedCss();
  // Read the actual rendered paper color off the node so the export matches
  // the current theme. Hardcoding here meant the canvas clearColor showed
  // through whenever the active theme wasn't the original default.
  const pageBg = window.getComputedStyle(node).backgroundColor || '#ffffff';
  const blob = await domToBlob(node, {
    width: opts.width,
    height: opts.height,
    scale: opts.pixelRatio ?? 1,
    backgroundColor: pageBg,
    font: { cssText: fontEmbedCSS },
  });
  if (!blob) throw new Error('PNG capture returned no blob');
  return blob;
}

export async function captureSvgString(node: HTMLElement, opts: CommonOpts): Promise<string> {
  return buildNativeSvg(node, opts.width, opts.height);
}

export async function capturePdfBlob(node: HTMLElement, opts: CommonOpts): Promise<Blob> {
  // True vector PDF: build the outlined SVG, then route it through svg2pdf.js
  // (which translates SVG primitives into native PDF drawing commands). The
  // result is editable in Illustrator / Affinity / Inkscape with each glyph
  // appearing as a filled vector shape.
  const svgString = await buildNativeSvg(node, opts.width, opts.height);
  // svg2pdf.js needs the SVG as a live element (not just a string) — parse it
  // back into DOM so it can read computed styles and bounding boxes.
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svgEl = doc.documentElement as unknown as SVGSVGElement;
  // svg2pdf.js measures using getBoundingClientRect, so the SVG must be in
  // the live DOM (offscreen, but laid out). Attach to body, render, detach.
  const host = document.createElement('div');
  host.style.cssText =
    'position:fixed;left:-99999px;top:0;pointer-events:none;width:' +
    opts.width +
    'px;height:' +
    opts.height +
    'px;';
  host.appendChild(svgEl);
  document.body.appendChild(host);
  try {
    const pdfDoc = new jsPDF({
      orientation: opts.width >= opts.height ? 'landscape' : 'portrait',
      unit: 'pt',
      format: [opts.width, opts.height],
      hotfixes: ['px_scaling'],
    });
    await svg2pdf(svgEl, pdfDoc, {
      x: 0,
      y: 0,
      width: opts.width,
      height: opts.height,
    });
    return pdfDoc.output('blob');
  } finally {
    host.remove();
  }
}

export function svgStringToBlob(svg: string): Blob {
  return new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
}
