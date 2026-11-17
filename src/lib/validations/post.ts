import { z } from "zod";

// Kapak görseli: tam https adresi veya /api/uploads ile yüklenmiş bir dosya yolu
const coverUrl = z
  .string()
  .trim()
  .max(500)
  .refine(
    (value) => value === "" || /^https?:\/\//.test(value) || /^\/uploads\/[\w-]+\.(jpg|png|webp)$/.test(value),
    "Geçerli bir kapak görseli adresi girin"
  )
  .transform((value) => (value === "" ? null : value));

export const createPostSchema = z.object({
  title: z
    .string({ error: "Başlık zorunludur" })
    .trim()
    .min(3, "Başlık en az 3 karakter olmalı")
    .max(120, "Başlık en fazla 120 karakter olabilir"),
  categoryId: z.string({ error: "Kategori seçin" }).trim().min(1, "Kategori seçin"),
  contentMd: z
    .string({ error: "İçerik zorunludur" })
    .trim()
    .min(1, "Yazı içeriği boş olamaz")
    .max(20000, "Yazı içeriği en fazla 20.000 karakter olabilir"),
  coverUrl: coverUrl.nullish(),
});

export const updatePostSchema = createPostSchema.partial();

export const postListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  category: z.string().trim().min(1).optional(),
  q: z.string().trim().min(1).max(100).optional(),
});

export const adminPostListQuerySchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).default("PENDING"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const rejectPostSchema = z.object({
  reason: z
    .string({ error: "Ret gerekçesi zorunludur" })
    .trim()
    .min(3, "Ret gerekçesi en az 3 karakter olmalı")
    .max(1000, "Ret gerekçesi en fazla 1000 karakter olabilir"),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type PostListQuery = z.infer<typeof postListQuerySchema>;
