import { useTranslations } from "next-intl";
import { buttonStyles } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function NotFoundPage() {
  const t = useTranslations("NotFound");
  const common = useTranslations("Common");
  return (
    <main
      id="main"
      className="max-w-page px-gutter mx-auto flex w-full flex-1 flex-col justify-center gap-4 py-12"
    >
      <h1 className="text-title font-bold text-balance">{t("title")}</h1>
      <p className="text-muted-foreground max-w-prose">{t("body")}</p>
      <Link href="/" className={`${buttonStyles()} w-fit`}>
        {common("backToHome")}
      </Link>
    </main>
  );
}
