import { migrate } from "drizzle-orm/postgres-js/migrator";

import { createDatabase } from "./client";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  const db = createDatabase(databaseUrl);
  await migrate(db, { migrationsFolder: "../../infrastructure/migrations" });
  console.log("Migrations applied.");
  process.exit(0);
}

void main();
