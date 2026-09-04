import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { Env } from "../config/env";

import { createDatabase } from "./client";
import { DATABASE } from "./database.token";
import { DbLifecycle } from "./db-lifecycle.provider";

@Global()
@Module({
  providers: [
    {
      provide: DATABASE,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        createDatabase(config.get("DATABASE_URL", { infer: true })),
    },
    DbLifecycle,
  ],
  exports: [DATABASE],
})
export class DbModule {}
