import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { BUILT_IN_FRAMES } from "@/lib/default-frames";
import { FrameTemplate, GalleryPhoto } from "@/types/photobooth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

const LOCAL_FRAMES_KEY = "gsja_photobooth_custom_frames";
const LOCAL_GALLERY_KEY = "gsja_photobooth_local_gallery";

function readLocalFrames(): FrameTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_FRAMES_KEY);
    return raw ? (JSON.parse(raw) as FrameTemplate[]) : [];
  } catch {
    return [];
  }
}

function writeLocalFrames(frames: FrameTemplate[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_FRAMES_KEY, JSON.stringify(frames));
}

export async function fetchAllFrames(): Promise<FrameTemplate[]> {
  if (!supabase) {
    return [...BUILT_IN_FRAMES, ...readLocalFrames()];
  }

  const { data, error } = await supabase
    .from("frames")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("Gagal mengambil frames dari Supabase:", error);
    return [...BUILT_IN_FRAMES, ...readLocalFrames()];
  }

  const remoteFrames: FrameTemplate[] = data.map((row) => ({
    id: row.id,
    name: row.name,
    frameUrl: row.frame_url,
    backgroundColor: row.background_color || "#ffffff",
    frameZIndex: row.frame_z_index ?? 5,
    canvasWidth: row.canvas_width ?? 1080,
    canvasHeight: row.canvas_height ?? 1920,
    slots: row.slots,
    createdAt: row.created_at,
  }));

  return [...remoteFrames, ...BUILT_IN_FRAMES];
}

export async function saveCustomFrame(
  frame: Omit<FrameTemplate, "id"> & { id?: string },
  pngFile?: File | null
): Promise<FrameTemplate> {
  let finalFrameUrl = frame.frameUrl;

  // Mode offline/demo jika Supabase belum diisi di .env.local
  if (!supabase) {
    if (pngFile) {
      finalFrameUrl = await fileToDataUrl(pngFile);
    }
    const existing = readLocalFrames();
    const id = frame.id && !frame.id.startsWith("builtin-") ? frame.id : `local-${Date.now()}`;
    const saved: FrameTemplate = {
      ...frame,
      id,
      frameUrl: finalFrameUrl,
      createdAt: new Date().toISOString(),
    };
    const updated = [saved, ...existing.filter((f) => f.id !== id)];
    writeLocalFrames(updated);
    return saved;
  }

  // Upload PNG ke Supabase Storage bucket 'frames' jika ada file baru
  if (pngFile) {
    const ext = pngFile.name.split(".").pop() || "png";
    const fileName = `frame-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("frames")
      .upload(fileName, pngFile, { contentType: pngFile.type || "image/png", upsert: false });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from("frames").getPublicUrl(fileName);
    finalFrameUrl = urlData.publicUrl;
  }

  const payload = {
    name: frame.name,
    frame_url: finalFrameUrl,
    background_color: frame.backgroundColor,
    frame_z_index: frame.frameZIndex,
    canvas_width: frame.canvasWidth,
    canvas_height: frame.canvasHeight,
    slots: frame.slots,
    is_active: true,
  };

  if (frame.id && !frame.id.startsWith("local-") && !frame.id.startsWith("builtin-")) {
    const { data, error } = await supabase
      .from("frames")
      .update(payload)
      .eq("id", frame.id)
      .select()
      .single();

    if (error) throw error;
    return mapRowToFrame(data);
  }

  const { data, error } = await supabase.from("frames").insert(payload).select().single();
  if (error) throw error;
  return mapRowToFrame(data);
}

export async function deleteCustomFrame(id: string): Promise<void> {
  if (!supabase || id.startsWith("local-")) {
    const existing = readLocalFrames();
    writeLocalFrames(existing.filter((f) => f.id !== id));
    return;
  }

  const { error } = await supabase.from("frames").delete().eq("id", id);
  if (error) throw error;
}

export async function uploadGalleryPhoto(
  compressedBlob: Blob,
  senderName: string,
  frameName: string
): Promise<GalleryPhoto> {
  if (!supabase) {
    const dataUrl = await blobToDataUrl(compressedBlob);
    const photo: GalleryPhoto = {
      id: `local-photo-${Date.now()}`,
      imageUrl: dataUrl,
      senderName: senderName.trim() || null,
      frameName,
      createdAt: new Date().toISOString(),
    };
    const existing = await fetchGalleryPhotos();
    localStorage.setItem(LOCAL_GALLERY_KEY, JSON.stringify([photo, ...existing].slice(0, 30)));
    return photo;
  }

  const ext = compressedBlob.type.includes("webp") ? "webp" : "jpg";
  const fileName = `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("gallery")
    .upload(fileName, compressedBlob, { contentType: compressedBlob.type });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from("gallery").getPublicUrl(fileName);

  const { data, error: insertError } = await supabase
    .from("photos")
    .insert({
      image_url: urlData.publicUrl,
      sender_name: senderName.trim() || null,
      frame_name: frameName,
    })
    .select()
    .single();

  if (insertError) throw insertError;

  return {
    id: data.id,
    imageUrl: data.image_url,
    senderName: data.sender_name,
    frameName: data.frame_name,
    createdAt: data.created_at,
  };
}

export async function fetchGalleryPhotos(): Promise<GalleryPhoto[]> {
  if (!supabase) {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(LOCAL_GALLERY_KEY);
      return raw ? (JSON.parse(raw) as GalleryPhoto[]) : [];
    } catch {
      return [];
    }
  }

  const { data, error } = await supabase
    .from("photos")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(60);

  if (error || !data) {
    console.error("Gagal memuat galeri:", error);
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    imageUrl: row.image_url,
    senderName: row.sender_name,
    frameName: row.frame_name,
    createdAt: row.created_at,
  }));
}

export async function deleteGalleryPhoto(id: string): Promise<void> {
  if (!supabase || id.startsWith("local-photo-")) {
    const existing = await fetchGalleryPhotos();
    localStorage.setItem(
      LOCAL_GALLERY_KEY,
      JSON.stringify(existing.filter((p) => p.id !== id))
    );
    return;
  }

  const { error } = await supabase.from("photos").delete().eq("id", id);
  if (error) throw error;
}

function mapRowToFrame(row: Record<string, unknown>): FrameTemplate {
  return {
    id: String(row.id),
    name: String(row.name),
    frameUrl: row.frame_url ? String(row.frame_url) : null,
    backgroundColor: String(row.background_color || "#ffffff"),
    frameZIndex: Number(row.frame_z_index ?? 5),
    canvasWidth: Number(row.canvas_width ?? 1080),
    canvasHeight: Number(row.canvas_height ?? 1920),
    slots: row.slots as FrameTemplate["slots"],
    createdAt: row.created_at ? String(row.created_at) : undefined,
  };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
