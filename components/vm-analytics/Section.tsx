export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="vm-section">
      <div>
        <h2 className="vm-section-title">{title}</h2>
        {description && (
          <p className="vm-section-description">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

export function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="vm-card p-4">
      <div className="mb-4 text-sm font-semibold text-primary">{title}</div>
      {children}
    </div>
  );
}
