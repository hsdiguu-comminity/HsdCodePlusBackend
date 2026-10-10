import type { DefaultSession } from "next-auth";

// Oturum nesnesine kullanıcı id'si ve rolü eklenir
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "MEMBER" | "ADMIN";
    } & DefaultSession["user"];
  }

  interface User {
    role?: "MEMBER" | "ADMIN";
  }
}