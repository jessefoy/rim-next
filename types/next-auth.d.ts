import { Role } from "@prisma/client";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      roles: Role[];
      agreedToTerms: boolean;
    } & DefaultSession["user"];
  }
}
