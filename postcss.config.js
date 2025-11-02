const path = require('node:path');
const fs = require('node:fs');

// Simple token generation function (duplicated from tailwind config for now)
function extractCssVariableBlocks(css) {
  const findAllBlocks = (marker, excludeMarker) => {
    const blocks = [];
    let searchStart = 0;

    while (true) {
      const start = css.indexOf(marker, searchStart);
      if (start === -1) break;

      if (excludeMarker) {
        const excludeStart = start - (excludeMarker.length - marker.length);
        if (
          excludeStart >= 0 &&
          css.slice(excludeStart, start + marker.length) === excludeMarker
        ) {
          searchStart = start + marker.length;
          continue;
        }
      }

      const braceStart = css.indexOf('{', start);
      if (braceStart === -1) break;

      let depth = 0;
      for (let i = braceStart; i < css.length; i++) {
        const ch = css[i];
        if (ch === '{') depth++;
        if (ch === '}') {
          depth--;
          if (depth === 0) {
            blocks.push(css.slice(braceStart + 1, i));
            searchStart = i + 1;
            break;
          }
        }
      }
      if (depth !== 0) break;
    }

    return blocks;
  };

  const rootBlocks = findAllBlocks(':root', '.dark:root');
  const darkRootBlocks = findAllBlocks('.dark:root');

  const rootBlock = rootBlocks.join(' ');
  const darkRootBlock = darkRootBlocks.join(' ');

  return { rootBlock, darkRootBlock };
}

function parseVariables(block) {
  const vars = {};
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

function generateTokens() {
  try {
    console.log('[PostCSS] Generating tailwindcss tokens');
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
    ).replaceAll('"', "'")},\n  dark: ${JSON.stringify(
      { ...lightVars, ...darkVars },
      null,
      4
    ).replaceAll('"', "'")}\n} as const;\n`
      .replace('},', '  },')
      .replace('}\n}', '  }\n}');
    fs.writeFileSync(outPath, file, 'utf8');
    console.log('[PostCSS] Successfully generated tailwindcss tokens');
  } catch (error) {
    console.error('[PostCSS] Error generating tailwindcss tokens:', error);
  }
}

// PostCSS plugin that regenerates tokens when global.css is processed
const generateTokensPlugin = () => {
  return {
    postcssPlugin: 'generate-tokens',
    Once(root, { result }) {
      // Only regenerate tokens when processing global.css
      if (result.root.source && result.root.source.input.file) {
        const filePath = result.root.source.input.file;
        if (filePath.includes('global.css')) {
          generateTokens();
        }
      }
    }
  };
};

generateTokensPlugin.postcss = true;

module.exports = {
  plugins: {
    tailwindcss: {},
    [generateTokensPlugin.name]: generateTokensPlugin
  }
};
