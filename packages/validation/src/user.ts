import { z } from "zod";

// A data: URI capped well under Postgres's row-size comfort zone — there's no object
// storage yet (see the schema comment on users.avatarUrl), so this is a small profile
// photo, not a general upload path. ~300 000 base64 chars ≈ 220 KB of raw image, which a
// square photo downscaled to a few hundred px comfortably fits.
const MAX_AVATAR_LENGTH = 300_000;

export const updateMeSchema = z.object({
  avatarUrl: z
    .string()
    .max(MAX_AVATAR_LENGTH, "Изображение слишком большое")
    .regex(/^data:image\/(png|jpeg|webp);base64,/, "Ожидается изображение (PNG, JPEG или WebP)")
    .nullable()
    .optional(),
});
export type UpdateMeInput = z.infer<typeof updateMeSchema>;
