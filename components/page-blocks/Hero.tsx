import type { PageSection } from "@/lib/pageBuilder/types";

interface HeroProps {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  buttonLabel?: string;
  buttonHref?: string;
}

export function HeroBlock({ section }: { section: PageSection }) {
  const p = section.props as HeroProps;
  const variant = section.variant ?? "centered";
  return (
    <div className={`blk-hero blk-hero--${variant}`}>
      <div className="blk-hero__inner">
        {p.eyebrow ? <p className="blk-hero__eyebrow">{p.eyebrow}</p> : null}
        {p.title ? <h1 className="blk-hero__title">{p.title}</h1> : null}
        {p.subtitle ? <p className="blk-hero__subtitle">{p.subtitle}</p> : null}
        {p.buttonLabel && p.buttonHref ? (
          <a className="blk-hero__btn" href={p.buttonHref}>
            {p.buttonLabel}
          </a>
        ) : null}
      </div>
    </div>
  );
}
