
import { z } from "zod";

export const createPostSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Başlık en az 3 karakter olmalıdır.")
    .max(120, "Başlık en fazla 120 karakter olabilir."),

  categoryId: z
    .string()
    .trim()
    .min(1, "Kategori seçilmelidir."),

  contentMd: z
    .string()
    .trim()
    .min(1, "Gönderi içeriği boş olamaz.")
    .max(20000, "Gönderi içeriği çok uzun."),

  coverUrl: z
    .string()
    .trim()
    .url("Geçerli bir kapak görseli adresi girilmelidir.")
    .optional()
    .or(z.literal("")),
});

export const updatePostSchema = createPostSchema.partial();

export type CreatePostInput = z.infer<typeof createPostSchema>;

export type UpdatePostInput = z.infer<typeof updatePostSchema>;
