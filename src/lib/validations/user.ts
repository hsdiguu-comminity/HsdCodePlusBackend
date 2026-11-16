import { z } from "zod";

const optionalUrl = (host: RegExp, message: string) =>
  z
    .string()
    .trim()
    .max(300)
    .refine((value) => value === "" || host.test(value), message)
    .transform((value) => (value === "" ? null : value))
    .nullish();

// PATCH /api/users/me — tüm alanlar isteğe bağlı; boş metin alanı temizler
export const updateMeSchema = z.object({
  firstName: z.string().trim().min(2, "Ad en az 2 karakter olmalı").max(50).optional(),
  lastName: z.string().trim().min(2, "Soyad en az 2 karakter olmalı").max(50).optional(),
  bio: z
    .string()
    .trim()
    .max(500, "Biyografi en fazla 500 karakter olabilir")
    .transform((value) => (value === "" ? null : value))
    .nullish(),
  avatarUrl: optionalUrl(
    /^(https:\/\/|\/uploads\/[\w-]+\.(jpg|png|webp)$)/,
    "Geçerli bir profil fotoğrafı adresi girin"
  ),
  githubUrl: optionalUrl(/^https:\/\/(www\.)?github\.com\/[\w.-]+\/?$/, "Geçerli bir GitHub profil adresi girin"),
  linkedinUrl: optionalUrl(
    /^https:\/\/(www\.)?linkedin\.com\/in\/[\w%.-]+\/?$/,
    "Geçerli bir LinkedIn profil adresi girin"
  ),
});

export const leaderboardQuerySchema = z.object({
  period: z.enum(["daily", "weekly", "monthly"], { error: "Dönem daily, weekly veya monthly olmalı" }).default("weekly"),
  community: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type UpdateMeInput = z.infer<typeof updateMeSchema>;
