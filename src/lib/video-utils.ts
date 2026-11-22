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

function loadVideoClip(blob: Blob): Promise<{ video: HTMLVideoElement; url: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.loop = true;
    video.preload = "auto";

    const onReady = () => {
      cleanup();
      resolve({ video, url });
    };
    const onErr = (e: Event) => {
      cleanup();
      URL.revokeObjectURL(url);
      reject(e);
    };
    const cleanup = () => {
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("error", onErr);
    };

    video.addEventListener("loadeddata", onReady);
    video.addEventListener("error", onErr);
    video.load();
  });
}

function drawMediaCover(
  ctx: CanvasRenderingContext2D,
  media: HTMLImageElement | HTMLVideoElement,
  mediaW: number,
  mediaH: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  borderRadius = 12,
  mirror = false,
  filter?: string
) {
  if (!mediaW || !mediaH) return;
  const imgRatio = mediaW / mediaH;
  const boxRatio = dw / dh;
  let sx = 0;
  let sy = 0;
  let sw = mediaW;
  let sh = mediaH;

  if (imgRatio > boxRatio) {
    sw = mediaH * boxRatio;
    sx = (mediaW - sw) / 2;
  } else {
    sh = mediaW / boxRatio;
    sy = (mediaH - sh) / 2;
  }

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(dx, dy, dw, dh, borderRadius);
  ctx.clip();
  ctx.filter = filter && filter !== "none" ? filter : "none";
  if (mirror) {
    ctx.translate(dx + dw, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(media, sx, sy, sw, sh, 0, 0, dw, dh);
  } else {
    ctx.drawImage(media, sx, sy, sw, sh, dx, dy, dw, dh);
  }
  ctx.restore();
}

/**
 * Menghasilkan video 30 FPS mulus (MP4 / WebM) dari rekaman video asli
 * selama countdown 3 detik sebelum dijepret untuk masing-masing slot foto.
 */
export async function generatePhotostripVideo(
  frame: FrameTemplate,
  photoDataUrls: (string | null)[],
  photoVideoBlobs: (Blob | null)[],
  slotMirrored: boolean[],
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

  const [loadedPhotos, loadedVideos, frameImg] = await Promise.all([
    Promise.all(
      photoDataUrls.map((url) => (url ? loadImage(url).catch(() => null) : Promise.resolve(null)))
    ),
    Promise.all(
      photoVideoBlobs.map((blob) =>
        blob ? loadVideoClip(blob).catch(() => null) : Promise.resolve(null)
      )
    ),
    frame.frameUrl ? loadImage(frame.frameUrl).catch(() => null) : Promise.resolve(null),
  ]);

  // Mulai putar semua klip video secara bersamaan
  await Promise.all(
    loadedVideos.map(async (item) => {
      if (!item) return;
      item.video.currentTime = 0;
      await item.video.play().catch(() => {});
    })
  );

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

  // Rekam 6 detik (2x putaran klip 3 detik) pada 30 FPS mulus
  const totalDurationMs = 6000;
  const startTime = performance.now();

  const cleanupVideos = () => {
    for (const item of loadedVideos) {
      if (item) {
        item.video.pause();
        URL.revokeObjectURL(item.url);
      }
    }
  };

  return new Promise((resolve, reject) => {
    recorder.onstop = () => {
      cleanupVideos();
      resolve({ blob: new Blob(chunks, { type: mimeType }), ext });
    };
    recorder.onerror = (e) => {
      cleanupVideos();
      reject(e);
    };

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

          const videoItem = loadedVideos[layer.slotIndex];
          const photoImg = loadedPhotos[layer.slotIndex];

          if (videoItem && videoItem.video.readyState >= 2) {
            drawMediaCover(
              ctx,
              videoItem.video,
              videoItem.video.videoWidth,
              videoItem.video.videoHeight,
              dx,
              dy,
              dw,
              dh,
              frameImg ? 0 : 18,
              Boolean(slotMirrored[layer.slotIndex]),
              filter
            );
          } else if (photoImg) {
            drawMediaCover(
              ctx,
              photoImg,
              photoImg.width,
              photoImg.height,
              dx,
              dy,
              dw,
              dh,
              frameImg ? 0 : 18,
              false,
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
