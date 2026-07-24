/// <reference types="@cloudflare/workers-types" />
import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';

export const d1 = (env as { DB: D1Database }).DB;
export const db = drizzle(d1);
