import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Native addons must not be bundled: pg (optional native bindings) and the Argon2 binary (.node files).
  serverExternalPackages: ["pg", "@node-rs/argon2"],
};

export default withNextIntl(nextConfig);
