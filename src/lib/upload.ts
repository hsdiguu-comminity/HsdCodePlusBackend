
import path from "node:path";
import { randomUUID } from "node:crypto";

const ALLOWED_MIME_TYPES = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
} as const;

const MAX_FILE_SIZE = 2 * 1024 * 1024;

export function validateUpload(file: {
  name: string;
  type: string;
  size: number;
}) {
  if (!file || file.size <= 0) {
    throw new Error("Boş dosya yüklenemez.");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Görsel en fazla 2 MB olabilir.");
  }

  if (
    !Object.prototype.hasOwnProperty.call(
      ALLOWED_MIME_TYPES,
      file.type,
    )
  ) {
    throw new Error("Yalnızca JPG, PNG ve WebP görselleri yüklenebilir.");
  }

  const extension = path.extname(file.name).toLowerCase();
  const expectedExtension =
    ALLOWED_MIME_TYPES[file.type as keyof typeof ALLOWED_MIME_TYPES];

  if (extension !== expectedExtension &&
      !(file.type === "image/jpeg" && extension === ".jpeg")) {
    throw new Error("Dosya uzantısı ile görsel türü eşleşmiyor.");
  }

  return {
    filename: `${randomUUID()}${expectedExtension}`,
    mimeType: file.type,
    size: file.size,
  };
}
