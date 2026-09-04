import { baseConfig } from "@money-dock/config/eslint.config.mjs";

export default [
  ...baseConfig,
  {
    rules: {
      // Nest relies on parameter-property injection and empty constructors.
      "@typescript-eslint/no-empty-object-type": "off",
      // A class only referenced as a constructor-parameter type is still a runtime
      // dependency for Nest's DI (design:paramtypes metadata) — auto-fixing it to
      // `import type` silently breaks injection. Unsafe to auto-fix in this codebase.
      "@typescript-eslint/consistent-type-imports": "off",
    },
  },
];
