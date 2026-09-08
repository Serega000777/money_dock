import { Inject, Injectable } from "@nestjs/common";

import type { Database } from "../db/client";
import { DATABASE } from "../db/database.token";
import { auditLogs } from "../db/schema";

export interface AuditLogEntry {
  userId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: unknown;
}

/** Single write path for the append-only audit trail (spec §11: login, delete, export,
 * admin actions must all be traceable) — every module records through this instead of
 * inserting into `audit_logs` itself. */
@Injectable()
export class AuditLogService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async record(entry: AuditLogEntry): Promise<void> {
    await this.db.insert(auditLogs).values(entry);
  }
}
