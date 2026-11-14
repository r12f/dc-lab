/** Relative luminance of a #RRGGBB color (WCAG). */
export function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** `preferred` if it reaches 4.5:1 on `bg`, else whichever of `light`/`dark` contrasts more. */
export function readableOn(bg: string, preferred: string, light: string, dark: string): string {
  if (contrastRatio(preferred, bg) >= 4.5) return preferred;
  return contrastRatio(light, bg) >= contrastRatio(dark, bg) ? light : dark;
}
