import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";

import type { Database } from "./client";
import { DATABASE } from "./database.token";

/** Closes the Postgres connection pool on shutdown — otherwise the process (or a Jest
 * worker running an e2e suite against a real DB) never exits cleanly. */
@Injectable()
export class DbLifecycle implements OnModuleDestroy {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async onModuleDestroy(): Promise<void> {
    await this.db.$client.end({ timeout: 5 });
  }
}
