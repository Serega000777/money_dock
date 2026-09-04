import { Controller, Get, Inject } from "@nestjs/common";
import { sql } from "drizzle-orm";

import type { Database } from "../../db/client";
import { DATABASE } from "../../db/database.token";

export interface HealthResponse {
  status: "ok" | "degraded";
  db: "ok" | "error";
}

@Controller("health")
export class HealthController {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  @Get()
  async check(): Promise<HealthResponse> {
    try {
      await this.db.execute(sql`select 1`);
      return { status: "ok", db: "ok" };
    } catch {
      return { status: "degraded", db: "error" };
    }
  }
}
