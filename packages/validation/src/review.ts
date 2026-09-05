import { z } from "zod";

export const reviewResolveSchema = z
  .object({
    action: z.enum(["categorize", "confirm_duplicate", "not_duplicate", "dismiss"]),
    categoryId: z.string().uuid().optional(),
  })
  .refine((value) => value.action !== "categorize" || Boolean(value.categoryId), {
    message: "categoryId is required when action is 'categorize'",
    path: ["categoryId"],
  });

export type ReviewResolveInput = z.infer<typeof reviewResolveSchema>;
