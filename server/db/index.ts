import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema.js';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    'DATABASE_URL não definida. Copie .env.example para .env e cole a connection string do Neon.',
  );
}

const sql = neon(url);
export const db = drizzle(sql, { schema });
export { schema };
