import { baseConfig } from "@money-dock/config/eslint.config.mjs";

export default [
  ...baseConfig,
  {
    ignores: ["expo-env.d.ts", ".expo/**", "web-build/**"],
  },
];
