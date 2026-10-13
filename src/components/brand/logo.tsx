import { useLocale } from "next-intl";
import Image from "next/image";
import { brand, storeName, type LogoAsset } from "@/config/brand";

type Props = {
  variant: keyof typeof brand.logo;
  /** Set the WIDTH with a class (e.g. "w-56"); height follows the artwork's aspect ratio. */
  className?: string;
  /** Above-the-fold logo (LCP candidate): preloaded, high fetch priority, never lazy, in both artworks. */
  preload?: boolean;
  sizes?: string;
};

/**
 * The store logo, exactly as provided (public/brand/, docs/BRAND.md). Renders the on-dark and on-light artwork and
 * lets CSS show the one matching the active theme, so there is no flash and no client JS.
 *
 * Accessible name: screen-reader text, NOT an image `alt`. Which artwork is visible depends on the theme, and a
 * `display:none` image contributes no name, so a name carried by one image would vanish in the other theme (an
 * unlabeled home link in light mode). Both images are decorative.
 *
 * Loading: the visible artwork depends on the theme, which the server does not know. So for an above-the-fold
 * logo BOTH artworks load eagerly with high priority (a lazy image that turns out to be visible is an LCP problem).
 * Below the fold, the hidden artwork stays lazy.
 */
export function Logo({
  variant,
  className = "",
  preload = false,
  sizes = "(min-width: 640px) 20rem, 16rem",
}: Props) {
  const locale = useLocale() as Parameters<typeof storeName>[0];
  const { onDark, onLight } = brand.logo[variant];

  const shared = (asset: LogoAsset) => ({
    src: asset.src,
    width: asset.width,
    height: asset.height,
    sizes,
  });

  return (
    <span
      className={`inline-block ${className}`}
      style={{ aspectRatio: `${onDark.width} / ${onDark.height}` }}
    >
      <span className="sr-only" translate="no">
        {storeName(locale)}
      </span>
      <Image
        {...shared(onDark)}
        alt=""
        aria-hidden="true"
        preload={preload}
        fetchPriority={preload ? "high" : undefined}
        className="logo-on-dark size-full object-contain"
      />
      <Image
        {...shared(onLight)}
        alt=""
        aria-hidden="true"
        loading={preload ? "eager" : "lazy"}
        fetchPriority={preload ? "high" : undefined}
        className="logo-on-light size-full object-contain"
      />
    </span>
  );
}
