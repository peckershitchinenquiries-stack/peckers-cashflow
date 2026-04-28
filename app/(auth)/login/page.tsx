import { LoginForm } from "@/components/auth/LoginForm";
import { Logo } from "@/components/layout/Logo";

export const metadata = {
  title: "Sign in · Peckers Cash Flow",
};

export default function LoginPage() {
  return (
    <main className="min-h-screen w-full grid place-items-center px-4 py-10 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -top-32 -left-32 h-[420px] w-[420px] rounded-full bg-gold/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-24 h-[380px] w-[380px] rounded-full bg-gold/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex items-center justify-center">
          <Logo />
        </div>

        <div className="rounded-2xl bg-surface border border-border p-7 shadow-2xl shadow-black/40">
          <h1 className="text-xl font-semibold tracking-wide text-text-primary">
            Welcome back
          </h1>
          <p className="text-sm text-text-muted mt-1.5 mb-6">
            Sign in to continue managing cash flow.
          </p>

          <LoginForm />
        </div>

        <p className="text-center text-xs text-text-muted mt-6">
          Internal access only · Built by WEBCROS
        </p>
      </div>
    </main>
  );
}
