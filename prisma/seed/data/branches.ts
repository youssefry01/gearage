/**
 * Sample branches for the store locator: DATA ONLY, and entirely fictional. The Branch table and the locator arrive in
 * M12. Addresses are placeholders, the coordinates are only the rough centre of each district (enough to exercise the
 * map), and the phone numbers are not real.
 */
import type { Localized } from "../types";
import { t } from "./helpers";

export type SeedBranch = {
  code: string;
  name: Localized;
  governorate: string;
  address: Localized;
  lat: number;
  lng: number;
  phone: string;
  /** Opening hours per day (0 = Sunday ... 6 = Saturday); null = closed. */
  hours: Readonly<Record<number, { open: string; close: string } | null>>;
};

const standard = {
  0: { open: "10:00", close: "22:00" },
  1: { open: "10:00", close: "22:00" },
  2: { open: "10:00", close: "22:00" },
  3: { open: "10:00", close: "22:00" },
  4: { open: "10:00", close: "22:00" },
  5: { open: "14:00", close: "22:00" },
  6: { open: "10:00", close: "22:00" },
} as const;

export const branches: readonly SeedBranch[] = [
  {
    code: "nasr-city",
    name: t("Nasr City (sample)", "مدينة نصر (مثال)"),
    governorate: "cairo",
    address: t("Sample address, Nasr City, Cairo", "عنوان تجريبي، مدينة نصر، القاهرة"),
    lat: 30.0561,
    lng: 31.33,
    phone: "010 0000 0001",
    hours: standard,
  },
  {
    code: "dokki",
    name: t("Dokki (sample)", "الدقي (مثال)"),
    governorate: "giza",
    address: t("Sample address, Dokki, Giza", "عنوان تجريبي، الدقي، الجيزة"),
    lat: 30.0382,
    lng: 31.2124,
    phone: "010 0000 0002",
    hours: standard,
  },
  {
    code: "smouha",
    name: t("Smouha (sample)", "سموحة (مثال)"),
    governorate: "alexandria",
    address: t("Sample address, Smouha, Alexandria", "عنوان تجريبي، سموحة، الإسكندرية"),
    lat: 31.2156,
    lng: 29.9439,
    phone: "010 0000 0003",
    hours: standard,
  },
];
