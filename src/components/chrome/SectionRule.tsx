interface SectionRuleProps {
  left: string;
  right?: string;
}

export function SectionRule({ left, right }: SectionRuleProps) {
  return (
    <div className="tbl-section-rule">
      <span>{left}</span>
      {right && <span>{right}</span>}
    </div>
  );
}
