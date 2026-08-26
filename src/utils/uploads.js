// src/utils/uploads.js
//
// Goods photo/video uploads. Replaces @vercel/blob + the /api/goods/upload
// serverless route — files now go straight into the public Supabase Storage
// bucket `goods` under shipments/<shipmentKey>/goods/<file>.
//
// Returns the same object shape the old `upload()` did, so the callers and
// the shipment payload didn't have to change:
//   { url, pathname, size, contentType, name }

import { supabase } from "../libs/supabaseClient";

export const GOODS_BUCKET = "goods";
export const MAX_PHOTOS = 6;
export const MAX_MB = 8;

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

function safeName(name = "file") {
  return String(name).replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
}

/**
 * Upload one file and return its public URL.
 * @param {string} shipmentKey  opaque per-booking key (also the storage folder)
 * @param {File}   file
 */
export async function uploadGoodsFile(shipmentKey, file) {
  if (!shipmentKey) throw new Error("Missing shipment key.");
  if (!file) throw new Error("No file selected.");

  const path = `shipments/${shipmentKey}/goods/${Date.now()}-${safeName(file.name)}`;

  const { error } = await supabase.storage
    .from(GOODS_BUCKET)
    .upload(path, file, {
      cacheControl: "31536000",
      upsert: false,
      contentType: file.type || "application/octet-stream",
    });

  if (error) throw new Error(error.message || "Upload failed");

  const { data } = supabase.storage.from(GOODS_BUCKET).getPublicUrl(path);

  return {
    url: data.publicUrl,
    pathname: path,
    size: file.size,
    contentType: file.type || "",
    name: file.name,
  };
}

/**
 * Upload several files in sequence, validating type + size first.
 * @returns {Promise<Array>} uploaded descriptors
 */
export async function uploadGoodsFiles(shipmentKey, files, { accept = IMAGE_TYPES, maxMb = MAX_MB } = {}) {
  const list = Array.from(files || []);
  if (!list.length) return [];

  for (const f of list) {
    if (accept.length && !accept.includes(f.type)) {
      throw new Error("Unsupported file type. Allowed: " + accept.join(", "));
    }
    if (f.size > maxMb * 1024 * 1024) {
      throw new Error(`Max ${maxMb}MB per file.`);
    }
  }

  const out = [];
  for (const f of list) {
    out.push(await uploadGoodsFile(shipmentKey, f));
  }
  return out;
}

/** Best-effort cleanup if a booking is abandoned. */
export async function removeGoodsFile(pathname) {
  if (!pathname) return;
  await supabase.storage.from(GOODS_BUCKET).remove([pathname]).catch(() => {});
}
