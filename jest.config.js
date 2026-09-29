/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/testing/jest.setup.ts'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/supabase/functions/',
    '/cloud-services/',
    '/android/',
    '/ios/',
    '/dist/'
  ]
};
