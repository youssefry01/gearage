"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("Error");
  const common = useTranslations("Common");
  return (
    <main
      id="main"
      className="max-w-page px-gutter mx-auto flex w-full flex-1 flex-col justify-center gap-4 py-12"
    >
      <h1 className="text-title font-bold text-balance">{t("title")}</h1>
      <p className="text-muted-foreground max-w-prose">{t("body")}</p>
      <Button onClick={reset} className="w-fit">
        {common("tryAgain")}
      </Button>
    </main>
  );
}
