import { z } from "zod";

const email = z
  .string({ error: "E-posta zorunludur" })
  .trim()
  .toLowerCase()
  .pipe(z.email("Geçerli bir e-posta girin"));

// Şifre kuralı: en az 8 karakter, en az bir harf ve bir rakam
export const passwordSchema = z
  .string({ error: "Şifre zorunludur" })
  .min(8, "Şifre en az 8 karakter olmalı")
  .max(128, "Şifre en fazla 128 karakter olabilir")
  .regex(/[A-Za-z]/, "Şifre en az bir harf içermeli")
  .regex(/[0-9]/, "Şifre en az bir rakam içermeli");

export const registerSchema = z.object({
  firstName: z.string({ error: "Ad zorunludur" }).trim().min(2, "Ad en az 2 karakter olmalı").max(50),
  lastName: z
    .string({ error: "Soyad zorunludur" })
    .trim()
    .min(2, "Soyad en az 2 karakter olmalı")
    .max(50),
  username: z
    .string({ error: "Kullanıcı adı zorunludur" })
    .trim()
    .toLowerCase()
    .min(3, "Kullanıcı adı en az 3 karakter olmalı")
    .max(30, "Kullanıcı adı en fazla 30 karakter olabilir")
    .regex(/^[a-z0-9_]+$/, "Kullanıcı adı yalnızca harf, rakam ve _ içerebilir"),
  email,
  password: passwordSchema,
  communityId: z.string({ error: "HSD topluluğunuzu seçin" }).min(1, "HSD topluluğunuzu seçin"),
});

export const loginSchema = z.object({
  email,
  password: z.string({ error: "Şifre zorunludur" }).min(1, "Şifre zorunludur").max(128),
});

export const forgotPasswordSchema = z.object({
  email,
});

export const resetPasswordSchema = z.object({
  token: z.string({ error: "Geçersiz bağlantı" }).min(1, "Geçersiz bağlantı"),
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;