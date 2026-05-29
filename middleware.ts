import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// Login pages (one per portal) + access-denied are reachable without a session.
const PUBLIC_PATHS = [
  "/login",
  "/manager/login",
  "/employee/login",
  "/access-denied",
];

const PORTAL_HOME = {
  admin: "/dashboard",
  manager: "/manager/live",
  employee: "/employee/attendance",
} as const;

function loginPathForArea(pathname: string): string {
  if (pathname.startsWith("/manager")) return "/manager/login";
  if (pathname.startsWith("/employee")) return "/employee/login";
  return "/login";
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function middleware(req: NextRequest) {
  try {
    const res = NextResponse.next();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error("[Middleware] Missing Supabase environment variables");
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.set({ name, value: "", ...options });
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { pathname } = req.nextUrl;
    const isPublic = isPublicPath(pathname);

    // ---- not signed in ----
    if (!user) {
      if (isPublic) return res;
      const url = req.nextUrl.clone();
      url.pathname = loginPathForArea(pathname);
      return NextResponse.redirect(url);
    }

    // ---- signed in: resolve whitelist + role ----
    let role: "admin" | "manager" | "employee" | null = null;
    if (user.email) {
      const { data: allowed, error } = await supabase
        .from("allowed_users")
        .select("role")
        .ilike("email", user.email)
        .maybeSingle();

      if (error) {
        console.error("[Middleware] allowed_users query error:", error.message);
      }
      if (!allowed) {
        await supabase.auth.signOut();
        if (pathname !== "/access-denied") {
          const url = req.nextUrl.clone();
          url.pathname = "/access-denied";
          return NextResponse.redirect(url);
        }
        return res;
      }
      role = (allowed.role as typeof role) ?? null;
    }

    const home = role ? PORTAL_HOME[role] : "/login";

    // ---- on a login page or root while signed in -> go to portal home ----
    if (isPublic || pathname === "/") {
      // /access-denied stays reachable (e.g. just-removed users); only bounce login/root.
      if (pathname === "/access-denied") return res;
      const url = req.nextUrl.clone();
      url.pathname = home;
      return NextResponse.redirect(url);
    }

    // ---- portal isolation ----
    const inManager = pathname === "/manager" || pathname.startsWith("/manager/");
    const inEmployee = pathname === "/employee" || pathname.startsWith("/employee/");

    if (role === "employee" && !inEmployee) {
      const url = req.nextUrl.clone();
      url.pathname = PORTAL_HOME.employee;
      return NextResponse.redirect(url);
    }
    if (role === "manager" && !inManager) {
      const url = req.nextUrl.clone();
      url.pathname = PORTAL_HOME.manager;
      return NextResponse.redirect(url);
    }
    if (role === "admin" && (inManager || inEmployee)) {
      const url = req.nextUrl.clone();
      url.pathname = PORTAL_HOME.admin;
      return NextResponse.redirect(url);
    }

    return res;
  } catch (err) {
    console.error("[Middleware] Error:", err instanceof Error ? err.message : String(err));
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
