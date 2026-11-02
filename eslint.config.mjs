import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Third-party SDKs that may be imported in exactly one place each (ADR 0013, 0021, 0003). Everything else uses the wrapper.
const sdkBans = [
  {
    group: ["next-safe-action", "next-safe-action/*"],
    message:
      "Define actions with publicAction/authedAction from @/server/actions/client (ADR 0013).",
  },
  {
    group: ["@node-rs/argon2"],
    message: "Hash and verify passwords only through @/server/security/password (ADR 0003).",
  },
  {
    group: ["@upstash/redis"],
    message: "Rate limiting goes through @/server/security/rate-limit (ADR 0021).",
  },
];

const banned = (group, message) => ({
  "no-restricted-imports": ["error", { patterns: [...sdkBans, { group, message }] }],
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
    ".emails/**",
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
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": ["error", { patterns: sdkBans }] },
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
  // The one file each SDK is allowed in.
  {
    files: [
      "src/server/actions/**/*.ts",
      "src/**/*.actions.ts",
      "src/server/security/password.ts",
      "src/server/security/rate-limit/stores.ts",
    ],
    rules: { "no-restricted-imports": "off" },
  },
]);
