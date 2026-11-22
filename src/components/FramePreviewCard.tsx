"use client";

import { FrameTemplate } from "@/types/photobooth";

interface FramePreviewCardProps {
  frame: FrameTemplate;
  selected?: boolean;
  onSelect?: () => void;
}

export function FramePreviewCard({ frame, selected, onSelect }: FramePreviewCardProps) {
  const isDark = frame.backgroundColor.toLowerCase() === "#0f172a";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative flex flex-col items-center rounded-3xl border-2 p-3 text-left transition-all ${
        selected
          ? "border-sky-500 bg-sky-50/80 ring-4 ring-sky-200 shadow-lg scale-[1.02]"
          : "border-slate-200 bg-white hover:border-amber-300 hover:shadow-md"
      }`}
    >
      {/* Mini Photostrip Preview sesuai rasio asli frame (isolate agar zIndex slot tidak tembus keluar kartu) */}
      <div
        className="isolate relative h-[230px] max-w-full overflow-hidden rounded-xl border border-slate-200 shadow-inner"
        style={{
          backgroundColor: frame.backgroundColor,
          aspectRatio: `${frame.canvasWidth || 680} / ${frame.canvasHeight || 1920}`,
        }}
      >
        {frame.slots.map((slot) => (
          <div
            key={slot.id}
            style={{
              left: `${slot.x}%`,
              top: `${slot.y}%`,
              width: `${slot.width}%`,
              height: `${slot.height}%`,
              zIndex: slot.zIndex,
            }}
            className="absolute flex items-center justify-center rounded-md border border-dashed border-slate-400/70 bg-slate-200/75 text-[10px] font-bold text-slate-600"
          >
            {slot.id <= 4 ? `Foto ${slot.id}` : `Acak`}
          </div>
        ))}

        {frame.frameUrl && (
          <img
            src={frame.frameUrl}
            alt={frame.name}
            style={{ zIndex: frame.frameZIndex }}
            className="pointer-events-none absolute inset-0 h-full w-full object-contain"
          />
        )}

        {!frame.frameUrl && (
          <div
            className={`absolute inset-x-0 bottom-2 text-center text-[9px] font-bold tracking-wide ${
              isDark ? "text-slate-200" : "text-slate-600"
            }`}
          >
            CONNECTFRAME • GSJA EL SHADDAI
          </div>
        )}
      </div>

      <div className="mt-3 w-full text-center">
        <p className="truncate text-sm font-bold text-slate-800">{frame.name}</p>
        <p className="text-xs text-slate-500">
          {frame.slots.length >= 8 ? "8 Kotak (4 Pose Acak)" : "4 Foto Vertikal"}
        </p>
      </div>

      {selected && (
        <span className="mt-2 inline-flex items-center rounded-full bg-sky-600 px-3 py-0.5 text-xs font-semibold text-white">
          Terpilih ✓
        </span>
      )}
    </button>
  );
}
