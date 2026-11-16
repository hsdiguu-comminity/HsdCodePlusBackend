import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, readJson } from "@/lib/errors";
import { requireUser } from "@/lib/guards";
import { updateMeSchema } from "@/lib/validations/user";
import { toPublicUser } from "@/services/user.service";

// PATCH /api/users/me — { firstName?, lastName?, bio?, avatarUrl?, githubUrl?, linkedinUrl? }
// E-posta, kullanıcı adı, rol ve durum buradan değiştirilemez.
export async function PATCH(req: Request) {
  try {
    const user = await requireUser({ allowRestricted: true });
    const { firstName, lastName, ...profileData } = updateMeSchema.parse(await readJson(req));

    const [updatedUser, profile] = await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { firstName, lastName } }),
      prisma.profile.upsert({
        where: { userId: user.id },
        create: { userId: user.id, ...profileData },
        update: profileData,
      }),
    ]);

    return NextResponse.json({ user: toPublicUser(updatedUser), profile, message: "Profiliniz güncellendi" });
  } catch (error) {
    return handleApiError(error);
  }
}
