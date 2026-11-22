export type PhotoFilterId = "none" | "bright" | "bw" | "warm";

export interface PhotoFilterOption {
  id: PhotoFilterId;
  label: string;
  cssFilter: string;
}

export const PHOTO_FILTERS: PhotoFilterOption[] = [
  { id: "none", label: "Asli", cssFilter: "none" },
  {
    id: "bright",
    label: "Cerah",
    cssFilter: "brightness(1.1) contrast(1.05) saturate(1.1)",
  },
  {
    id: "bw",
    label: "Hitam Putih",
    cssFilter: "grayscale(100%) contrast(1.15)",
  },
  {
    id: "warm",
    label: "Hangat",
    cssFilter: "sepia(25%) saturate(1.15) brightness(1.04)",
  },
];

export function getCssFilter(id: PhotoFilterId): string {
  return PHOTO_FILTERS.find((f) => f.id === id)?.cssFilter ?? "none";
}
