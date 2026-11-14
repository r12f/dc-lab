import { downloadText } from './download';

/** Downloads an <svg> element as a standalone .svg file. */
export function exportSvg(svg: SVGSVGElement, filename: string): void {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.querySelectorAll('[data-export="skip"]').forEach((n) => n.remove());
  const vb = svg.viewBox.baseVal;
  clone.setAttribute('width', String(vb.width));
  clone.setAttribute('height', String(vb.height));
  clone.removeAttribute('class');
  clone.removeAttribute('style');
  const text = `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
  downloadText(filename.endsWith('.svg') ? filename : `${filename}.svg`, text, 'image/svg+xml');
}
