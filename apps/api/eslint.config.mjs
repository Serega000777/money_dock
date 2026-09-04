import { baseConfig } from "@money-dock/config/eslint.config.mjs";

export default [
  ...baseConfig,
  {
    rules: {
      // Nest relies on parameter-property injection and empty constructors.
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },
];
