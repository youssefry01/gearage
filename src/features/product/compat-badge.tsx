import { CircleAlert, CircleCheck, CircleX } from "lucide-react";
import { useTranslations } from "next-intl";
import type { CompatibilityReport } from "@/domain/compatibility";

type Translate = (key: string, values?: Record<string, string | number>) => string;

/**
 * Compatibility verdict of a bundle, from the pure rules module (the PC Builder reuses the same one). Status is
 * conveyed by icon and words, not colour alone. Issue texts come from the Compatibility messages by the rule's
 * messageKey; a key without a message degrades to the generic notes line instead of printing a raw key.
 */
export function CompatibilityBadge({ report }: { report: CompatibilityReport }) {
  const t = useTranslations("Compatibility");
  const issues = report.issues;
  const status = !report.compatible ? "problem" : issues.length > 0 ? "notes" : "ok";
  const Icon = status === "ok" ? CircleCheck : status === "notes" ? CircleAlert : CircleX;
  const tone =
    status === "ok" ? "text-success" : status === "notes" ? "text-warning" : "text-danger";
  const translate = t as unknown as Translate;
  const lines = issues.flatMap((i) =>
    t.has(i.messageKey as never) ? [translate(i.messageKey, i.params ?? {})] : [],
  );
  return (
    <div className="flex flex-col gap-2" data-testid="compat-badge" data-status={status}>
      <p className={`${tone} inline-flex items-center gap-2 font-semibold`}>
        <Icon aria-hidden="true" className="size-5 shrink-0" />
        {t(status)}
      </p>
      <p className="text-small text-muted-foreground">{t("intro")}</p>
      {lines.length > 0 ? (
        <ul className="text-small text-muted-foreground list-disc ps-5">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
