"use client";

import { Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { VideoEmbed } from "@/domain/embed";

/**
 * Click-to-load video. Nothing is requested from YouTube until the shopper presses play (privacy and speed: no
 * third-party iframe on page load, which also keeps the cookie banner honest). The iframe URL is `embed.src`, which
 * parseVideoEmbed rebuilt from a validated video id.
 */
export function VideoEmbedPlayer({ embed, title }: { embed: VideoEmbed; title: string }) {
  const t = useTranslations("Product");
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="bg-muted rounded-panel relative aspect-video w-full overflow-hidden">
      {loaded ? (
        <iframe
          src={`${embed.src}?autoplay=1&rel=0`}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 size-full border-0"
        />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-3 p-4 text-center">
          <button
            type="button"
            onClick={() => setLoaded(true)}
            className="bg-primary text-primary-foreground hover:bg-primary-hover rounded-control inline-flex min-h-11 items-center gap-2 px-5 font-semibold"
          >
            <Play aria-hidden="true" className="size-5 rtl:-scale-x-100" />
            {t("videoPlay")}
            <span className="sr-only">: {title}</span>
          </button>
          <p className="text-small text-muted-foreground max-w-sm">{t("videoNote")}</p>
        </div>
      )}
    </div>
  );
}
