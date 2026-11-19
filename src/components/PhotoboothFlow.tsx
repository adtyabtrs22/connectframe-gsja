"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  Download,
  Film,
  Images,
  RefreshCw,
  RotateCcw,
  Share2,
  Sparkles,
  SwitchCamera,
  Upload,
} from "lucide-react";
import { FrameTemplate } from "@/types/photobooth";
import { fetchAllFrames, uploadGalleryPhoto } from "@/lib/supabase";
import { compressCanvasForGallery, renderPhotostripCanvas } from "@/lib/canvas-utils";
import { generatePhotostripVideo } from "@/lib/video-utils";
import { FramePreviewCard } from "@/components/FramePreviewCard";
import { BUILT_IN_FRAMES } from "@/lib/default-frames";

type Step = "select-frame" | "capture" | "result";

export function PhotoboothFlow() {
  const [step, setStep] = useState<Step>("select-frame");
  const [frames, setFrames] = useState<FrameTemplate[]>(BUILT_IN_FRAMES);
  const [selectedFrame, setSelectedFrame] = useState<FrameTemplate>(BUILT_IN_FRAMES[0]);
  const [loadingFrames, setLoadingFrames] = useState(true);

  // Camera & 4-photo state
  const [photos, setPhotos] = useState<(string | null)[]>([null, null, null, null]);
  const [photoVideos, setPhotoVideos] = useState<(Blob | null)[]>([null, null, null, null]);
  const [slotMirrored, setSlotMirrored] = useState<boolean[]>([true, true, true, true]);
  const [activeSlot, setActiveSlot] = useState<number>(0);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isAutoSequence, setIsAutoSequence] = useState(false);
  const [flash, setFlash] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);

  // Result state
  const [resultDataUrl, setResultDataUrl] = useState<string | null>(null);
  const [renderingResult, setRenderingResult] = useState(false);
  const [senderName, setSenderName] = useState("");
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [uploadedToGallery, setUploadedToGallery] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [recordingVideo, setRecordingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [randomOrder, setRandomOrder] = useState<number[]>([2, 0, 3, 1]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const resultCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeRecorderRef = useRef<MediaRecorder | null>(null);

  // Deteksi in-app browser (WhatsApp / IG / LINE)
  useEffect(() => {
    const ua = navigator.userAgent || "";
    if (/Instagram|FBAN|FBAV|Line\/|WhatsApp/i.test(ua)) {
      queueMicrotask(() => setIsInAppBrowser(true));
    }
  }, []);

  // Load frames dari Supabase / fallback
  useEffect(() => {
    fetchAllFrames()
      .then((list) => {
        if (list.length > 0) {
          setFrames(list);
          setSelectedFrame(list[0]);
        }
      })
      .finally(() => setLoadingFrames(false));
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        "Browser ini tidak mendukung akses kamera. Coba buka link ini di Chrome atau Safari."
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1440 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera error:", err);
      setCameraError(
        "Kamera belum diizinkan atau sedang dipakai aplikasi lain. Izinkan akses kamera di browser kamu, lalu tekan Coba Lagi."
      );
    }
  }, [facingMode, stopCamera]);

  // Nyalakan kamera hanya saat masuk step "capture"
  useEffect(() => {
    if (step !== "capture") {
      stopCamera();
      return;
    }
    const timer = setTimeout(() => {
      void startCamera();
    }, 0);
    return () => {
      clearTimeout(timer);
      stopCamera();
    };
  }, [step, startCamera, stopCamera]);

  const snapCurrentSlot = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Mirror hasil foto jika menggunakan kamera depan agar sesuai preview
    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.95);

    // Hentikan perekaman klip video mulus untuk slot ini
    if (activeRecorderRef.current && activeRecorderRef.current.state !== "inactive") {
      activeRecorderRef.current.stop();
      activeRecorderRef.current = null;
    }

    setFlash(true);
    setTimeout(() => setFlash(false), 200);

    setSlotMirrored((prev) => {
      const next = [...prev];
      next[activeSlot] = facingMode === "user";
      return next;
    });

    setPhotos((prev) => {
      const next = [...prev];
      next[activeSlot] = dataUrl;
      const nextEmpty = next.findIndex((p, idx) => idx > activeSlot && p === null);
      if (nextEmpty !== -1) {
        setActiveSlot(nextEmpty);
        if (isAutoSequence) {
          setTimeout(() => setCountdown(3), 850);
        }
      } else {
        const anyEmpty = next.findIndex((p) => p === null);
        if (anyEmpty !== -1) {
          setActiveSlot(anyEmpty);
          if (isAutoSequence) {
            setTimeout(() => setCountdown(3), 850);
          }
        } else {
          setIsAutoSequence(false);
        }
      }
      return next;
    });
  }, [activeSlot, facingMode, isAutoSequence]);

  const startClipRecorder = useCallback((slotIdx: number) => {
    const stream = streamRef.current;
    if (!stream || typeof MediaRecorder === "undefined") return;

    try {
      if (activeRecorderRef.current && activeRecorderRef.current.state !== "inactive") {
        activeRecorderRef.current.stop();
      }
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
        ? "video/webm;codecs=vp8"
        : MediaRecorder.isTypeSupported("video/webm")
          ? "video/webm"
          : MediaRecorder.isTypeSupported("video/mp4")
            ? "video/mp4"
            : "";

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1_200_000 })
        : new MediaRecorder(stream);

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
        if (blob.size > 0) {
          setPhotoVideos((prev) => {
            const next = [...prev];
            next[slotIdx] = blob;
            return next;
          });
        }
      };

      activeRecorderRef.current = recorder;
      recorder.start();
    } catch {
      // Abaikan jika perangkat tidak mendukung MediaRecorder paralel
    }
  }, []);

  const handleStartAutoSession = () => {
    if (countdown !== null || isAutoSequence) return;
    const hasEmpty = photos.some((p) => p === null);
    let targetSlot = activeSlot;
    if (hasEmpty) {
      const firstEmpty = photos.findIndex((p) => p === null);
      if (firstEmpty !== -1) {
        targetSlot = firstEmpty;
        setActiveSlot(firstEmpty);
      }
      setIsAutoSequence(true);
    } else {
      setIsAutoSequence(false);
    }
    startClipRecorder(targetSlot);
    setCountdown(3);
  };

  // Saat auto-sequence berpindah ke slot berikutnya, mulai rekam klip untuk slot baru
  useEffect(() => {
    if (countdown === 3 && !activeRecorderRef.current) {
      startClipRecorder(activeSlot);
    }
  }, [countdown, activeSlot, startClipRecorder]);

  useEffect(() => {
    if (countdown === null) return;
    const timer = setTimeout(() => {
      if (countdown <= 1) {
        snapCurrentSlot();
        setCountdown(null);
      } else {
        setCountdown(countdown - 1);
      }
    }, 950);
    return () => clearTimeout(timer);
  }, [countdown, snapCurrentSlot]);

  // Fallback upload foto dari galeri HP jika kamera tidak bisa dibuka
  const handleManualPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      setPhotos((prev) => {
        const next = [...prev];
        next[activeSlot] = dataUrl;
        const nextEmpty = next.findIndex((p) => p === null);
        if (nextEmpty !== -1) setActiveSlot(nextEmpty);
        return next;
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Bangun array foto & klip sesuai jumlah slot frame (4 atau 8 dengan sisi kanan diacak)
  const expandForFrame = useCallback(
    <T,>(items: (T | null)[], frame: FrameTemplate, order: number[]): (T | null)[] => {
      if (frame.slots.length < 8) return items;
      return [...items, ...order.map((idx) => items[idx] ?? null)];
    },
    []
  );

  // Render hasil HD ketika masuk ke step "result" atau saat ganti frame
  const generateResult = useCallback(
    async (frameToUse: FrameTemplate, orderOverride?: number[]) => {
      setRenderingResult(true);
      setUploadedToGallery(false);
      setUploadError(null);
      try {
        const order = orderOverride ?? randomOrder;
        const expandedPhotos = expandForFrame(photos, frameToUse, order);
        const canvas = await renderPhotostripCanvas(frameToUse, expandedPhotos);
        resultCanvasRef.current = canvas;
        setResultDataUrl(canvas.toDataURL("image/png"));
      } catch (err) {
        console.error("Render error:", err);
      } finally {
        setRenderingResult(false);
      }
    },
    [photos, randomOrder, expandForFrame]
  );

  const goToResult = async () => {
    // Acak urutan pose untuk kolom kedua (pasti berbeda dari [0, 1, 2, 3])
    const candidates = [
      [1, 3, 0, 2],
      [2, 0, 3, 1],
      [3, 1, 2, 0],
      [2, 3, 1, 0],
      [3, 2, 0, 1],
      [1, 0, 3, 2],
    ];
    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    setRandomOrder(picked);
    setStep("result");
    await generateResult(selectedFrame, picked);
  };

  const handleDownloadHD = () => {
    if (!resultDataUrl) return;
    const a = document.createElement("a");
    a.href = resultDataUrl;
    a.download = `connectframe-gsja-${Date.now()}.png`;
    a.click();
  };

  const handleDownloadVideo = async () => {
    if (recordingVideo) return;
    setRecordingVideo(true);
    setVideoProgress(0);
    try {
      const expandedPhotos = expandForFrame(photos, selectedFrame, randomOrder);
      const expandedVideos = expandForFrame(photoVideos, selectedFrame, randomOrder);
      const expandedMirrored =
        selectedFrame.slots.length >= 8
          ? [...slotMirrored, ...randomOrder.map((idx) => slotMirrored[idx] ?? true)]
          : slotMirrored;
      const { blob, ext } = await generatePhotostripVideo(
        selectedFrame,
        expandedPhotos,
        expandedVideos,
        expandedMirrored,
        (pct) => setVideoProgress(pct)
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `connectframe-gsja-${Date.now()}.${ext}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      console.error("Video error:", err);
      setUploadError("Browser ini belum mendukung perekaman video otomatis.");
    } finally {
      setRecordingVideo(false);
      setVideoProgress(0);
    }
  };

  const handleUploadToGallery = async () => {
    if (!resultCanvasRef.current || uploadingGallery || uploadedToGallery) return;
    setUploadingGallery(true);
    setUploadError(null);
    try {
      const compressedBlob = await compressCanvasForGallery(resultCanvasRef.current, 720, 0.75);
      await uploadGalleryPhoto(compressedBlob, senderName, selectedFrame.name);
      setUploadedToGallery(true);
    } catch (err) {
      console.error("Upload gallery error:", err);
      setUploadError("Gagal mengirim ke galeri. Pastikan koneksi internet stabil.");
    } finally {
      setUploadingGallery(false);
    }
  };

  const takenCount = photos.filter(Boolean).length;
  const allTaken = takenCount === 4;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 py-5 sm:px-6">
      {/* Header navigasi sederhana */}
      <header className="mb-5 flex items-center justify-between gap-3">
        {step === "select-frame" ? (
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Beranda
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setStep(step === "result" ? "capture" : "select-frame")}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {step === "result" ? "Edit Pose" : "Pilih Frame"}
          </button>
        )}

        <div className="flex items-center gap-2 rounded-full bg-amber-100 px-4 py-1.5 text-xs font-extrabold text-amber-900 tabular-nums">
          {step === "select-frame" && "Langkah 1 / 3: Pilih Frame"}
          {step === "capture" && `Langkah 2 / 3: Foto (${takenCount}/4)`}
          {step === "result" && "Langkah 3 / 3: Simpan Foto"}
        </div>

        <Link
          href="/gallery"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-2xl border-2 border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <Images className="h-4 w-4 text-sky-600" />
          <span className="hidden sm:inline">Galeri</span>
        </Link>
      </header>

      {/* Peringatan In-App Browser */}
      {isInAppBrowser && step === "capture" && (
        <div className="mb-4 rounded-2xl border-2 border-amber-300 bg-amber-50 p-3.5 text-sm text-amber-950">
          <p className="font-bold">Membuka dari WhatsApp / Instagram?</p>
          <p className="mt-0.5 text-xs sm:text-sm">
            Jika kamera tidak muncul, tekan ikon titik tiga di pojok kanan atas lalu pilih{" "}
            <strong>Buka di Chrome / Safari</strong>.
          </p>
        </div>
      )}

      {/* STEP 1: PILIH FRAME */}
      {step === "select-frame" && (
        <section className="flex flex-1 flex-col">
          <div className="mb-5 text-center">
            <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
              Pilih Frame Favoritmu
            </h1>
            <p className="mt-1 text-sm text-slate-600 sm:text-base">
              Setiap frame berisi <strong>4 pose foto</strong>. Ketuk salah satu untuk memilih.
            </p>
          </div>

          {loadingFrames ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-64 animate-pulse rounded-3xl bg-slate-200/70" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {frames.map((frame) => (
                <FramePreviewCard
                  key={frame.id}
                  frame={frame}
                  selected={selectedFrame.id === frame.id}
                  onSelect={() => setSelectedFrame(frame)}
                />
              ))}
            </div>
          )}

          <div className="sticky bottom-3 z-30 mt-8 flex justify-center">
            <div className="w-full max-w-md rounded-2xl bg-[#FFFBF2]/90 p-1.5 backdrop-blur-md">
              <button
                type="button"
                onClick={() => setStep("capture")}
                className="inline-flex min-h-[56px] w-full items-center justify-center gap-3 rounded-2xl bg-sky-600 px-8 py-4 text-lg font-extrabold text-white shadow-xl shadow-sky-600/25 transition hover:bg-sky-700 active:scale-[0.98]"
              >
                Lanjut Ambil Foto
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* STEP 2: AMBIL 4 FOTO */}
      {step === "capture" && (
        <section className="flex flex-1 flex-col gap-5">
          <div className="grid gap-5 lg:grid-cols-[1fr_220px]">
            {/* Viewfinder Kamera */}
            <div className="flex flex-col gap-3">
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl border-4 border-slate-900 bg-slate-950 shadow-xl">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`h-full w-full object-cover ${
                    facingMode === "user" ? "-scale-x-100" : ""
                  }`}
                />

                {/* Overlay Countdown */}
                {countdown !== null && countdown > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                    <span className="animate-bounce text-8xl font-black text-white tabular-nums drop-shadow-lg">
                      {countdown}
                    </span>
                  </div>
                )}

                {/* Efek Flash */}
                {flash && <div className="absolute inset-0 bg-white transition-opacity" />}

                {/* Badge Slot Aktif */}
                <div className="absolute left-3 top-3 rounded-full bg-black/70 px-3.5 py-1.5 text-xs font-extrabold text-white backdrop-blur">
                  Pose {activeSlot + 1} dari 4
                </div>

                {/* Tombol Putar Kamera */}
                <button
                  type="button"
                  onClick={() =>
                    setFacingMode((m) => (m === "user" ? "environment" : "user"))
                  }
                  className="absolute right-3 top-3 inline-flex min-h-[42px] items-center gap-1.5 rounded-full bg-white/90 px-3.5 py-1.5 text-xs font-bold text-slate-900 shadow hover:bg-white"
                >
                  <SwitchCamera className="h-4 w-4" />
                  Putar Kamera
                </button>

                {/* Error Kamera */}
                {cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 p-6 text-center text-white">
                    <Camera className="mb-3 h-10 w-10 text-amber-400" />
                    <p className="text-base font-bold">Kamera Tidak Bisa Diakses</p>
                    <p className="mt-1 max-w-sm text-xs text-slate-300">{cameraError}</p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2.5">
                      <button
                        type="button"
                        onClick={startCamera}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-bold text-white hover:bg-sky-600"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Coba Lagi
                      </button>
                      <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-400">
                        <Upload className="h-4 w-4" />
                        Pilih dari Galeri
                        <input
                          type="file"
                          accept="image/*"
                          capture="user"
                          onChange={handleManualPhotoUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Tombol Kontrol Kamera */}
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={countdown !== null || isAutoSequence || Boolean(cameraError)}
                  onClick={handleStartAutoSession}
                  className="inline-flex min-h-[56px] flex-1 items-center justify-center gap-2.5 rounded-2xl bg-sky-600 px-6 py-3.5 text-base font-extrabold text-white shadow-lg shadow-sky-600/25 transition hover:bg-sky-700 disabled:opacity-50"
                >
                  <Camera className="h-5 w-5" />
                  {isAutoSequence
                    ? `Sedang Mengambil Pose ${activeSlot + 1}/4...`
                    : allTaken
                      ? `Foto Ulang Pose ${activeSlot + 1} (3..2..1)`
                      : "Mulai Foto Otomatis (4 Gaya)"}
                </button>

                {allTaken && (
                  <button
                    type="button"
                    onClick={goToResult}
                    className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3.5 text-base font-extrabold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-700"
                  >
                    <Sparkles className="h-5 w-5" />
                    Lihat Hasil
                  </button>
                )}
              </div>
            </div>

            {/* 4 Slot Preview */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-extrabold text-slate-800">4 Pose Foto</p>
                {takenCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAutoSequence(false);
                      setCountdown(null);
                      setPhotos([null, null, null, null]);
                      setPhotoVideos([null, null, null, null]);
                      setActiveSlot(0);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:underline"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Ulang Semua
                  </button>
                )}
              </div>

              <div className="grid grid-cols-4 gap-2 lg:grid-cols-1">
                {photos.map((photo, idx) => {
                  const isActive = activeSlot === idx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveSlot(idx)}
                      className={`relative aspect-[4/3] overflow-hidden rounded-2xl border-2 transition ${
                        isActive
                          ? "border-sky-500 ring-4 ring-sky-200"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      {photo ? (
                        <img
                          src={photo}
                          alt={`Pose ${idx + 1}`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center bg-slate-100 text-slate-400">
                          <span className="text-sm font-extrabold">{idx + 1}</span>
                        </div>
                      )}
                      <span className="absolute bottom-1 left-1 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {photo ? `✓ ${idx + 1}` : `Pose ${idx + 1}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* STEP 3: HASIL & SIMPAN */}
      {step === "result" && (
        <section className="flex flex-1 flex-col items-center gap-6 pb-8">
          <div className="text-center">
            <h1 className="text-2xl font-extrabold text-slate-900">Hasil Fotomu Siap!</h1>
            <p className="mt-1 text-sm text-slate-600">
              Simpan foto HD ke HP kamu, atau bagikan ke Galeri Bersama gereja.
            </p>
          </div>

          <div className="grid w-full items-start gap-6 md:grid-cols-[280px_1fr]">
            {/* Preview Hasil */}
            <div className="mx-auto w-full max-w-[260px] overflow-hidden rounded-2xl border-2 border-slate-200 bg-white p-2 shadow-xl">
              {renderingResult || !resultDataUrl ? (
                <div className="flex aspect-[9/16] items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-500">
                  Menyiapkan foto...
                </div>
              ) : (
                <img
                  src={resultDataUrl}
                  alt="Hasil Photostrip"
                  className="w-full rounded-xl object-contain"
                />
              )}
            </div>

            {/* Aksi Simpan & Galeri */}
            <div className="flex flex-col gap-4 rounded-3xl border-2 border-slate-200 bg-white p-5 shadow-sm">
              <div className="grid gap-2.5 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={!resultDataUrl}
                  onClick={handleDownloadHD}
                  className="inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 px-5 py-4 text-base font-extrabold text-white shadow-lg shadow-sky-600/25 transition hover:bg-sky-700 disabled:opacity-50"
                >
                  <Download className="h-5 w-5" aria-hidden="true" />
                  Simpan Foto (HD)
                </button>

                <button
                  type="button"
                  disabled={!resultDataUrl || recordingVideo}
                  onClick={handleDownloadVideo}
                  className="inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-300 bg-white px-5 py-4 text-base font-extrabold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                >
                  <Film className="h-5 w-5 text-violet-600" aria-hidden="true" />
                  <span className="tabular-nums">
                    {recordingVideo ? `Membuat Video ${videoProgress}%` : "Simpan Video"}
                  </span>
                </button>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <label
                  htmlFor="sender-name-input"
                  className="block text-sm font-bold text-slate-800"
                >
                  Bagikan ke Galeri Bersama Gereja
                </label>
                <p className="mb-2.5 text-xs text-slate-500">
                  Opsional: tulis namamu agar tampil di galeri (foto otomatis dikompres).
                </p>
                <input
                  id="sender-name-input"
                  type="text"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="Contoh: Kel. Budi"
                  maxLength={40}
                  disabled={uploadedToGallery}
                  className="mb-3 w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-base font-medium text-slate-800 focus:border-sky-500 focus:outline-none sm:text-sm"
                />

                {uploadedToGallery ? (
                  <div className="flex flex-col gap-2 rounded-2xl bg-emerald-50 p-3.5 text-emerald-900">
                    <div className="flex items-center gap-2 text-sm font-bold">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      Berhasil dikirim ke Galeri Gereja!
                    </div>
                    <Link
                      href="/gallery"
                      className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-700 underline"
                    >
                      Lihat Galeri Bersama sekarang →
                    </Link>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={uploadingGallery || !resultDataUrl}
                    onClick={handleUploadToGallery}
                    className="inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 px-5 py-3 text-base font-extrabold text-slate-950 transition hover:bg-amber-300 disabled:opacity-50"
                  >
                    <Share2 className="h-5 w-5" />
                    {uploadingGallery ? "Mengompres & Mengirim..." : "Kirim ke Galeri Gereja"}
                  </button>
                )}

                {uploadError && (
                  <p role="alert" className="mt-2 text-xs font-semibold text-rose-600">
                    {uploadError}
                  </p>
                )}
              </div>

              {/* Ganti Frame Cepat */}
              <div className="border-t border-slate-100 pt-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Coba Frame Lain (Tanpa Foto Ulang)
                </p>
                <div className="flex flex-wrap gap-2">
                  {frames.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        setSelectedFrame(f);
                        generateResult(f);
                      }}
                      className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${
                        selectedFrame.id === f.id
                          ? "border-sky-500 bg-sky-50 text-sky-700"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAutoSequence(false);
                    setCountdown(null);
                    setPhotos([null, null, null, null]);
                    setPhotoVideos([null, null, null, null]);
                    setResultDataUrl(null);
                    setActiveSlot(0);
                    setStep("capture");
                  }}
                  className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Foto Ulang dari Awal
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsAutoSequence(false);
                    setCountdown(null);
                    setPhotos([null, null, null, null]);
                    setPhotoVideos([null, null, null, null]);
                    setResultDataUrl(null);
                    setActiveSlot(0);
                    setStep("select-frame");
                  }}
                  className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100"
                >
                  Sesi Baru (Pilih Frame)
                </button>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
