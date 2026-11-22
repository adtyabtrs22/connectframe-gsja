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

function drawImageCoverAnimated(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  borderRadius: number,
  zoom: number,
  alpha: number,
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
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.roundRect(dx, dy, dw, dh, borderRadius);
  ctx.clip();
  ctx.filter = filter && filter !== "none" ? filter : "none";

  // Zoom halus dari tengah kotak
  const cx = dx + dw / 2;
  const cy = dy + dh / 2;
  ctx.translate(cx, cy);
  ctx.scale(zoom, zoom);
  ctx.translate(-cx, -cy);

  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
  ctx.restore();
}

/**
 * Menghasilkan video animasi HD 30 FPS yang tajam & mulus di semua HP
 * menggunakan 4 foto HD (tanpa decode 4 video paralel yang bikin lag).
 */
export async function generatePhotostripVideo(
  frame: FrameTemplate,
  photoDataUrls: (string | null)[],
  onProgress?: (pct: number) => void,
  filter?: string
): Promise<{ blob: Blob; ext: "mp4" | "webm" }> {
  const height = 1280;
  const rawWidth = Math.round(height * ((frame.canvasWidth || 680) / (frame.canvasHeight || 1920)));
  const width = rawWidth % 2 === 0 ? rawWidth : rawWidth + 1;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context tidak tersedia");

  const [loadedPhotos, frameImg] = await Promise.all([
    Promise.all(
      photoDataUrls.map((url) => (url ? loadImage(url).catch(() => null) : Promise.resolve(null)))
    ),
    frame.frameUrl ? loadImage(frame.frameUrl).catch(() => null) : Promise.resolve(null),
  ]);

  const mimeType = MediaRecorder.isTypeSupported("video/mp4")
    ? "video/mp4"
    : MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";

  const ext: "mp4" | "webm" = mimeType.includes("mp4") ? "mp4" : "webm";

  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 4_000_000,
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  // Durasi 5.4 detik: 4 pose muncul bertahap + zoom lembut + tahan hasil penuh di akhir
  const totalDurationMs = 5400;
  const startTime = performance.now();

  return new Promise((resolve, reject) => {
    recorder.onstop = () => {
      resolve({ blob: new Blob(chunks, { type: mimeType }), ext });
    };
    recorder.onerror = (e) => reject(e);

    recorder.start();

    const drawFrame = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / totalDurationMs);
      onProgress?.(Math.round(progress * 100));

      ctx.fillStyle = frame.backgroundColor || "#ffffff";
      ctx.fillRect(0, 0, width, height);

      type LayerItem =
        | { type: "frame"; zIndex: number }
        | { type: "slot"; zIndex: number; slotIndex: number };

      const layers: LayerItem[] = frame.slots.map((slot, idx) => ({
        type: "slot",
        zIndex: slot.zIndex,
        slotIndex: idx,
      }));
      if (frameImg) layers.push({ type: "frame", zIndex: frame.frameZIndex });
      layers.sort((a, b) => a.zIndex - b.zIndex);

      for (const layer of layers) {
        if (layer.type === "frame" && frameImg) {
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
          // Untuk 8 slot (2x4), kolom kanan (4..7) muncul beriringan dengan barisnya (0..3)
          const rowIndex = layer.slotIndex % 4;
          const revealStart = rowIndex * 700;
          const localT = Math.min(1, Math.max(0, (elapsed - revealStart) / 550));
          // Easing smooth cubic-out
          const eased = 1 - Math.pow(1 - localT, 3);
          const zoom = 1.06 - 0.06 * eased + Math.sin(progress * Math.PI) * 0.02;

          if (photoImg && elapsed >= revealStart) {
            drawImageCoverAnimated(
              ctx,
              photoImg,
              dx,
              dy,
              dw,
              dh,
              frameImg ? 0 : 18,
              zoom,
              eased,
              filter
            );
          } else {
            ctx.fillStyle = "#E2E8F0";
            ctx.fillRect(dx, dy, dw, dh);
          }
        }
      }

      if (!frameImg) {
        const isDark = frame.backgroundColor.toLowerCase() === "#0f172a";
        ctx.fillStyle = isDark ? "#F8FAFC" : "#1E293B";
        ctx.font = "bold 30px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("CONNECTFRAME • GSJA EL SHADDAI", width / 2, height - 85);
      }

      if (elapsed < totalDurationMs) {
        requestAnimationFrame(drawFrame);
      } else {
        recorder.stop();
      }
    };

    requestAnimationFrame(drawFrame);
  });
}
