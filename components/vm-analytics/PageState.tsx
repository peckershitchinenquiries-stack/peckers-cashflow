export function EmptyWeek({ message }: { message?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <p className="text-sm font-medium text-ink-soft">
        {message ?? "No data has been synced for this week yet."}
      </p>
      <p className="mt-1 text-xs text-ink-faint">
        Run the sync (<code>npm run sync</code> in vm-extractor) or pick another
        week.
      </p>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-6">
      <p className="text-sm font-semibold text-rose-700">Couldn't load data</p>
      <p className="mt-1 text-sm text-rose-600">{message}</p>
      <p className="mt-2 text-xs text-rose-500">
        Check that <code>.env.local</code> has the Supabase URL + anon key, and
        that the KPI views exist (run <code>sql/kpi_views.sql</code>).
      </p>
    </div>
  );
}

export function PageTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-5">
      <h1 className="text-2xl font-bold text-ink">{title}</h1>
      {subtitle && <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p>}
    </div>
  );
}
