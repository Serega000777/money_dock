/**
 * Web-only: downscales a picked photo to a small square JPEG data: URI before it ever
 * reaches the network. There's no object storage yet (see the `users.avatarUrl` schema
 * comment), so the server stores this string directly — keeping it small is what makes
 * that acceptable instead of bloating every `users` row.
 */
export async function fileToAvatarDataUrl(file: File, size = 256): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas недоступен");

  // Cover-crop to a square: scale so the shorter side fills `size`, then centre-crop.
  const scale = size / Math.min(bitmap.width, bitmap.height);
  const drawWidth = bitmap.width * scale;
  const drawHeight = bitmap.height * scale;
  ctx.drawImage(
    bitmap,
    (size - drawWidth) / 2,
    (size - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );

  return canvas.toDataURL("image/jpeg", 0.85);
}
