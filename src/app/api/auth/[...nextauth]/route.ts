// Auth.js'in kendi endpoint'leri: /api/auth/session, /api/auth/csrf vb.
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;