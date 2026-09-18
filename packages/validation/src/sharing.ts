import { z } from "zod";

export const createAccountInviteSchema = z.object({
  role: z.enum(["member", "viewer"]),
  expiresInHours: z.number().int().positive().max(24 * 365).nullable(),
  maxUses: z.number().int().positive().max(100).nullable(),
});
export type CreateAccountInviteInput = z.infer<typeof createAccountInviteSchema>;

export const updateAccountMemberSchema = z.object({ role: z.enum(["owner", "member", "viewer"]) });
export type UpdateAccountMemberInput = z.infer<typeof updateAccountMemberSchema>;

export const inviteTokenSchema = z.object({ token: z.string().min(32).max(200) });
