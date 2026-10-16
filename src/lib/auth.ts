import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { loginSchema } from "@/lib/validations/auth";
import { verifyPassword } from "@/lib/password";
import { findUserByEmail } from "@/services/user.service";
import { liftExpiredPenalty } from "@/services/admin.service";

export const { handlers, auth, signIn, signOut } = NextAuth({
  basePath: "/api/auth",
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 gün
  },
  providers: [
    Credentials({
      credentials: {
        email: { type: "email" },
        password: { type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const found = await findUserByEmail(parsed.data.email);
        if (!found) return null;
        if (!(await verifyPassword(found.passwordHash, parsed.data.password))) return null;

        const user = await liftExpiredPenalty(found);

        // Onay bekleyen ve banlı kullanıcılar oturum açamaz
        if (user.status === "PENDING" || user.status === "BANNED") return null;

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as "MEMBER" | "ADMIN";
      return session;
    },
  },
});