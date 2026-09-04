import { z } from "zod";

export const categoryTypeSchema = z.enum(["expense", "income"]);

export const createCategorySchema = z.object({
  type: categoryTypeSchema,
  name: z.string().trim().min(1).max(100),
  parentId: z.string().uuid().optional(),
  icon: z.string().max(50).optional(),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
