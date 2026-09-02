import type { ReactNode } from 'react';

// The page masthead. Two variants, because the site genuinely has two:
//
//   'band'  the original — a full-width band with a 3px double bottom border,
//           used by /teams, /schedule and /fighters.
//   'plain' the gazette pages' masthead: eyebrow + big serif title with no
//           border, since those pages carry their own SectionRule underneath.
//
// Both now share `tbl-page-header__title`, whose clamp(36px, 6vw, 64px) scales
// on mobile. /advanced and /stats previously hand-rolled this at a fixed 54px,
// which did not scale at all.

interface PageHeaderProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** right-hand slot, e.g. a filter group */
  right?: ReactNode;
  variant?: 'band' | 'plain';
  /** extra content directly under the title — a view switcher, a blurb */
  children?: ReactNode;
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  right,
  variant = 'band',
  children,
}: PageHeaderProps) {
  if (variant === 'plain') {
    return (
      <div className="tbl-page-header tbl-page-header--plain">
        <div>
          {eyebrow && <div className="tbl-eyebrow">{eyebrow}</div>}
          <h1 className="tbl-page-header__title">{title}</h1>
          {subtitle && <div className="tbl-page-header__subtitle">{subtitle}</div>}
          {children}
        </div>
        {right && <div>{right}</div>}
      </div>
    );
  }

  return (
    <div className="tbl-page-header">
      <div>
        {eyebrow && <div className="tbl-eyebrow">{eyebrow}</div>}
        <h1 className="tbl-page-header__title">{title}</h1>
        {subtitle && <div className="tbl-page-header__subtitle">{subtitle}</div>}
        {children}
      </div>
      {right && <div>{right}</div>}
    </div>
  );
}
