export function adjustColor(hex: string, percent: number): string {
  // Remove the # if present
  hex = hex.replace(/^#/, '');

  // Parse the hex string
  let r = parseInt(hex.slice(0, 2), 16);
  let g = parseInt(hex.slice(2, 4), 16);
  let b = parseInt(hex.slice(4, 6), 16);

  // Adjust each channel
  r = Math.floor(r * (1 + percent / 100));
  g = Math.floor(g * (1 + percent / 100));
  b = Math.floor(b * (1 + percent / 100));

  // Ensure values are within 0-255 range
  r = Math.min(255, Math.max(0, r));
  g = Math.min(255, Math.max(0, g));
  b = Math.min(255, Math.max(0, b));

  // Convert back to hex
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Adjusts the lightness of an HSL color string by a given percent.
 * Example: adjustHSL('hsl(300, 100%, 25%)', 70) will increase lightness by 70%.
 * If percent is negative, it will decrease lightness.
 */
export function adjustHSL(hsl: string, percent: number) {
  // Use RegExp#exec() as per lint recommendation
  const regex = /hsl\s*\(\s*([\d.]+)[,\s]+([\d.]+)%[,\s]+([\d.]+)%\s*\)/i;
  const match = regex.exec(hsl);
  if (!match) {
    throw new Error('Invalid HSL color format');
  }
  const h = parseFloat(match[1] ?? '0');
  const s = parseFloat(match[2] ?? '0');
  let l = parseFloat(match[3] ?? '0');

  // Adjust lightness
  l = l * (1 + percent / 100);

  // Clamp between 0 and 100
  l = Math.max(0, Math.min(100, l));

  // Return adjusted HSL string
  return `hsl(${h}, ${s}%, ${l}%)`;
}
