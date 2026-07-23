import process from 'node:process';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './drizzle',
  schema: './server/utils/db/schema.ts',
  dialect: 'sqlite',
  driver: 'd1-http',
  dbCredentials: {
    accountId: process.env.GAVITY_CF_ACCOUNT_ID!,
    databaseId: process.env.GAVITY_CF_DB_ID!,
    token: process.env.GAVITY_CF_TOKEN!,
  },
});
