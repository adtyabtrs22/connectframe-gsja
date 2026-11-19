export interface PhotoSlot {
  id: number;
  /** Posisi horizontal dalam persen (0 - 100) dari lebar canvas */
  x: number;
  /** Posisi vertikal dalam persen (0 - 100) dari tinggi canvas */
  y: number;
  /** Lebar kotak dalam persen (0 - 100) */
  width: number;
  /** Tinggi kotak dalam persen (0 - 100) */
  height: number;
  /** Urutan layer (semakin besar semakin di depan) */
  zIndex: number;
}

export interface FrameTemplate {
  id: string;
  name: string;
  frameUrl: string | null;
  backgroundColor: string;
  frameZIndex: number;
  canvasWidth: number;
  canvasHeight: number;
  slots: PhotoSlot[];
  isBuiltIn?: boolean;
  createdAt?: string;
}

export interface GalleryPhoto {
  id: string;
  imageUrl: string;
  senderName: string | null;
  frameName: string | null;
  createdAt: string;
}
