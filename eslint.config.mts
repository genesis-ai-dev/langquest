// @ts-check

import { fixupPluginRules, includeIgnoreFile } from '@eslint/compat';
import eslint from '@eslint/js';
import * as drizzlePlugin from 'eslint-plugin-drizzle';
import importPlugin from 'eslint-plugin-import';
import reactPlugin from 'eslint-plugin-react';
import reactCompilerPlugin from 'eslint-plugin-react-compiler';
import hooksPlugin from 'eslint-plugin-react-hooks';
import { defineConfig } from 'eslint/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tseslint from 'typescript-eslint';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const gitignorePath = path.resolve(__dirname, '.gitignore');

// From https://github.com/t3-oss/create-t3-turbo/tree/main/tooling/eslint (react + base)
export default defineConfig(
  includeIgnoreFile(gitignorePath),
  {
    ignores: [
      '**/*.config.*',
      '.expo/**',
      'expo-plugins/**',
      'android/**',
      'ios/**',
      'node_modules/**',
      'dist/**'
    ]
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    linterOptions: { reportUnusedDisableDirectives: true },
    languageOptions: { parserOptions: { projectService: true } }
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      // @ts-expect-error - Type incompatibility with ESLint 9, but fixupPluginRules handles it at runtime
      import: fixupPluginRules(importPlugin),
      // @ts-expect-error - Type incompatibility with ESLint 9, but fixupPluginRules handles it at runtime
      react: fixupPluginRules(reactPlugin),
      // @ts-expect-error - Type incompatibility with ESLint 9, but fixupPluginRules handles it at runtime
      'react-compiler': fixupPluginRules(reactCompilerPlugin),
      // @ts-expect-error - Type incompatibility with ESLint 9, but v7+ has native support at runtime
      'react-hooks': hooksPlugin,
      drizzle: fixupPluginRules(drizzlePlugin)
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ],
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' }
      ],
      '@typescript-eslint/no-misused-promises': [
        2,
        { checksVoidReturn: { attributes: false } }
      ],
      '@typescript-eslint/no-unnecessary-condition': [
        'error',
        {
          allowConstantLoopConditions: true
        }
      ],
      'react-hooks/exhaustive-deps': [
        'error',
        {
          additionalHooks: '(useAnimatedStyle|useDerivedValue|useAnimatedProps)'
        }
      ],
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      'import/consistent-type-specifier-style': ['error', 'prefer-top-level'],
      ...reactPlugin.configs['jsx-runtime'].rules,
      ...hooksPlugin.configs.recommended.rules,
      'react-compiler/react-compiler': 'error'
    }
  }
);
