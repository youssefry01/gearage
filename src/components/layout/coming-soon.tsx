import { useTranslations } from "next-intl";
import { buttonStyles } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { Breadcrumbs, type Crumb } from "./breadcrumbs";

/** Placeholder body for pages whose milestone has not shipped (see config/routes.ts). Always noindex via the page. */
export function ComingSoon({
  title,
  body,
  crumbs,
}: {
  title: string;
  body: string;
  crumbs?: Crumb[];
}) {
  const common = useTranslations("Common");
  return (
    <main
      id="main"
      className="max-w-page px-gutter mx-auto flex w-full flex-1 flex-col gap-6 py-10 sm:py-16"
    >
      {crumbs ? <Breadcrumbs items={crumbs} /> : null}
      <h1 className="text-title font-bold text-balance">{title}</h1>
      <p className="text-muted-foreground max-w-prose">{body}</p>
      <Link href="/" className={`${buttonStyles()} w-fit`}>
        {common("backToHome")}
      </Link>
    </main>
  );
}
