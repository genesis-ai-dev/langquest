import reactPlugin from 'eslint-plugin-react';
import hooksPlugin from 'eslint-plugin-react-hooks';
import * as path from "node:path";
import { includeIgnoreFile } from "@eslint/compat";
import eslint from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import turboPlugin from "eslint-plugin-turbo";
import tseslint from "typescript-eslint";

/** @type {import("eslint").Linter.Config} */
// export default {
//   extends: [
//     'expo',
//     'eslint:recommended',
//     'plugin:@typescript-eslint/recommended-type-checked',
//     'plugin:@typescript-eslint/stylistic-type-checked',
//     'plugin:react/recommended',
//     'plugin:react-hooks/recommended',
//     'plugin:jsx-a11y/recommended',
//     'prettier',
//   ],
//   parser: '@typescript-eslint/parser',
//   plugins: {
//     '@typescript-eslint': '@typescript-eslint',
//     import: 'import',
//     react: reactPlugin,
//     'react-hooks': hooksPlugin,
//   },
//   rules: {
//     'react/prop-types': 'off',
//     'no-empty': 'off',
//     'turbo/no-undeclared-env-vars': 'off',
//     '@typescript-eslint/no-unused-vars': [
//       'error',
//       { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
//     ],
//     '@typescript-eslint/consistent-type-imports': [
//       'warn',
//       { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
//     ],
//     '@typescript-eslint/no-misused-promises': [
//       2,
//       { checksVoidReturn: { attributes: false } },
//     ],
//     'import/consistent-type-specifier-style': ['error', 'prefer-top-level'],
    // ...reactPlugin.configs['jsx-runtime'].rules,
    // ...hooksPlugin.configs.recommended.rules,
//   },
//   languageOptions: {
//     globals: {
//       React: 'writable',
//     },
//   },
//   ignorePatterns: [
//     '**/*.d.ts',
//     '**/.eslintrc.cjs',
//     '**/*.config.js',
//     '**/*.config.cjs',
//     '.next',
//     'dist',
//     'pnpm-lock.yaml',
//   ],
//   reportUnusedDisableDirectives: true,
// };

// From https://github.com/t3-oss/create-t3-turbo/tree/main/tooling/eslint (react + base)
export default tseslint.config(
  // Ignore files not tracked by VCS and any config files
  includeIgnoreFile(path.join(import.meta.dirname, "../../.gitignore")),
  { ignores: ["**/*.config.*"] },
  {
    files: ["**/*.js", "**/*.ts", "**/*.tsx"],
    plugins: {
      import: importPlugin,
      react: reactPlugin,
      "react-hooks": hooksPlugin,
    },
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    rules: {
      ...turboPlugin.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
      "@typescript-eslint/no-misused-promises": [
        2,
        { checksVoidReturn: { attributes: false } },
      ],
      "@typescript-eslint/no-unnecessary-condition": [
        "error",
        {
          allowConstantLoopConditions: true,
        },
      ],
      "@typescript-eslint/no-non-null-assertion": "error",
      "import/consistent-type-specifier-style": ["error", "prefer-top-level"],
      ...reactPlugin.configs['jsx-runtime'].rules,
      ...hooksPlugin.configs.recommended.rules,
    },
  },
  {
    linterOptions: { reportUnusedDisableDirectives: true },
    languageOptions: { parserOptions: { projectService: true } },
  },
);