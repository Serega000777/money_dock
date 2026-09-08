import type { Note } from "@money-dock/shared-types";
import type { CreateNoteInput, UpdateNoteInput } from "@money-dock/validation";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";

import type { Database } from "../../db/client";
import { DATABASE } from "../../db/database.token";
import { firstOrThrow } from "../../db/first-or-throw";
import { notes } from "../../db/schema";

function toNote(row: typeof notes.$inferSelect): Note {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    colorIndex: row.colorIndex,
    pinned: row.pinned,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class NotesService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** Pinned first, then most recently touched — the order the list is read in. */
  async list(userId: string): Promise<Note[]> {
    const rows = await this.db
      .select()
      .from(notes)
      .where(eq(notes.userId, userId))
      .orderBy(desc(notes.pinned), desc(notes.updatedAt));
    return rows.map(toNote);
  }

  async create(userId: string, input: CreateNoteInput): Promise<Note> {
    const rows = await this.db
      .insert(notes)
      .values({ ...input, userId })
      .returning();
    return toNote(firstOrThrow(rows));
  }

  async update(userId: string, id: string, input: UpdateNoteInput): Promise<Note> {
    const rows = await this.db
      .update(notes)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))
      .returning();
    if (rows.length === 0) throw new NotFoundException("Note not found");
    return toNote(firstOrThrow(rows));
  }

  async remove(userId: string, id: string): Promise<void> {
    const deleted = await this.db
      .delete(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))
      .returning({ id: notes.id });
    if (deleted.length === 0) throw new NotFoundException("Note not found");
  }
}
