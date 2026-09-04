import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { validateEnv } from "./config/env";
import { DbModule } from "./db/db.module";
import { HealthModule } from "./modules/health/health.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      envFilePath: ["../../.env", ".env"],
    }),
    DbModule,
    HealthModule,
  ],
})
export class AppModule {}
