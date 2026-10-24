import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import type { Locale } from "@/i18n/locales";
import type { PageImage, ShowcaseView } from "@/server/services/product.service";
import { VideoEmbedPlayer } from "./video-embed";

function BlockImage({ image, priority = false }: { image: PageImage; priority?: boolean }) {
  const locale = useLocale() as Locale;
  return (
    <div className="bg-muted rounded-panel relative aspect-video w-full overflow-hidden">
      <Image
        src={image.url}
        alt={image.alt[locale]}
        fill
        sizes="(min-width: 1024px) 45vw, 100vw"
        priority={priority}
        loading={priority ? undefined : "lazy"}
        unoptimized={image.isSvg}
        className="object-contain"
      />
    </div>
  );
}

function Credit({ credit }: { credit: string | null }) {
  const t = useTranslations("Product");
  return credit ? (
    <span className="text-small text-muted-foreground block">
      {t("showcaseSource", { credit })}
    </span>
  ) : null;
}

/**
 * "From the manufacturer": the admin-ordered content blocks. Images are our own stored copies (never hotlinked) with
 * alt text; videos load only on request; a video whose URL is not on the allow-list is silently not rendered.
 * The credit line is shown; the internal license note is not (it lives in the admin, ASSETS.md).
 */
export function Showcase({ blocks, title }: { blocks: readonly ShowcaseView[]; title: string }) {
  const t = useTranslations("Product");
  const locale = useLocale() as Locale;
  const visible = blocks.filter((b) => b.type !== "VIDEO" || b.embed !== null);
  if (visible.length === 0) return null;
  return (
    <section
      aria-labelledby="showcase-heading"
      className="flex flex-col gap-6"
      data-testid="showcase"
    >
      <h2 id="showcase-heading" className="text-title font-bold">
        {t("showcaseTitle")}
      </h2>
      <div className="flex flex-col gap-8">
        {visible.map((b, i) => {
          switch (b.type) {
            case "IMAGE":
              return (
                <figure key={b.id} className="flex flex-col gap-2">
                  {b.image ? <BlockImage image={b.image} /> : null}
                  {b.caption || b.credit ? (
                    <figcaption className="text-muted-foreground">
                      {b.caption ? b.caption[locale] : null}
                      <Credit credit={b.credit} />
                    </figcaption>
                  ) : null}
                </figure>
              );
            case "IMAGE_TEXT":
              return (
                <div key={b.id} className="grid items-center gap-4 md:grid-cols-2 md:gap-8">
                  <figure className={`flex flex-col gap-2 ${i % 2 === 1 ? "md:order-last" : ""}`}>
                    {b.image ? <BlockImage image={b.image} /> : null}
                    {b.caption || b.credit ? (
                      <figcaption className="text-small text-muted-foreground">
                        {b.caption ? b.caption[locale] : null}
                        <Credit credit={b.credit} />
                      </figcaption>
                    ) : null}
                  </figure>
                  <div className="flex flex-col gap-2">
                    {b.title ? (
                      <h3 className="text-heading font-semibold">{b.title[locale]}</h3>
                    ) : null}
                    {b.body ? (
                      <p className="text-muted-foreground max-w-prose">{b.body[locale]}</p>
                    ) : null}
                  </div>
                </div>
              );
            case "FEATURE":
              return (
                <div
                  key={b.id}
                  className="border-primary bg-card rounded-panel flex flex-col gap-2 border-s-4 p-5"
                >
                  {b.title ? (
                    <h3 className="text-heading font-semibold">{b.title[locale]}</h3>
                  ) : null}
                  {b.body ? (
                    <p className="text-muted-foreground max-w-prose">{b.body[locale]}</p>
                  ) : null}
                </div>
              );
            case "VIDEO":
              return (
                <figure key={b.id} className="flex flex-col gap-2">
                  {b.embed ? (
                    <VideoEmbedPlayer
                      embed={b.embed}
                      title={b.caption ? b.caption[locale] : `${t("videoTitle")}: ${title}`}
                    />
                  ) : null}
                  {b.caption || b.credit ? (
                    <figcaption className="text-muted-foreground">
                      {b.caption ? b.caption[locale] : null}
                      <Credit credit={b.credit} />
                    </figcaption>
                  ) : null}
                </figure>
              );
          }
        })}
      </div>
    </section>
  );
}
