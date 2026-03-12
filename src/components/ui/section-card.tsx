import type { ReactNode } from "react";

type SectionCardProps = {
  title: string;
  children: ReactNode;
  description?: string;
};

export function SectionCard({ title, description, children }: SectionCardProps) {
  return (
    <section className="onpoint-card onpoint-card-interactive p-4 md:p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold tracking-tight md:text-lg">{title}</h2>
        {description ? <p className="mt-1 text-sm text-zinc-300">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
