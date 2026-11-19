"use client";

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Columns2, GripVertical, RotateCcw, Save, Trash2, Upload, X } from "lucide-react";
import { FrameTemplate, PhotoSlot } from "@/types/photobooth";
import { DEFAULT_4_SLOTS, DEFAULT_8_SLOTS } from "@/lib/default-frames";
import { detectSlotsFromFramePng, duplicateFrameToDouble916 } from "@/lib/slot-detector";

interface AdminFrameEditorProps {
  initialFrame?: FrameTemplate | null;
  onSave: (frameData: Omit<FrameTemplate, "id"> & { id?: string }, pngFile: File | null) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onCancel: () => void;
}

type LayerKey = "frame" | number;

export function AdminFrameEditor({
  initialFrame,
  onSave,
  onDelete,
  onCancel,
}: AdminFrameEditorProps) {
  const [name, setName] = useState(initialFrame?.name || "Custom Frame Baru");
  const [backgroundColor, setBackgroundColor] = useState(
    initialFrame?.backgroundColor || "#FFFFFF"
  );
  const [frameUrl, setFrameUrl] = useState<string | null>(initialFrame?.frameUrl || null);
  const [pngFile, setPngFile] = useState<File | null>(null);
  const [frameZIndex, setFrameZIndex] = useState<number>(initialFrame?.frameZIndex ?? 5);
  const [canvasWidth, setCanvasWidth] = useState<number>(initialFrame?.canvasWidth ?? 680);
  const [canvasHeight, setCanvasHeight] = useState<number>(initialFrame?.canvasHeight ?? 1920);
  const [slots, setSlots] = useState<PhotoSlot[]>(
    initialFrame?.slots && initialFrame.slots.length >= 4
      ? initialFrame.slots.map((s) => ({ ...s }))
      : DEFAULT_4_SLOTS.map((s) => ({ ...s }))
  );

  const [activeLayer, setActiveLayer] = useState<LayerKey>(1);
  const [draggedLayer, setDraggedLayer] = useState<LayerKey | null>(null);
  const [canUndoDuplicate, setCanUndoDuplicate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const singleSnapshotRef = useRef<{
    frameUrl: string | null;
    pngFile: File | null;
    slots: PhotoSlot[];
    canvasWidth: number;
    canvasHeight: number;
    frameZIndex: number;
  } | null>(null);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    mode: "move" | "resize";
    slotId: number;
    startX: number;
    startY: number;
    origSlot: PhotoSlot;
  } | null>(null);

  const handlePngChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    singleSnapshotRef.current = null;
    setCanUndoDuplicate(false);
    setPngFile(file);
    const objectUrl = URL.createObjectURL(file);
    setFrameUrl(objectUrl);

    try {
      const result = await detectSlotsFromFramePng(file);
      if (result.processedFile) {
        setPngFile(result.processedFile);
        setFrameUrl(URL.createObjectURL(result.processedFile));
      }
      setSlots(result.slots);
      setFrameZIndex(result.recommendedFrameZIndex);
      setCanvasWidth(result.canvasWidth);
      setCanvasHeight(result.canvasHeight);
      if (result.mode === "transparent") {
        setStatusMsg(
          `Otomatis mendeteksi ${result.slots.length} lubang transparan pada PNG! Tinggal cek preview lalu Simpan Frame.`
        );
      } else if (result.mode === "chroma-green") {
        setStatusMsg(
          `Otomatis melubangi ${result.slots.length} kotak hijau menjadi transparan & menempatkan frame di atas foto!`
        );
      } else {
        setStatusMsg(
          "PNG dimuat & 4 kotak foto otomatis disesuaikan ke proporsi gambar. Tinggal rapikan jika perlu."
        );
      }
    } catch {
      setStatusMsg("PNG siap. Atur posisi 4 kotak foto lalu Simpan Frame.");
    }
  };

  // Pointer drag / resize untuk Kotak Foto 1..4
  const startInteraction = (
    e: React.PointerEvent,
    slot: PhotoSlot,
    mode: "move" | "resize"
  ) => {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setActiveLayer(slot.id as LayerKey);
    dragStateRef.current = {
      mode,
      slotId: slot.id,
      startX: e.clientX,
      startY: e.clientY,
      origSlot: { ...slot },
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = dragStateRef.current;
    const container = canvasRef.current;
    if (!drag || !container) return;

    const rect = container.getBoundingClientRect();
    const dxPct = ((e.clientX - drag.startX) / rect.width) * 100;
    const dyPct = ((e.clientY - drag.startY) / rect.height) * 100;

    setSlots((prev) =>
      prev.map((s) => {
        if (s.id !== drag.slotId) return s;
        if (drag.mode === "move") {
          const nextX = Math.max(0, Math.min(100 - s.width, drag.origSlot.x + dxPct));
          const nextY = Math.max(0, Math.min(100 - s.height, drag.origSlot.y + dyPct));
          return { ...s, x: Number(nextX.toFixed(1)), y: Number(nextY.toFixed(1)) };
        } else {
          const nextW = Math.max(15, Math.min(100 - s.x, drag.origSlot.width + dxPct));
          const nextH = Math.max(8, Math.min(100 - s.y, drag.origSlot.height + dyPct));
          return { ...s, width: Number(nextW.toFixed(1)), height: Number(nextH.toFixed(1)) };
        }
      })
    );
  };

  const endInteraction = () => {
    dragStateRef.current = null;
  };

  // Layer Order: Drag & Drop + Forward/Backward
  const allLayers = [
    { key: "frame" as LayerKey, label: "Frame PNG", zIndex: frameZIndex },
    ...slots.map((s) => ({
      key: s.id as LayerKey,
      label: `Kotak Foto ${s.id}`,
      zIndex: s.zIndex,
    })),
  ].sort((a, b) => a.zIndex - b.zIndex);

  const reorderLayers = (fromKey: LayerKey, toKey: LayerKey) => {
    if (fromKey === toKey) return;
    const order = allLayers.map((l) => l.key);
    const fromIdx = order.indexOf(fromKey);
    const toIdx = order.indexOf(toKey);
    if (fromIdx === -1 || toIdx === -1) return;

    const nextOrder = [...order];
    const [moved] = nextOrder.splice(fromIdx, 1);
    nextOrder.splice(toIdx, 0, moved);

    // Assign ulang zIndex 1..5 sesuai urutan baru (bawah ke atas)
    nextOrder.forEach((key, idx) => {
      const newZ = idx + 1;
      if (key === "frame") {
        setFrameZIndex(newZ);
      } else {
        setSlots((prev) =>
          prev.map((s) => (s.id === key ? { ...s, zIndex: newZ } : s))
        );
      }
    });
  };

  const shiftActiveLayer = (delta: 1 | -1) => {
    const maxZ = slots.length + 2;
    if (activeLayer === "frame") {
      setFrameZIndex((z) => Math.max(1, Math.min(maxZ, z + delta)));
    } else {
      setSlots((prev) =>
        prev.map((s) =>
          s.id === activeLayer
            ? { ...s, zIndex: Math.max(1, Math.min(maxZ, s.zIndex + delta)) }
            : s
        )
      );
    }
  };

  const handleReset = () => {
    if (slots.length >= 8) {
      setSlots(DEFAULT_8_SLOTS.map((s) => ({ ...s })));
      setFrameZIndex(10);
    } else {
      setSlots(DEFAULT_4_SLOTS.map((s) => ({ ...s })));
      setFrameZIndex(5);
    }
    setStatusMsg("Layout kotak foto di-reset ke standar.");
  };

  const handleDuplicate2x = async () => {
    if (!frameUrl || slots.length >= 8) return;
    try {
      singleSnapshotRef.current = {
        frameUrl,
        pngFile,
        slots: slots.map((s) => ({ ...s })),
        canvasWidth,
        canvasHeight,
        frameZIndex,
      };
      const doubled = await duplicateFrameToDouble916(frameUrl, slots, backgroundColor);
      setPngFile(doubled.file);
      setFrameUrl(URL.createObjectURL(doubled.file));
      setSlots(doubled.slots);
      setCanvasWidth(doubled.canvasWidth);
      setCanvasHeight(doubled.canvasHeight);
      setFrameZIndex(10);
      setCanUndoDuplicate(true);
      setStatusMsg(
        "Frame digandakan menjadi 2 kolom (8 kotak, full 9:16)! Klik Simpan Frame atau Batalkan Gandakan."
      );
    } catch (err) {
      singleSnapshotRef.current = null;
      console.error(err);
      setStatusMsg("Gagal menggandakan frame. Coba upload ulang PNG-nya.");
    }
  };

  const handleUndoDuplicate2x = () => {
    const snap = singleSnapshotRef.current;
    if (!snap) return;
    setFrameUrl(snap.frameUrl);
    setPngFile(snap.pngFile);
    setSlots(snap.slots);
    setCanvasWidth(snap.canvasWidth);
    setCanvasHeight(snap.canvasHeight);
    setFrameZIndex(snap.frameZIndex);
    singleSnapshotRef.current = null;
    setCanUndoDuplicate(false);
    setStatusMsg("Kembali ke frame tunggal 4 kotak.");
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setStatusMsg("Nama frame tidak boleh kosong.");
      return;
    }
    setSaving(true);
    setStatusMsg(null);
    try {
      await onSave(
        {
          id: initialFrame?.id,
          name: name.trim(),
          frameUrl,
          backgroundColor,
          frameZIndex,
          canvasWidth,
          canvasHeight,
          slots,
        },
        pngFile
      );
    } catch (err) {
      console.error(err);
      setStatusMsg("Gagal menyimpan frame. Cek koneksi atau konfigurasi Supabase.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-3xl border-2 border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">
            {initialFrame ? `Edit Frame: ${initialFrame.name}` : "Buat Custom Frame Baru"}
          </h2>
          <p className="text-xs text-slate-500">
            Geser dan tarik sudut kotak foto 1–4 agar pas dengan lubang frame PNG kamu.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
        >
          <X className="h-4 w-4" />
          Tutup Editor
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* KIRI: CANVAS PREVIEW INTERAKTIF */}
        <div className="flex flex-col items-center">
          <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-slate-500">
            Canvas Preview ({canvasWidth} × {canvasHeight})
          </p>
          <div
            ref={canvasRef}
            onPointerMove={handlePointerMove}
            onPointerUp={endInteraction}
            onPointerCancel={endInteraction}
            style={{
              backgroundColor,
              aspectRatio: `${canvasWidth} / ${canvasHeight}`,
            }}
            className="relative w-full max-w-[260px] touch-none select-none overflow-hidden rounded-2xl border-4 border-slate-900 shadow-lg"
          >
            {/* 4 Kotak Foto Draggable */}
            {slots.map((slot) => {
              const isSelected = activeLayer === slot.id;
              return (
                <div
                  key={slot.id}
                  onPointerDown={(e) => startInteraction(e, slot, "move")}
                  style={{
                    left: `${slot.x}%`,
                    top: `${slot.y}%`,
                    width: `${slot.width}%`,
                    height: `${slot.height}%`,
                    zIndex: slot.zIndex,
                  }}
                  className={`absolute flex cursor-move items-center justify-center rounded-md border-2 transition-colors ${
                    isSelected
                      ? "border-pink-600 bg-pink-200/80 text-pink-950"
                      : "border-dashed border-sky-600 bg-sky-100/75 text-sky-900"
                  }`}
                >
                  <span className="pointer-events-none text-sm font-black">{slot.id}</span>

                  {/* Handle Resize di Pojok Kanan Bawah */}
                  <div
                    onPointerDown={(e) => startInteraction(e, slot, "resize")}
                    title="Tarik untuk ubah ukuran"
                    className="absolute -bottom-1.5 -right-1.5 h-5 w-5 cursor-nwse-resize rounded-full border-2 border-slate-900 bg-white shadow"
                  />
                </div>
              );
            })}

            {/* Overlay Frame PNG */}
            {frameUrl && (
              <img
                src={frameUrl}
                alt="Frame PNG Preview"
                style={{ zIndex: frameZIndex }}
                className="pointer-events-none absolute inset-0 h-full w-full object-contain"
              />
            )}
          </div>
        </div>

        {/* KANAN: KONTROL 1. FRAME, 2. LAYER ORDER, 3. SIMPAN */}
        <div className="flex flex-col gap-5">
          {/* 1. Frame & Nama */}
          <div className="rounded-2xl border-2 border-slate-200 p-4">
            <h3 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-slate-800">
              1. Frame &amp; Nama
            </h3>
            <div className="flex flex-col gap-3">
              <div>
                <label
                  htmlFor="frame-name-input"
                  className="mb-1 block text-xs font-bold text-slate-600"
                >
                  Nama Frame
                </label>
                <input
                  id="frame-name-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border-2 border-slate-200 px-3.5 py-2.5 text-base font-semibold focus:border-sky-500 focus:outline-none sm:text-sm"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-sky-600">
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  Upload Frame PNG
                  <input
                    type="file"
                    accept="image/png,image/webp"
                    onChange={handlePngChange}
                    className="hidden"
                  />
                </label>

                <div className="flex items-center gap-2">
                  <label htmlFor="frame-bg-color" className="text-xs font-bold text-slate-600">
                    Warna Dasar:
                  </label>
                  <input
                    id="frame-bg-color"
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="h-10 w-12 cursor-pointer rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              {frameUrl && slots.length === 4 && (
                <button
                  type="button"
                  onClick={handleDuplicate2x}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border-2 border-violet-300 bg-violet-50 px-4 py-2 text-xs font-extrabold text-violet-900 transition hover:bg-violet-100"
                >
                  <Columns2 className="h-4 w-4" aria-hidden="true" />
                  Gandakan 2x (Jadi 8 Kotak Full 9:16)
                </button>
              )}

              {canUndoDuplicate && (
                <button
                  type="button"
                  onClick={handleUndoDuplicate2x}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-4 py-2 text-xs font-extrabold text-slate-700 transition hover:bg-slate-50"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Batalkan Gandakan (Kembali ke 4 Kotak)
                </button>
              )}
            </div>
          </div>

          {/* 2. Layer Order */}
          <div className="rounded-2xl border-2 border-slate-200 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-800">
                2. Layer Order (Urutan Tumpukan)
              </h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => shiftActiveLayer(1)}
                  className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                  Maju (Forward)
                </button>
                <button
                  type="button"
                  onClick={() => shiftActiveLayer(-1)}
                  className="inline-flex items-center gap-1 rounded-lg bg-violet-100 px-3 py-1.5 text-xs font-bold text-violet-900 hover:bg-violet-200"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                  Mundur (Backward)
                </button>
              </div>
            </div>

            <p className="mb-2 text-[11px] text-slate-500">
              Seret (drag) baris layer untuk mengatur urutan tumpukan (semakin bawah = semakin di depan).
            </p>
            <div className="flex flex-col gap-1.5">
              {allLayers.map((layer) => (
                <button
                  key={String(layer.key)}
                  type="button"
                  draggable
                  onDragStart={() => {
                    setDraggedLayer(layer.key);
                    setActiveLayer(layer.key);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (draggedLayer !== null) {
                      reorderLayers(draggedLayer, layer.key);
                      setDraggedLayer(null);
                    }
                  }}
                  onDragEnd={() => setDraggedLayer(null)}
                  onClick={() => setActiveLayer(layer.key)}
                  className={`flex w-full cursor-grab items-center justify-between rounded-xl border px-3 py-2 text-xs font-bold transition active:cursor-grabbing ${
                    draggedLayer === layer.key
                      ? "opacity-50"
                      : activeLayer === layer.key
                        ? "border-sky-500 bg-sky-50 text-sky-900"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    {layer.label}
                  </span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] tabular-nums">
                    Z:{layer.zIndex}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 3. Simpan */}
          <div className="rounded-2xl border-2 border-slate-200 p-4">
            <h3 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-slate-800">
              3. Simpan
            </h3>
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                disabled={saving}
                onClick={handleSubmit}
                className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-pink-600 px-5 py-2.5 text-sm font-extrabold text-white shadow hover:bg-pink-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? "Menyimpan..." : "Simpan Frame"}
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="inline-flex min-h-[48px] items-center gap-1.5 rounded-xl border-2 border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>

              {initialFrame && !initialFrame.isBuiltIn && onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(initialFrame.id)}
                  className="inline-flex min-h-[48px] items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700"
                >
                  <Trash2 className="h-4 w-4" />
                  Hapus
                </button>
              )}
            </div>

            {statusMsg && (
              <p className="mt-2.5 text-xs font-semibold text-sky-700">{statusMsg}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
