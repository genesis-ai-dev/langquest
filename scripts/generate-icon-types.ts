import fs from 'fs';
import path from 'path';

const ICONS_DIR = path.join(__dirname, '../assets/icons');

// Generate a list of available icons
const icons = fs.readdirSync(ICONS_DIR)
  .filter(file => file.endsWith('.png'));

// Generate the validation code
const content = `
// Auto-generated file, do not edit directly
export const VALID_ICONS = ${JSON.stringify(icons)} as const;
export type IconName = typeof VALID_ICONS[number];
`;

fs.writeFileSync(
  path.join(__dirname, '../types/icons.ts'), 
  content
);