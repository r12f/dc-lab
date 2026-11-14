/** Converts client coordinates to the user space of `el` (an SVG, or a transformed group inside one). */
export function toSvgPoint(el: SVGGraphicsElement, clientX: number, clientY: number): { x: number; y: number } {
  const ctm = el.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}
