import { hairlineWidth } from 'nativewind/theme';
import fs from 'node:fs';
import path from 'node:path';
import { type Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';
import plugin from 'tailwindcss/plugin';

function extractCssVariableBlocks(css: string) {
  const findBlock = (marker: string) => {
    const start = css.indexOf(marker);
    if (start === -1) return '';
    const braceStart = css.indexOf('{', start);
    if (braceStart === -1) return '';
    let depth = 0;
    for (let i = braceStart; i < css.length; i++) {
      const ch = css[i];
      if (ch === '{') depth++;
      if (ch === '}') {
        depth--;
        if (depth === 0) {
          return css.slice(braceStart + 1, i);
        }
      }
    }
    return '';
  };

  const rootBlock = findBlock(':root');
  const darkRootBlock = findBlock('.dark:root');
  return { rootBlock, darkRootBlock };
}

function parseVariables(block: string): Record<string, string> {
  const vars: Record<string, string> = {};
  block
    .split(/\n|;/g)
    .map((l) => l.trim())
    .filter((l) => l.startsWith('--'))
    .forEach((line) => {
      const idx = line.indexOf(':');
      if (idx === -1) return;
      const key = line.slice(0, idx).trim();
      const raw = line.slice(idx + 1).trim();
      const value = raw.replace(/;$/, '');
      vars[key] = value;
    });
  return vars;
}

const generateTokensPlugin = plugin(() => {
  try {
    const cssPath = path.resolve(process.cwd(), 'global.css');
    if (!fs.existsSync(cssPath)) return;
    const css = fs.readFileSync(cssPath, 'utf8');
    const { rootBlock, darkRootBlock } = extractCssVariableBlocks(css);
    if (!rootBlock || !darkRootBlock) return;

    const lightVars = parseVariables(rootBlock);
    const darkVars = parseVariables(darkRootBlock);

    const outPath = path.resolve(process.cwd(), 'generated-tokens.ts');
    const file = `export const cssTokens = {\n  light: ${JSON.stringify(
      { ...darkVars, ...lightVars },
      null,
      4
    ).replaceAll('"', "\'")},\n  dark: ${JSON.stringify(
      { ...lightVars, ...darkVars },
      null,
      4
    ).replaceAll('"', "\'")}\n} as const;\n`
      .replace('},', '  },')
      .replace('}\n}', '  }\n}');
    fs.writeFileSync(outPath, file, 'utf8');
  } catch {
    // Fail silently; this file is optional and generation will retry on next build
  }
});

const config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './views/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}'
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      transitionDuration: {
        DEFAULT: '200ms'
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))'
        }
      },
      borderWidth: {
        hairline: hairlineWidth()
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' }
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out'
      }
    }
  },
  plugins: [tailwindcssAnimate, generateTokensPlugin]
} satisfies Config;

export default config;
