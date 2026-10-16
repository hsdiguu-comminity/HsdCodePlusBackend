import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const userListQuerySchema = paginationSchema.extend({
  status: z.enum(["PENDING", "ACTIVE", "RESTRICTED", "BANNED"]).optional(),
  q: z.string().trim().min(1).max(100).optional(),
});

// Kısıtlama: süre zorunlu (gün). Ban: süre verilmezse kalıcı.
export const restrictSchema = z.object({
  reason: z.string({ error: "Gerekçe zorunludur" }).trim().min(3, "Gerekçe en az 3 karakter olmalı").max(500),
  days: z
    .number({ error: "Kısıtlama süresi (gün) zorunludur" })
    .int()
    .min(1, "Süre en az 1 gün olmalı")
    .max(365, "Süre en fazla 365 gün olabilir"),
});

export const banSchema = z.object({
  reason: z.string({ error: "Gerekçe zorunludur" }).trim().min(3, "Gerekçe en az 3 karakter olmalı").max(500),
  days: z.number().int().min(1, "Süre en az 1 gün olmalı").max(3650).nullish(),
});

export const categorySchema = z.object({
  name: z.string({ error: "Kategori adı zorunludur" }).trim().min(2, "Kategori adı en az 2 karakter olmalı").max(50),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug yalnızca küçük harf, rakam ve - içerebilir")
    .max(60)
    .optional(),
});

export const updateCategorySchema = categorySchema.partial();
