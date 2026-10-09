export interface CommandDraft {
  type: "expense" | "income";
  amountMinor: number;
  currency: string;
  accountId: string | null;
  accountName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  occurredAt: string;
  confidence: number;
  explanation: string[];
  description: string | null;
  requiresConfirmation: boolean;
}

export type Plan = "free" | "pro" | "pro_bank";

/**
 * Bank-branded card designs (logos, card art) are free for everyone while the banks'
 * permission is being requested — selling access to someone else's trademarks as a paid
 * Pro perk is the riskiest way to use them. Flip to true once written permission exists:
 * the API gate, the picker's lock and the Pro feature lists all follow this one flag.
 */
export const BANK_CARD_DESIGNS_PRO_ONLY = false;

export interface Entitlements {
  plan: Plan;
  limits: Record<"voice" | "import" | "assistant" | "shortcut", number>;
  used: Record<"voice" | "import" | "assistant" | "shortcut", number>;
}
