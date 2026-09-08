import type { MiddlewareConsumer, NestModule } from "@nestjs/common";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";

import { correlationIdMiddleware } from "./common/correlation-id.middleware";
import { HttpExceptionFilter } from "./common/http-exception.filter";
import { validateEnv } from "./config/env";
import { DbModule } from "./db/db.module";
import { AccountsModule } from "./modules/accounts/accounts.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { AuthModule } from "./modules/auth/auth.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { CategorizationModule } from "./modules/categorization/categorization.module";
import { CommandsModule } from "./modules/commands/commands.module";
import { DemoModule } from "./modules/demo/demo.module";
import { EntitlementsModule } from "./modules/entitlements/entitlements.module";
import { ExportModule } from "./modules/export/export.module";
import { HealthModule } from "./modules/health/health.module";
import { ImportModule } from "./modules/import/import.module";
import { NotesModule } from "./modules/notes/notes.module";
import { ReviewInboxModule } from "./modules/review-inbox/review-inbox.module";
import { TransactionsModule } from "./modules/transactions/transactions.module";
import { UsersModule } from "./modules/users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      envFilePath: ["../../.env", ".env"],
    }),
    ThrottlerModule.forRoot({ throttlers: [{ limit: 100, ttl: 60_000 }] }),
    DbModule,
    AuthModule,
    UsersModule,
    AccountsModule,
    CategoriesModule,
    CategorizationModule,
    TransactionsModule,
    ImportModule,
    NotesModule,
    ReviewInboxModule,
    CommandsModule,
    EntitlementsModule,
    ExportModule,
    DemoModule,
    AnalyticsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  // Registered here (not only in main.ts) so `Test.createTestingModule({ imports:
  // [AppModule] })` — what every e2e spec uses — gets the same correlation id on every
  // request, not just a production bootstrap.
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(correlationIdMiddleware).forRoutes("*");
  }
}
