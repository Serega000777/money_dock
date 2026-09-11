export type OnboardingArtVariant = "accounts" | "quickAdd" | "analytics";

export interface OnboardingStep {
  key: OnboardingArtVariant;
  title: string;
  subtitle: string;
}

export const onboardingSteps: OnboardingStep[] = [
  {
    key: "accounts",
    title: "Все счета — в одном месте",
    subtitle:
      "Наличные, карты и банковские счета с общим балансом на одном экране, без переключения между банковскими приложениями.",
  },
  {
    key: "quickAdd",
    title: "Добавляйте траты за секунду",
    subtitle:
      "Скажите или напишите, что купили, — сумма, категория и продавец распознаются автоматически.",
  },
  {
    key: "analytics",
    title: "Аналитика, которая объясняет",
    subtitle:
      "Понятные графики по категориям и периодам показывают, куда уходят деньги и на чём можно сэкономить.",
  },
];
