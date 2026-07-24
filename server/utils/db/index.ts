/// <reference types="@cloudflare/workers-types" />
import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';

export const db = drizzle((env as { DB: D1Database }).DB);
