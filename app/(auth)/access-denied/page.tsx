import Link from "next/link";
import { Logo } from "@/components/layout/Logo";

export const metadata = {
  title: "Access denied · Peckers Cash Flow",
};

export default function AccessDeniedPage() {
  return (
    <main className="min-h-screen w-full grid place-items-center px-4 py-10">
      <div className="w-full max-w-md text-center">
        <div className="flex items-center justify-center mb-8">
          <Logo />
        </div>
        <div className="rounded-2xl bg-surface border border-border p-8">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-danger/10 border border-danger/30 flex items-center justify-center text-danger mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-text-primary">Access Denied</h1>
          <p className="text-sm text-text-muted mt-2">
            Your email is not authorised to access this app. If you believe this is a mistake, please contact an administrator.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center h-11 px-5 rounded-xl bg-gold text-black font-medium mt-6 hover:bg-gold-300 transition-colors"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
