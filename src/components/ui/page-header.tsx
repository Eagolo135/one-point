type PageHeaderProps = {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
};

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <header className="mb-5 flex flex-col gap-3 border-b border-surface-border/70 pb-4 md:flex-row md:items-start md:justify-between md:gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        <p className="mt-1 text-sm text-zinc-300">{subtitle}</p>
      </div>
      {action ? <div>{action}</div> : null}
    </header>
  );
}
