import { useLocale } from "next-intl";
import Image from "next/image";
import { brand, storeName, type LogoAsset } from "@/config/brand";

type Props = {
  variant: keyof typeof brand.logo;
  /** Set the WIDTH with a class (e.g. "w-56"); height follows the artwork's aspect ratio. */
  className?: string;
  /** Mark the above-the-fold logo so it is preloaded. */
  priority?: boolean;
  sizes?: string;
};

/**
 * The store logo, exactly as provided (public/brand/, docs/BRAND.md). Renders the on-dark and on-light artwork and
 * lets CSS show the one matching the active theme, so there is no flash and no client JS. The hidden one is lazy.
 */
export function Logo({
  variant,
  className = "",
  priority = false,
  sizes = "(min-width: 640px) 20rem, 16rem",
}: Props) {
  const locale = useLocale() as Parameters<typeof storeName>[0];
  const { onDark, onLight } = brand.logo[variant];
  const alt = storeName(locale);

  const visible = (asset: LogoAsset) => (
    <Image
      src={asset.src}
      width={asset.width}
      height={asset.height}
      alt={alt}
      priority={priority}
      sizes={sizes}
      className="logo-on-dark size-full object-contain"
    />
  );
  const hidden = (asset: LogoAsset) => (
    <Image
      src={asset.src}
      width={asset.width}
      height={asset.height}
      alt=""
      aria-hidden="true"
      loading="lazy"
      sizes={sizes}
      className="logo-on-light size-full object-contain"
    />
  );

  return (
    <span
      className={`inline-block ${className}`}
      style={{ aspectRatio: `${onDark.width} / ${onDark.height}` }}
    >
      {visible(onDark)}
      {hidden(onLight)}
    </span>
  );
}
