import "reflect-metadata";

import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { json } from "express";
import helmet from "helmet";

import { AppModule } from "./app.module";
import { parseCorsOrigins, type Env } from "./config/env";

async function bootstrap() {
  // Nest's default JSON body parser caps requests at 100kb, which a profile-photo upload
  // (avatarUrl, a data: URI up to ~300KB — see updateMeSchema) blows straight through,
  // failing closed as an unhandled 500 rather than the schema's own 400. `bodyParser:
  // false` skips Nest's auto-registered parser so this replacement is the only one.
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: "1mb" }));
  const config = app.get(ConfigService<Env, true>);

  app.enableShutdownHooks();
  app.use(helmet());
  app.enableCors({ origin: parseCorsOrigins(config.get("CORS_ORIGIN", { infer: true })) });
  // Correlation-id middleware and the error envelope filter are wired in AppModule
  // (not here) so e2e tests, which compile AppModule directly, get them too.
  // DTO validation is Zod-based at the boundary (ADR 0008), not class-validator —
  // a request-validation pipe is wired in alongside the first real DTO (Stage 1).

  const port = config.get("PORT", { infer: true });
  await app.listen(port);
}

void bootstrap();
