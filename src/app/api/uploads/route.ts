
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { requireUser } from "@/lib/guards";
import { validateUpload } from "@/lib/upload";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    await requireUser();

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Yüklenecek bir görsel seçmelisiniz." },
        { status: 400 },
      );
    }

    const validation = validateUpload({
      name: file.name,
      type: file.type,
      size: file.size,
    });

    const bytes = Buffer.from(await file.arrayBuffer());

    if (bytes.length === 0 || bytes.length > 2 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Dosya boş veya 2 MB sınırını aşıyor." },
        { status: 400 },
      );
    }

    const uploadDirectory = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDirectory, { recursive: true });

    const filename = `${randomUUID()}${path.extname(validation.filename) === "" ? ".img" : path.extname(validation.filename)}`;

    await writeFile(path.join(uploadDirectory, filename), bytes, {
      flag: "wx",
    });

    return NextResponse.json(
      { url: `/uploads/${filename}` },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Görsel yüklenemedi.";

    if (message.toLowerCase().includes("unauthorized")) {
      return NextResponse.json(
        { error: "Giriş yapmalısınız." },
        { status: 401 },
      );
    }

    if (
      message.includes("MB") ||
      message.includes("uzantısı") ||
      message.includes("yüklenebilir") ||
      message.includes("Boş dosya")
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Görsel yüklenemedi." },
      { status: 500 },
    );
  }
}
