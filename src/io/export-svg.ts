import { downloadText } from './download';

/** Replaces every `var(--name)` with its computed value so the SVG renders standalone. */
function resolveCssVars(markup: string, root: Element = document.documentElement): string {
  const style = getComputedStyle(root);
  return markup.replace(/var\((--[\w-]+)\)/g, (m, name: string) => style.getPropertyValue(name).trim() || m);
}

/** Downloads an <svg> element as a standalone .svg file in the current theme's colors. */
export function exportSvg(svg: SVGSVGElement, filename: string): void {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.querySelectorAll('[data-export="skip"]').forEach((n) => n.remove());
  const vb = svg.viewBox.baseVal;
  clone.setAttribute('width', String(vb.width));
  clone.setAttribute('height', String(vb.height));
  clone.removeAttribute('class');
  clone.removeAttribute('style');
  const markup = resolveCssVars(new XMLSerializer().serializeToString(clone));
  downloadText(filename.endsWith('.svg') ? filename : `${filename}.svg`, `<?xml version="1.0" encoding="UTF-8"?>\n${markup}`, 'image/svg+xml');
}
