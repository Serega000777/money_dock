/** Minor units → human amount. Money is integer minor units everywhere (ADR 0005). */
export function formatMinor(amountMinor: number): string {
  return (amountMinor / 100).toLocaleString("ru-RU", { maximumFractionDigits: 0 });
}
