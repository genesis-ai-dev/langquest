/**
 * @see https://prettier.io/docs/en/configuration.html
 */
/** @type {import('prettier').Config & import('prettier-plugin-tailwindcss').PluginOptions} */
export default {
  semi: true,
  singleQuote: true,
  trailingComma: 'none',
  plugins: ['prettier-plugin-tailwindcss'],
  tailwindFunctions: ['cva', 'cx', 'cn', 'clsx']
};
