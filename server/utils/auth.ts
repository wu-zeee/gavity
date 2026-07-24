import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { betterAuth } from 'better-auth/minimal';
import { db } from './db';
import * as schema from './db/schema/auth';
import { hashPassword, verifyPassword } from './password';

export const auth = betterAuth({
  basePath: '/api/auth',
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema,
    usePlural: true,
  }),
  emailAndPassword: {
    enabled: true,
    password: {
      hash: hashPassword,
      verify: verifyPassword,
    },
  },
});
