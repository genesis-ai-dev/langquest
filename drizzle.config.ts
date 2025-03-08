import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './db/drizzleSchema.ts',
  dbCredentials: {
    url: './sqlite.db'
  },
  casing: 'snake_case'
});
