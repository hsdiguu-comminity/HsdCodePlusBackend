import { prisma } from "@/lib/prisma";
import type { User } from "@/generated/prisma/client";

// Kullanıcıyı istemciye gönderirken şifre hash'i gibi gizli alanları çıkarır
export function toPublicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    communityId: user.communityId,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
  };
}

export type PublicUser = ReturnType<typeof toPublicUser>;

export function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export function findUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}