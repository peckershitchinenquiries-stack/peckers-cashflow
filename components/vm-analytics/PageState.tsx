export function EmptyWeek({ message }: { message?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface p-10 text-center">
      <p className="text-sm font-medium text-secondary">
        {message ?? "No data has been synced for this week yet."}
      </p>
      <p className="mt-2 text-xs text-tertiary">
        Run the sync (<code className="font-mono text-xs">npm run sync</code> in vm-extractor) or pick another
        week.
      </p>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-6">
      <p className="text-sm font-semibold text-red-700 dark:text-red-400">Couldn't load data</p>
      <p className="mt-2 text-sm text-red-600 dark:text-red-300">{message}</p>
      <p className="mt-3 text-xs text-red-500 dark:text-red-400">
        Check that <code className="font-mono text-xs">.env.local</code> has the Supabase URL + anon key, and
        that the KPI views exist (run <code className="font-mono text-xs">sql/kpi_views.sql</code> or the migration).
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
    <div className="mb-6">
      <h1 className="text-3xl font-bold text-primary">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-secondary">{subtitle}</p>}
    </div>
  );
}
