export type CategoryType = "expense" | "income";

export interface Category {
  id: string;
  type: CategoryType;
  name: string;
  parentId: string | null;
  icon: string | null;
  isSystem: boolean;
}
