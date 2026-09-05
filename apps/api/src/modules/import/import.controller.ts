import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";

import { CurrentUser } from "../../common/current-user.decorator";
import type { AuthenticatedUser } from "../auth/authenticated-request";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

import { ImportService, type ImportPreviewResult } from "./import.service";

/** Only the two fields the import actually reads — avoids depending on multer's global
 * namespace augmentation, which is easy to lose across tsconfig/watcher boundaries. */
export interface UploadedStatementFile {
  originalname: string;
  buffer: Buffer;
}

/** Uploads are the classic abuse surface — cap the size and the rate. */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const IMPORT_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@UseGuards(JwtAuthGuard)
@Controller("import")
export class ImportController {
  constructor(private readonly imports: ImportService) {}

  @Throttle(IMPORT_THROTTLE)
  @Post("preview/:accountId")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  preview(
    @CurrentUser() user: AuthenticatedUser,
    @Param("accountId", ParseUUIDPipe) accountId: string,
    @UploadedFile() file?: UploadedStatementFile,
  ): Promise<ImportPreviewResult> {
    if (!file) throw new BadRequestException("Файл не приложен");
    return this.imports.preview(user.id, accountId, file);
  }

  @Throttle(IMPORT_THROTTLE)
  @Post(":jobId/commit")
  commit(@CurrentUser() user: AuthenticatedUser, @Param("jobId", ParseUUIDPipe) jobId: string) {
    return this.imports.commit(user.id, jobId);
  }

  @Get(":jobId")
  getJob(@CurrentUser() user: AuthenticatedUser, @Param("jobId", ParseUUIDPipe) jobId: string) {
    return this.imports.getJob(user.id, jobId);
  }
}
