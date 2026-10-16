import { z } from "zod";

const optionalDate = z
  .union([z.iso.datetime({ offset: true, error: "Geçerli bir tarih girin" }), z.null()])
  .optional()
  .transform((value) => (value ? new Date(value) : value));

const optionSchema = z.object({
  text: z.string({ error: "Şık metni zorunludur" }).trim().min(1, "Şık metni boş olamaz").max(500),
  isCorrect: z.boolean().default(false),
});

// Admin: quiz oluşturma
export const createQuizSchema = z
  .object({
    title: z.string({ error: "Başlık zorunludur" }).trim().min(3, "Başlık en az 3 karakter olmalı").max(150),
    description: z.string().trim().max(2000).nullish(),
    categoryId: z.string({ error: "Kategori seçin" }).min(1, "Kategori seçin"),
    timeLimitSec: z
      .number({ error: "Süre (saniye) zorunludur" })
      .int()
      .min(30, "Süre en az 30 saniye olmalı")
      .max(3 * 60 * 60, "Süre en fazla 3 saat olabilir"),
    startsAt: optionalDate,
    endsAt: optionalDate,
  })
  .refine((q) => !q.startsAt || !q.endsAt || q.startsAt < q.endsAt, {
    message: "Bitiş tarihi başlangıçtan sonra olmalı",
    path: ["endsAt"],
  });

// Admin: quiz güncelleme (tüm alanlar isteğe bağlı) + yayınlama
export const updateQuizSchema = z.object({
  title: z.string().trim().min(3, "Başlık en az 3 karakter olmalı").max(150).optional(),
  description: z.string().trim().max(2000).nullish(),
  categoryId: z.string().min(1).optional(),
  timeLimitSec: z
    .number()
    .int()
    .min(30, "Süre en az 30 saniye olmalı")
    .max(3 * 60 * 60, "Süre en fazla 3 saat olabilir")
    .optional(),
  startsAt: optionalDate,
  endsAt: optionalDate,
  isPublished: z.boolean().optional(),
});

// Admin: soru ekleme / düzenleme (şıklar her seferinde tamamen gönderilir)
export const questionSchema = z
  .object({
    text: z.string({ error: "Soru metni zorunludur" }).trim().min(3, "Soru en az 3 karakter olmalı").max(2000),
    points: z.number().int().min(1, "Puan en az 1 olmalı").max(1000).default(10),
    order: z.number().int().min(0).optional(),
    options: z
      .array(optionSchema, { error: "Şıklar zorunludur" })
      .min(2, "En az 2 şık olmalı")
      .max(6, "En fazla 6 şık olabilir"),
  })
  .refine((q) => q.options.filter((o) => o.isCorrect).length === 1, {
    message: "Tam olarak bir doğru şık işaretlenmeli",
    path: ["options"],
  });

// Üye: quiz cevaplarını gönderme
export const submitQuizSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        optionId: z.string().min(1),
      }),
      { error: "Cevaplar zorunludur" }
    )
    .max(200),
});

export const quizListQuerySchema = z.object({
  category: z.string().trim().min(1).optional(),
});

export type CreateQuizInput = z.infer<typeof createQuizSchema>;
export type UpdateQuizInput = z.infer<typeof updateQuizSchema>;
export type QuestionInput = z.infer<typeof questionSchema>;
export type SubmitQuizInput = z.infer<typeof submitQuizSchema>;
