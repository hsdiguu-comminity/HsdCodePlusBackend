import { NextResponse } from "next/server";
import { ZodError } from "zod";

// Tüm API hataları bu formatta döner: { error: { code, message } }
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
  }
}

export const Errors = {
  badRequest: (message = "Geçersiz istek") => new ApiError(400, "BAD_REQUEST", message),
  unauthorized: (message = "Bu işlem için giriş yapmalısınız") =>
    new ApiError(401, "UNAUTHORIZED", message),
  forbidden: (message = "Bu işlem için yetkiniz yok") => new ApiError(403, "FORBIDDEN", message),
  notFound: (message = "Kayıt bulunamadı") => new ApiError(404, "NOT_FOUND", message),
  conflict: (message = "Kayıt zaten mevcut") => new ApiError(409, "CONFLICT", message),
  tooManyRequests: (message = "Çok fazla deneme yaptınız, lütfen biraz bekleyin") =>
    new ApiError(429, "TOO_MANY_REQUESTS", message),
};

export function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// Route'larda try/catch içinde kullanılır: catch (error) { return handleApiError(error); }
export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return errorResponse(error.status, error.code, error.message);
  }
  if (error instanceof ZodError) {
    return errorResponse(400, "VALIDATION_ERROR", error.issues[0]?.message ?? "Geçersiz veri");
  }
  console.error(error);
  return errorResponse(500, "INTERNAL_ERROR", "Beklenmeyen bir hata oluştu");
}

// İstek gövdesini JSON olarak okur; bozuk JSON gelirse 400 döner
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw Errors.badRequest("İstek gövdesi geçerli bir JSON değil");
  }
}