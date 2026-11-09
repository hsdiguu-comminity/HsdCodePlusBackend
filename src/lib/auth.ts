import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import type { Session } from "next-auth";

const nextAuth = NextAuth({
  session: {
    strategy: "jwt",
  },

  providers: [
    Credentials({
      name: "Credentials",

      credentials: {
        email: {
          label: "E-posta",
          type: "email",
        },
        password: {
          label: "Şifre",
          type: "password",
        },
      },

      async authorize(credentials) {
        const email =
          typeof credentials?.email === "string"
            ? credentials.email.trim().toLowerCase()
            : "";

        const password =
          typeof credentials?.password === "string"
            ? credentials.password
            : "";

        if (!email || !password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || user.status !== "ACTIVE") {
          return null;
        }

        const passwordValid = await bcrypt.compare(
          password,
          user.passwordHash
        );

        if (!passwordValid) {
          return null;
        }

        return {
          id: String(user.id),
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = String(user.id);
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }

      return session;
    },
  },

  pages: {
    signIn: "/login",
  },
});

export const { handlers, signIn, signOut } = nextAuth;

export const auth: () => Promise<Session | null> = nextAuth.auth;