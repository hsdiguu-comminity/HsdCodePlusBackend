import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ApiError } from "@/lib/errors";

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MB

const ALLOWED_TYPES = {
  "image/jpeg": { extensions: [".jpg", ".jpeg"], saveAs: ".jpg" },
  "image/png": { extensions: [".png"], saveAs: ".png" },
  "image/webp": { extensions: [".webp"], saveAs: ".webp" },
} as const;

type AllowedType = keyof typeof ALLOWED_TYPES;

const invalid = (message: string) => new ApiError(400, "INVALID_UPLOAD", message);

// Dosyanın gerçekten görsel olduğunu ilk baytlarına bakarak doğrular
// (uzantısı .png yapılmış bir .exe/.html dosyası böylece reddedilir)
function matchesSignature(bytes: Buffer, type: AllowedType) {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") {
    return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  return bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
}

export function validateUpload(file: { name: string; type: string; size: number }, bytes: Buffer) {
  if (file.size <= 0 || bytes.length === 0) throw invalid("Boş dosya yüklenemez");
  if (file.size > MAX_UPLOAD_BYTES || bytes.length > MAX_UPLOAD_BYTES) {
    throw invalid("Görsel en fazla 2 MB olabilir");
  }
  if (!Object.hasOwn(ALLOWED_TYPES, file.type)) {
    throw invalid("Yalnızca JPG, PNG ve WebP görselleri yüklenebilir");
  }

  const type = file.type as AllowedType;
  const extension = path.extname(file.name).toLowerCase();
  if (!(ALLOWED_TYPES[type].extensions as readonly string[]).includes(extension)) {
    throw invalid("Dosya uzantısı ile görsel türü eşleşmiyor");
  }
  if (!matchesSignature(bytes, type)) {
    throw invalid("Dosya içeriği geçerli bir görsel değil");
  }

  // Dosya adı her zaman rastgele üretilir; kullanıcının verdiği ad kullanılmaz
  return { filename: `${randomUUID()}${ALLOWED_TYPES[type].saveAs}`, contentType: type };
}

// Görseli kaydeder ve herkese açık adresini döner.
// - SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY tanımlıysa (canlı ortam): Supabase Storage
// - Değilse (yerel geliştirme): public/uploads klasörü
// Vercel gibi sunucularda disk kalıcı olmadığı için canlıda mutlaka Supabase kullanılır.
export async function saveUpload(filename: string, bytes: Buffer, contentType: string): Promise<string> {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && serviceKey) {
    return saveToSupabase(supabaseUrl, serviceKey, filename, bytes, contentType);
  }

  const directory = path.join(process.cwd(), "public", "uploads");
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, filename), bytes, { flag: "wx" });
  return `/uploads/${filename}`;
}

async function saveToSupabase(
  supabaseUrl: string,
  serviceKey: string,
  filename: string,
  bytes: Buffer,
  contentType: string
): Promise<string> {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "uploads";
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${filename}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Content-Type": contentType,
      "x-upsert": "false",
      "cache-control": "max-age=31536000",
    },
    body: new Uint8Array(bytes),
  });
  if (!response.ok) {
    console.error("Supabase Storage yükleme hatası:", response.status, await response.text().catch(() => ""));
    throw new ApiError(502, "UPLOAD_FAILED", "Görsel şu an yüklenemedi, lütfen tekrar deneyin");
  }
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${filename}`;
}
