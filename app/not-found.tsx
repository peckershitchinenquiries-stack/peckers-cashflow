import Link from "next/link";
import { Logo } from "@/components/layout/Logo";

export default function NotFound() {
  return (
    <main className="min-h-screen w-full grid place-items-center px-4 py-10">
      <div className="w-full max-w-md text-center">
        <div className="flex items-center justify-center mb-8">
          <Logo />
        </div>
        <div className="rounded-2xl bg-surface border border-border p-8">
          <h1 className="text-3xl font-semibold text-text-primary">404</h1>
          <p className="text-sm text-text-muted mt-2">
            The page you're looking for doesn't exist.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center h-11 px-5 rounded-xl bg-gold text-black font-medium mt-6 hover:bg-gold-300 transition-colors"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
