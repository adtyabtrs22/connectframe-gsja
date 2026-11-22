import { FrameTemplate } from "@/types/photobooth";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

/**
 * Menggambar gambar ke dalam kotak (dx, dy, dw, dh) dengan mode object-cover
 * agar foto tidak gepeng / terdistorsi.
 */
function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  borderRadius = 16,
  filter?: string
) {
  const imgRatio = img.width / img.height;
  const boxRatio = dw / dh;

  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;

  if (imgRatio > boxRatio) {
    sw = img.height * boxRatio;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / boxRatio;
    sy = (img.height - sh) / 2;
  }

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(dx, dy, dw, dh, borderRadius);
  ctx.clip();
  ctx.filter = filter && filter !== "none" ? filter : "none";
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
  ctx.restore();
}

/**
 * Merender hasil akhir photostrip 4 foto + frame PNG sesuai urutan zIndex.
 */
export async function renderPhotostripCanvas(
  frame: FrameTemplate,
  photoDataUrls: (string | null)[],
  options?: { footerText?: string; filter?: string }
): Promise<HTMLCanvasElement> {
  const width = frame.canvasWidth || 1080;
  const height = frame.canvasHeight || 1920;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context tidak tersedia");

  // 1. Background dasar
  ctx.fillStyle = frame.backgroundColor || "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // 2. Kumpulkan semua layer (4 foto + optional Frame PNG) lalu urutkan berdasarkan zIndex
  type LayerItem =
    | { type: "frame"; zIndex: number }
    | { type: "slot"; zIndex: number; slotIndex: number };

  const layers: LayerItem[] = frame.slots.map((slot, idx) => ({
    type: "slot",
    zIndex: slot.zIndex,
    slotIndex: idx,
  }));

  if (frame.frameUrl) {
    layers.push({ type: "frame", zIndex: frame.frameZIndex });
  }

  layers.sort((a, b) => a.zIndex - b.zIndex);

  // Preload gambar
  const loadedPhotos = await Promise.all(
    photoDataUrls.map((url) => (url ? loadImage(url).catch(() => null) : Promise.resolve(null)))
  );
  const frameImg = frame.frameUrl ? await loadImage(frame.frameUrl).catch(() => null) : null;

  for (const layer of layers) {
    if (layer.type === "frame" && frameImg) {
      // Gambar frame secara proporsional (contain) agar PNG strip ramping (mis. 397x1123) tidak gepeng
      const scale = Math.min(width / frameImg.width, height / frameImg.height);
      const fw = frameImg.width * scale;
      const fh = frameImg.height * scale;
      const fx = (width - fw) / 2;
      const fy = (height - fh) / 2;
      ctx.drawImage(frameImg, fx, fy, fw, fh);
    } else if (layer.type === "slot") {
      const slot = frame.slots[layer.slotIndex];
      const dx = (slot.x / 100) * width;
      const dy = (slot.y / 100) * height;
      const dw = (slot.width / 100) * width;
      const dh = (slot.height / 100) * height;

      const photoImg = loadedPhotos[layer.slotIndex];
      if (photoImg) {
        drawImageCover(ctx, photoImg, dx, dy, dw, dh, frame.frameUrl ? 0 : 20, options?.filter);
      } else {
        ctx.fillStyle = "#E2E8F0";
        ctx.fillRect(dx, dy, dw, dh);
      }
    }
  }

  // 3. Jika frame bawaan (tanpa PNG overlay), tambahkan footer gereja yang rapi
  if (!frame.frameUrl) {
    const isDark = frame.backgroundColor.toLowerCase() === "#0f172a";
    ctx.fillStyle = isDark ? "#F8FAFC" : "#1E293B";
    ctx.font = "bold 40px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(options?.footerText || "CONNECTFRAME • GSJA EL SHADDAI", width / 2, height - 125);

    ctx.fillStyle = isDark ? "#94A3B8" : "#64748B";
    ctx.font = "500 26px sans-serif";
    const today = new Date().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    ctx.fillText(today, width / 2, height - 75);
  }

  return canvas;
}

/**
 * Mengompres canvas ke WebP/JPEG ukuran kecil (~80-150 KB) untuk Galeri Bersama.
 */
export async function compressCanvasForGallery(
  sourceCanvas: HTMLCanvasElement,
  maxWidth = 720,
  quality = 0.75
): Promise<Blob> {
  const scale = Math.min(1, maxWidth / sourceCanvas.width);
  const targetWidth = Math.round(sourceCanvas.width * scale);
  const targetHeight = Math.round(sourceCanvas.height * scale);

  const offscreen = document.createElement("canvas");
  offscreen.width = targetWidth;
  offscreen.height = targetHeight;

  const ctx = offscreen.getContext("2d");
  if (!ctx) throw new Error("Gagal membuat canvas kompresi");

  ctx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);

  return new Promise((resolve, reject) => {
    offscreen.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          // Fallback ke JPEG jika browser tidak mendukung WebP toBlob
          offscreen.toBlob(
            (jpegBlob) => {
              if (jpegBlob) resolve(jpegBlob);
              else reject(new Error("Gagal mengompres gambar"));
            },
            "image/jpeg",
            quality
          );
        }
      },
      "image/webp",
      quality
    );
  });
}
