import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "vaidyaai_session";
const PUBLIC_PATHS = ["/login"];

export function middleware(req: NextRequest) {
  // Let client-side AuthProvider and DashboardLayout handle route authentication cleanly.
  // This prevents SSR redirect loops when cookies are not set during initial dev load.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|manifest.json|robots.txt).*)"]
};
