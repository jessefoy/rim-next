import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  // Not logged in → redirect to login
  if (!req.auth) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.href);
    return NextResponse.redirect(loginUrl);
  }

  // Logged in but hasn't completed the community welcome step →
  // redirect to /account/welcome (exempt the welcome page itself to avoid redirect loop)
  const isWelcomePage = req.nextUrl.pathname === "/account/welcome";
  if (req.auth.user?.agreedToTerms === false && !isWelcomePage) {
    return NextResponse.redirect(new URL("/account/welcome", req.nextUrl.origin));
  }

  // Archived members cannot access the member area →
  // redirect to /account/reactivate (self-service restore page)
  const isReactivatePage = req.nextUrl.pathname === "/account/reactivate";
  if (req.auth.user?.archivedAt && !isReactivatePage) {
    return NextResponse.redirect(new URL("/account/reactivate", req.nextUrl.origin));
  }
});

export const config = {
  matcher: ["/account/:path*", "/account/hub/:path*", "/volunteer/:path*", "/admin/:path*", "/course/:path*", "/hosts/:path*", "/hosts"],
};
