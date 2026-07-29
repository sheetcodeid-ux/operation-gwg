import { presignElearningUploadAction } from "@/lib/actions/elearning";

/**
 * Upload a file straight from the browser to Cloudflare R2 via a presigned PUT
 * URL (bypasses Vercel's body limit — essential for large training videos).
 * Returns the stored path (with the `r2:` prefix) to save on the lesson.
 */
export async function uploadToR2(
  file: File,
  folder: "video" | "thumbnail" | "file",
  onProgress?: (pct: number) => void,
): Promise<string> {
  const res = await presignElearningUploadAction({ name: file.name, type: file.type, size: file.size, folder });
  if ("error" in res) throw new Error(res.error);

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", res.url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload gagal (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Koneksi upload terputus."));
    xhr.send(file);
  });

  return res.path;
}
