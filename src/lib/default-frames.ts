import { FrameTemplate, PhotoSlot } from "@/types/photobooth";

export const DEFAULT_4_SLOTS: PhotoSlot[] = [
  { id: 1, x: 8, y: 6, width: 84, height: 19, zIndex: 2 },
  { id: 2, x: 8, y: 27, width: 84, height: 19, zIndex: 3 },
  { id: 3, x: 8, y: 48, width: 84, height: 19, zIndex: 4 },
  { id: 4, x: 8, y: 69, width: 84, height: 19, zIndex: 5 },
];

export const DEFAULT_8_SLOTS: PhotoSlot[] = [
  // Kolom kiri (1-4)
  { id: 1, x: 5, y: 7, width: 42, height: 18, zIndex: 2 },
  { id: 2, x: 5, y: 27, width: 42, height: 18, zIndex: 3 },
  { id: 3, x: 5, y: 47, width: 42, height: 18, zIndex: 4 },
  { id: 4, x: 5, y: 67, width: 42, height: 18, zIndex: 5 },
  // Kolom kanan (5-8, urutan pose diacak)
  { id: 5, x: 53, y: 7, width: 42, height: 18, zIndex: 6 },
  { id: 6, x: 53, y: 27, width: 42, height: 18, zIndex: 7 },
  { id: 7, x: 53, y: 47, width: 42, height: 18, zIndex: 8 },
  { id: 8, x: 53, y: 67, width: 42, height: 18, zIndex: 9 },
];

export const BUILT_IN_FRAMES: FrameTemplate[] = [
  {
    id: "builtin-classic-cream",
    name: "Klasik Gereja (Krem)",
    frameUrl: null,
    backgroundColor: "#FFFDF7",
    frameZIndex: 1,
    canvasWidth: 680,
    canvasHeight: 1920,
    slots: DEFAULT_4_SLOTS.map((s) => ({ ...s })),
    isBuiltIn: true,
  },
];
