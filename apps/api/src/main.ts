import "reflect-metadata";

import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";

import { AppModule } from "./app.module";
import type { Env } from "./config/env";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<Env, true>);

  app.use(helmet());
  app.enableCors({ origin: config.get("CORS_ORIGIN", { infer: true }) });
  // DTO validation is Zod-based at the boundary (ADR 0008), not class-validator —
  // a request-validation pipe is wired in alongside the first real DTO (Stage 1).

  const port = config.get("PORT", { infer: true });
  await app.listen(port);
}

void bootstrap();
