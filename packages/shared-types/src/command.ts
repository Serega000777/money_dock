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
}

export type Plan = "free" | "pro" | "pro_bank";

export interface Entitlements {
  plan: Plan;
  limits: { voice: number; import: number };
  used: { voice: number; import: number };
}
