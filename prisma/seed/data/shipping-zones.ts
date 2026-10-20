/**
 * Shipping zones by governorate: DATA ONLY. The tables that store them arrive in M6a (shipping zones and fees), so the
 * seed validates this file but does not insert it yet. Fees, delivery times and the free-shipping threshold are
 * ILLUSTRATIVE and must be confirmed with the delivery partner before launch (HANDOFF known issue 20: no delivery
 * claim is shown to shoppers until the owner confirms them).
 */
import type { Localized } from "../types";
import { t } from "./helpers";

export type SeedGovernorate = { code: string; name: Localized };
export type SeedShippingZone = {
  code: string;
  name: Localized;
  governorates: readonly string[];
  /** Illustrative flat fee in whole EGP. */
  feeEgp: number;
  /** Delivery estimate in working days. */
  etaDays: { min: number; max: number };
};

/** The 27 governorates of Egypt. */
export const governorates: readonly SeedGovernorate[] = [
  { code: "cairo", name: t("Cairo", "القاهرة") },
  { code: "giza", name: t("Giza", "الجيزة") },
  { code: "alexandria", name: t("Alexandria", "الإسكندرية") },
  { code: "qalyubia", name: t("Qalyubia", "القليوبية") },
  { code: "port-said", name: t("Port Said", "بورسعيد") },
  { code: "suez", name: t("Suez", "السويس") },
  { code: "dakahlia", name: t("Dakahlia", "الدقهلية") },
  { code: "sharqia", name: t("Sharqia", "الشرقية") },
  { code: "gharbia", name: t("Gharbia", "الغربية") },
  { code: "monufia", name: t("Monufia", "المنوفية") },
  { code: "kafr-el-sheikh", name: t("Kafr El Sheikh", "كفر الشيخ") },
  { code: "beheira", name: t("Beheira", "البحيرة") },
  { code: "ismailia", name: t("Ismailia", "الإسماعيلية") },
  { code: "damietta", name: t("Damietta", "دمياط") },
  { code: "faiyum", name: t("Faiyum", "الفيوم") },
  { code: "beni-suef", name: t("Beni Suef", "بني سويف") },
  { code: "minya", name: t("Minya", "المنيا") },
  { code: "asyut", name: t("Asyut", "أسيوط") },
  { code: "sohag", name: t("Sohag", "سوهاج") },
  { code: "qena", name: t("Qena", "قنا") },
  { code: "luxor", name: t("Luxor", "الأقصر") },
  { code: "aswan", name: t("Aswan", "أسوان") },
  { code: "red-sea", name: t("Red Sea", "البحر الأحمر") },
  { code: "new-valley", name: t("New Valley", "الوادي الجديد") },
  { code: "matrouh", name: t("Matrouh", "مطروح") },
  { code: "north-sinai", name: t("North Sinai", "شمال سيناء") },
  { code: "south-sinai", name: t("South Sinai", "جنوب سيناء") },
];

export const shippingZones: readonly SeedShippingZone[] = [
  {
    code: "greater-cairo",
    name: t("Greater Cairo", "القاهرة الكبرى"),
    governorates: ["cairo", "giza", "qalyubia"],
    feeEgp: 60,
    etaDays: { min: 1, max: 2 },
  },
  {
    code: "alexandria",
    name: t("Alexandria", "الإسكندرية"),
    governorates: ["alexandria"],
    feeEgp: 80,
    etaDays: { min: 2, max: 3 },
  },
  {
    code: "delta",
    name: t("Nile Delta", "الدلتا"),
    governorates: [
      "dakahlia",
      "sharqia",
      "gharbia",
      "monufia",
      "kafr-el-sheikh",
      "beheira",
      "damietta",
    ],
    feeEgp: 90,
    etaDays: { min: 2, max: 3 },
  },
  {
    code: "canal",
    name: t("Suez Canal", "القناة"),
    governorates: ["port-said", "ismailia", "suez"],
    feeEgp: 90,
    etaDays: { min: 2, max: 3 },
  },
  {
    code: "upper-egypt",
    name: t("Upper Egypt", "الصعيد"),
    governorates: ["faiyum", "beni-suef", "minya", "asyut", "sohag", "qena", "luxor", "aswan"],
    feeEgp: 110,
    etaDays: { min: 3, max: 5 },
  },
  {
    code: "red-sea-sinai-frontier",
    name: t("Red Sea, Sinai and Frontier", "البحر الأحمر وسيناء والمحافظات الحدودية"),
    governorates: ["red-sea", "new-valley", "matrouh", "north-sinai", "south-sinai"],
    feeEgp: 140,
    etaDays: { min: 4, max: 7 },
  },
];

/** Orders at or above this amount ship free (illustrative, whole EGP). Becomes a StoreSetting in M6a. */
export const freeShippingThresholdEgp = 5000;
