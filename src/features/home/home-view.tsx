import { useTranslations } from "next-intl";
import { DemoNotice } from "@/features/catalog/demo-notice";
import { HOME_RAILS, type HomeRailKey } from "@/domain/home";
import type { HomeData } from "@/server/services/home.service";
import { BrandStrip } from "./brand-strip";
import { CategoryTiles } from "./category-tiles";
import { Hero } from "./hero";
import { ProductRail } from "./product-rail";

/** Message keys per rail, kept in one typed map so a new rail cannot be added without its copy. */
type RailTitleKey = `${HomeRailKey}Title`;
type RailLeadKey = `${HomeRailKey}Lead`;
const RAIL_COPY: Record<HomeRailKey, { title: RailTitleKey; lead: RailLeadKey }> = {
  deals: { title: "dealsTitle", lead: "dealsLead" },
  featured: { title: "featuredTitle", lead: "featuredLead" },
  bestSellers: { title: "bestSellersTitle", lead: "bestSellersLead" },
  newArrivals: { title: "newArrivalsTitle", lead: "newArrivalsLead" },
  mostViewed: { title: "mostViewedTitle", lead: "mostViewedLead" },
};

const RAIL_ID: Record<HomeRailKey, string> = {
  deals: "deals",
  featured: "featured",
  bestSellers: "best-sellers",
  newArrivals: "new-arrivals",
  mostViewed: "most-viewed",
};

export function HomeView({ data }: { data: HomeData }) {
  const t = useTranslations("Home");
  const hasProducts = data.hero !== null || HOME_RAILS.some((key) => data.rails[key].length > 0);
  const isEmpty = !hasProducts && data.categories.length === 0;

  return (
    <main
      id="main"
      className="max-w-page px-gutter mx-auto flex w-full flex-1 flex-col gap-10 py-6 sm:py-8 lg:gap-14"
    >
      <Hero hero={data.hero} hasDeals={data.rails.deals.length > 0} />
      <DemoNotice />
      {isEmpty ? (
        <section aria-labelledby="empty-title" className="border-border rounded-panel border p-6">
          <h2 id="empty-title" className="text-heading font-semibold">
            {t("emptyTitle")}
          </h2>
          <p className="text-muted-foreground mt-1 max-w-prose">{t("emptyBody")}</p>
        </section>
      ) : null}
      <CategoryTiles categories={data.categories} />
      {HOME_RAILS.map((key) => (
        <ProductRail
          key={key}
          id={RAIL_ID[key]}
          title={t(RAIL_COPY[key].title)}
          lead={t(RAIL_COPY[key].lead)}
          products={data.rails[key]}
        />
      ))}
      <BrandStrip brands={data.brands} />
    </main>
  );
}
