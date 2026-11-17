import { NextResponse } from "next/server";
import { Errors, handleApiError } from "@/lib/errors";
import { requireUser } from "@/lib/guards";
import { MAX_UPLOAD_BYTES, saveUpload, validateUpload } from "@/lib/upload";

export const runtime = "nodejs";

// POST /api/uploads — multipart/form-data, alan adı "file" — JPG/PNG/WebP, en fazla 2 MB
export async function POST(req: Request) {
  try {
    await requireUser();

    // Büyük dosyayı belleğe almadan önce boyutu kontrol et
    const declaredSize = Number(req.headers.get("content-length") ?? 0);
    if (declaredSize > MAX_UPLOAD_BYTES + 64 * 1024) {
      throw Errors.badRequest("Görsel en fazla 2 MB olabilir");
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      throw Errors.badRequest("İstek multipart/form-data biçiminde olmalı");
    }

    const file = formData.get("file");
    if (!(file instanceof File)) throw Errors.badRequest("Yüklenecek bir görsel seçin");

    const bytes = Buffer.from(await file.arrayBuffer());
    const { filename, contentType } = validateUpload(file, bytes);
    const url = await saveUpload(filename, bytes, contentType);

    return NextResponse.json({ url }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
