import type { PageSection } from "@/lib/pageBuilder/types";

interface CtaProps {
  heading?: string;
  buttonLabel?: string;
  buttonHref?: string;
}

export function CtaBlock({ section }: { section: PageSection }) {
  const p = section.props as CtaProps;
  return (
    <div className="blk-cta">
      {p.heading ? <h2 className="blk-cta__heading">{p.heading}</h2> : null}
      {p.buttonLabel && p.buttonHref ? (
        <a className="blk-cta__btn" href={p.buttonHref}>
          {p.buttonLabel}
        </a>
      ) : null}
    </div>
  );
}
