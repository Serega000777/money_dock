export type CategoryType = "expense" | "income";

export interface Category {
  id: string;
  type: CategoryType;
  name: string;
  parentId: string | null;
  icon: string | null;
  /** Hex from the client's fixed palette; null for the seeded categories (hash-of-id fallback). */
  color: string | null;
  /** Stable code for the seeded categories; null for user-created ones. Drives icon choice. */
  systemCode: string | null;
  isSystem: boolean;
}
