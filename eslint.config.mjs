import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const banned = (group, message) => ({
  "no-restricted-imports": ["error", { patterns: [{ group, message }] }],
});

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "src/generated/**",
  ]),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  // Layering (HANDOFF §4): domain is pure TS with no I/O.
  {
    files: ["src/domain/**/*.{ts,tsx}"],
    rules: banned(
      [
        "next",
        "next/*",
        "react",
        "react/*",
        "react-dom",
        "@prisma/*",
        "pg",
        "@/server/*",
        "@/features/*",
        "@/components/*",
        "@/app/*",
        "@/lib/*",
      ],
      "domain/ must stay pure: no framework, DB or app-layer imports.",
    ),
  },
  // server/ never imports UI layers.
  {
    files: ["src/server/**/*.{ts,tsx}"],
    rules: banned(
      ["@/features/*", "@/components/*", "@/app/*"],
      "server/ must not import features/, components/ or app/.",
    ),
  },
  // UI code never touches repositories or the db client directly.
  {
    files: ["src/app/**/*.{ts,tsx}", "src/features/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    rules: banned(
      ["@/server/repositories/*", "@/server/db", "@/server/db/*", "@prisma/*"],
      "UI layers must go through server/services, never repositories or Prisma.",
    ),
  },
]);
