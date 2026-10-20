import type {
  SeedBrand,
  SeedBundle,
  SeedCategory,
  SeedProduct,
  SeedSpecs,
  SeedTag,
} from "../types";
import { brands } from "./brands";
import { bundleSpecs, bundles } from "./bundles";
import { audioAccessories, audioAccessorySpecs } from "./catalog/audio-accessories";
import { cpuSpecs, cpus } from "./catalog/cpus";
import { gpuSpecs, gpus } from "./catalog/gpus";
import { laptopSpecs, laptops } from "./catalog/laptops";
import { memory, memorySpecs } from "./catalog/memory";
import { monitorSpecs, monitors } from "./catalog/monitors";
import { motherboardSpecs, motherboards } from "./catalog/motherboards";
import { networking, networkingSpecs } from "./catalog/networking";
import { peripheralSpecs, peripherals } from "./catalog/peripherals";
import {
  cases,
  caseSpecs,
  coolers,
  coolingSpecs,
  powerSupplies,
  psuSpecs,
} from "./catalog/power-cases-cooling";
import { storage, storageSpecs } from "./catalog/storage";
import { categories } from "./categories";
import { tags } from "./tags";

export type SeedData = {
  categories: readonly SeedCategory[];
  brands: readonly SeedBrand[];
  tags: readonly SeedTag[];
  specDefinitions: SeedSpecs;
  products: readonly SeedProduct[];
  bundles: readonly SeedBundle[];
};

const specFiles: readonly SeedSpecs[] = [
  cpuSpecs,
  gpuSpecs,
  motherboardSpecs,
  memorySpecs,
  storageSpecs,
  psuSpecs,
  caseSpecs,
  coolingSpecs,
  laptopSpecs,
  monitorSpecs,
  peripheralSpecs,
  networkingSpecs,
  audioAccessorySpecs,
  bundleSpecs,
];

function mergeSpecs(files: readonly SeedSpecs[]): SeedSpecs {
  const merged: Record<string, SeedSpecs[string]> = {};
  for (const file of files) {
    for (const [path, defs] of Object.entries(file)) {
      if (path in merged) throw new Error(`spec definitions for "${path}" are declared twice`);
      merged[path] = defs;
    }
  }
  return merged;
}

/** Everything the seed writes, from the per-category data files. */
export function loadSeedData(): SeedData {
  return {
    categories,
    brands,
    tags,
    specDefinitions: mergeSpecs(specFiles),
    products: [
      ...cpus,
      ...gpus,
      ...motherboards,
      ...memory,
      ...storage,
      ...powerSupplies,
      ...cases,
      ...coolers,
      ...laptops,
      ...monitors,
      ...peripherals,
      ...networking,
      ...audioAccessories,
    ],
    bundles,
  };
}
