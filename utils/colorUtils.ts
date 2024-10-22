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