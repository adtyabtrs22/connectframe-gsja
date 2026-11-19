"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Database, Images, Lock, Plus, Trash2 } from "lucide-react";
import {
  deleteCustomFrame,
  deleteGalleryPhoto,
  fetchAllFrames,
  fetchGalleryPhotos,
  isSupabaseConfigured,
  saveCustomFrame,
} from "@/lib/supabase";
import { FrameTemplate, GalleryPhoto } from "@/types/photobooth";
import { AdminFrameEditor } from "@/components/AdminFrameEditor";
import { FramePreviewCard } from "@/components/FramePreviewCard";

const ADMIN_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN || "1234";

export default function AdminPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);

  const [tab, setTab] = useState<"frames" | "gallery">("frames");
  const [frames, setFrames] = useState<FrameTemplate[]>([]);
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [editingFrame, setEditingFrame] = useState<FrameTemplate | null | undefined>(undefined);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [frameList, photoList] = await Promise.all([fetchAllFrames(), fetchGalleryPhotos()]);
    setFrames(frameList);
    setPhotos(photoList);
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    let active = true;
    Promise.all([fetchAllFrames(), fetchGalleryPhotos()]).then(([frameList, photoList]) => {
      if (!active) return;
      setFrames(frameList);
      setPhotos(photoList);
    });
    return () => {
      active = false;
    };
  }, [unlocked]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === ADMIN_PIN) {
      setUnlocked(true);
      setPinError(false);
    } else {
      setPinError(true);
    }
  };

  if (!unlocked) {
    return (
      <main className="bg-soft-grid flex min-h-screen items-center justify-center px-4">
        <form
          onSubmit={handleUnlock}
          className="w-full max-w-sm rounded-3xl border-4 border-slate-900 bg-white p-6 text-center shadow-[6px_6px_0px_#0f172a]"
        >
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-200 text-slate-900">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-black text-slate-900">Panel Admin Gereja</h1>
          <p className="mt-1 text-xs text-slate-500">
            Masukkan PIN Admin untuk mengelola frame &amp; galeri. (Default: 1234)
          </p>

          <input
            type="password"
            inputMode="numeric"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            placeholder="Masukkan PIN"
            className="mt-4 w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-center text-lg font-extrabold tracking-widest focus:border-sky-500 focus:outline-none"
          />
          {pinError && <p className="mt-2 text-xs font-bold text-rose-600">PIN salah.</p>}

          <button
            type="submit"
            className="mt-4 min-h-[48px] w-full rounded-xl bg-slate-900 px-5 py-3 text-sm font-extrabold text-white hover:bg-slate-800"
          >
            Masuk Admin
          </button>

          <Link href="/" className="mt-4 inline-block text-xs font-bold text-slate-500 underline">
            Kembali ke Beranda
          </Link>
        </form>
      </main>
    );
  }

  return (
    <main className="bg-soft-grid min-h-screen px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border-2 border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Beranda
            </Link>
            <h1 className="text-xl font-black text-slate-900 sm:text-2xl">Panel Admin</h1>
          </div>

          <div
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold ${
              isSupabaseConfigured
                ? "bg-emerald-100 text-emerald-900"
                : "bg-amber-100 text-amber-900"
            }`}
          >
            <Database className="h-3.5 w-3.5" />
            {isSupabaseConfigured
              ? "Supabase Terhubung"
              : "Mode Lokal (Isi .env.local untuk Supabase)"}
          </div>
        </header>

        {/* Tab Navigasi */}
        <div className="mb-6 flex gap-2">
          <button
            type="button"
            onClick={() => setTab("frames")}
            className={`rounded-2xl px-5 py-2.5 text-sm font-extrabold transition ${
              tab === "frames"
                ? "bg-slate-900 text-white"
                : "border-2 border-slate-200 bg-white text-slate-700"
            }`}
          >
            Custom Frame (4 Foto)
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingFrame(undefined);
              setTab("gallery");
            }}
            className={`inline-flex items-center gap-1.5 rounded-2xl px-5 py-2.5 text-sm font-extrabold transition ${
              tab === "gallery"
                ? "bg-slate-900 text-white"
                : "border-2 border-slate-200 bg-white text-slate-700"
            }`}
          >
            <Images className="h-4 w-4" />
            Kelola Galeri ({photos.length})
          </button>
        </div>

        {/* TAB 1: CUSTOM FRAME */}
        {tab === "frames" && (
          <>
            {editingFrame !== undefined ? (
              <AdminFrameEditor
                initialFrame={editingFrame}
                onSave={async (data, pngFile) => {
                  await saveCustomFrame(data, pngFile);
                  setEditingFrame(undefined);
                  await loadData();
                }}
                onDelete={async (id) => {
                  await deleteCustomFrame(id);
                  setEditingFrame(undefined);
                  await loadData();
                }}
                onCancel={() => setEditingFrame(undefined)}
              />
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                <button
                  type="button"
                  onClick={() => setEditingFrame(null)}
                  className="flex min-h-[260px] flex-col items-center justify-center gap-2 rounded-3xl border-4 border-dashed border-sky-400 bg-sky-50/60 p-4 text-center text-sky-800 transition hover:bg-sky-100"
                >
                  <Plus className="h-10 w-10" />
                  <span className="text-sm font-extrabold">Tambah Frame Baru</span>
                  <span className="text-xs text-sky-700">Upload PNG &amp; Atur 4 Kotak</span>
                </button>

                {frames.map((frame) => (
                  <div key={frame.id} className="relative flex flex-col">
                    <FramePreviewCard
                      frame={frame}
                      onSelect={() => {
                        if (!frame.isBuiltIn) setEditingFrame(frame);
                      }}
                    />
                    {frame.isBuiltIn ? (
                      <span className="mt-1 text-center text-[11px] font-semibold text-slate-400">
                        Bawaan Sistem
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingFrame(frame)}
                        className="mt-1.5 rounded-xl bg-slate-900 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
                      >
                        Edit Frame
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* TAB 2: KELOLA GALERI */}
        {tab === "gallery" && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="flex flex-col overflow-hidden rounded-2xl border-2 border-slate-200 bg-white p-2"
              >
                <img
                  src={photo.imageUrl}
                  alt={photo.senderName || "Foto"}
                  className="aspect-[9/16] w-full rounded-xl object-cover"
                />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-bold text-slate-800">
                    {photo.senderName || "Jemaat"}
                  </span>
                  {confirmDeleteId === photo.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={async () => {
                          await deleteGalleryPhoto(photo.id);
                          setConfirmDeleteId(null);
                          await loadData();
                        }}
                        className="rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-rose-700"
                      >
                        Yakin Hapus
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50"
                      >
                        Batal
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(photo.id)}
                      className="inline-flex items-center gap-1 rounded-lg bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700 hover:bg-rose-200"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Hapus
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
