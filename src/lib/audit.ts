import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

// Admin işlem türleri — audit_logs.action alanına yazılır
export const AuditActions = {
  USER_APPROVE: "USER_APPROVE",
  USER_REJECT: "USER_REJECT",
  USER_RESTRICT: "USER_RESTRICT",
  USER_BAN: "USER_BAN",
  USER_UNBAN: "USER_UNBAN",
  POST_APPROVE: "POST_APPROVE",
  POST_REJECT: "POST_REJECT",
  QUIZ_CREATE: "QUIZ_CREATE",
  QUIZ_UPDATE: "QUIZ_UPDATE",
  QUIZ_PUBLISH: "QUIZ_PUBLISH",
  QUIZ_UNPUBLISH: "QUIZ_UNPUBLISH",
  QUIZ_DELETE: "QUIZ_DELETE",
  QUESTION_CREATE: "QUESTION_CREATE",
  QUESTION_UPDATE: "QUESTION_UPDATE",
  QUESTION_DELETE: "QUESTION_DELETE",
  CATEGORY_CREATE: "CATEGORY_CREATE",
  CATEGORY_UPDATE: "CATEGORY_UPDATE",
  CATEGORY_DELETE: "CATEGORY_DELETE",
} as const;

export type AuditAction = (typeof AuditActions)[keyof typeof AuditActions];

// Her admin işleminden sonra çağrılır. Transaction içindeyse ikinci parametre tx olmalı.
export function logAdminAction(
  data: { adminId: string; action: AuditAction; targetType: string; targetId: string },
  db: Prisma.TransactionClient = prisma
) {
  return db.auditLog.create({ data });
}
