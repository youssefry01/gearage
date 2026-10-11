import type { Metadata, Viewport } from "next";
import { SkipLink } from "@/components/skip-link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Gearage", template: "%s | Gearage" },
  description:
    "PC hardware for Egypt: CPUs, GPUs, motherboards, memory, storage and ready-built bundles.",
};

export const viewport: Viewport = { themeColor: "#0d1114", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <body className="min-h-dvh antialiased">
        <SkipLink />
        {children}
      </body>
    </html>
  );
}
