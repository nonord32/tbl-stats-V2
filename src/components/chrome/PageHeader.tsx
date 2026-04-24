import type { ReactNode } from 'react';

interface PageHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
}

export function PageHeader({ eyebrow, title, subtitle, right }: PageHeaderProps) {
  return (
    <div className="tbl-page-header">
      <div>
        {eyebrow && <div className="tbl-eyebrow">{eyebrow}</div>}
        <h1 className="tbl-page-header__title">{title}</h1>
        {subtitle && <div className="tbl-page-header__subtitle">{subtitle}</div>}
      </div>
      {right && <div>{right}</div>}
    </div>
  );
}
