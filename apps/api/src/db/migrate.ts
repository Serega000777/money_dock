import { migrate } from "drizzle-orm/postgres-js/migrator";

import { createDatabase } from "./client";

/**
 * Runs from two places: `pnpm db:migrate` in apps/api during development (migrations
 * live two directories up, in the monorepo's infrastructure/), and `node dist/db/migrate.js`
 * inside the production image, where the Dockerfile copies them next to the app and
 * points MIGRATIONS_DIR at that copy.
 */
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  const migrationsFolder = process.env.MIGRATIONS_DIR ?? "../../infrastructure/migrations";
  const db = createDatabase(databaseUrl);
  await migrate(db, { migrationsFolder });
  console.log("Migrations applied.");
  process.exit(0);
}

void main();
