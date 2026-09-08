import { z } from "zod";

export const createNoteSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().max(4000).default(""),
  colorIndex: z.number().int().min(0).max(11).default(0),
  pinned: z.boolean().default(false),
});
export type CreateNoteInput = z.infer<typeof createNoteSchema>;

/** Every field optional — the notes screen saves single-field edits (pin, colour, body). */
export const updateNoteSchema = createNoteSchema.partial();
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
