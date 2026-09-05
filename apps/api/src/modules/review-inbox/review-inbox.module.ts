import { Module } from "@nestjs/common";

import { CategorizationModule } from "../categorization/categorization.module";

import { ReviewInboxController } from "./review-inbox.controller";
import { ReviewInboxService } from "./review-inbox.service";

@Module({
  imports: [CategorizationModule],
  controllers: [ReviewInboxController],
  providers: [ReviewInboxService],
})
export class ReviewInboxModule {}
