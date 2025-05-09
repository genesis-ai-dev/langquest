import eslint from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import reactPlugin from 'eslint-plugin-react';
import hooksPlugin from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

// From https://github.com/t3-oss/create-t3-turbo/tree/main/tooling/eslint (react + base)
export default tseslint.config(
  { ignores: ['**/*.config.*'] },
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      import: importPlugin,
      react: reactPlugin,
      hooks: hooksPlugin
    },
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylisticTypeChecked
    ],
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
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      'import/consistent-type-specifier-style': ['error', 'prefer-top-level'],
      ...reactPlugin.configs['jsx-runtime'].rules
    }
  },
  {
    linterOptions: { reportUnusedDisableDirectives: true },
    languageOptions: { parserOptions: { projectService: true } }
  }
);
