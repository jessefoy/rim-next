import type { PageSection } from "@/lib/pageBuilder/types";

interface Card {
  title?: string;
  body?: string;
  href?: string;
  linkLabel?: string;
}
interface CardGridProps {
  heading?: string;
  cards?: Card[];
}

export function CardGridBlock({ section }: { section: PageSection }) {
  const p = section.props as CardGridProps;
  const cards = p.cards ?? [];
  const cols = section.variant === "two" ? 2 : section.variant === "four" ? 4 : 3;
  return (
    <div className="blk-cardgrid">
      {p.heading ? <h2 className="blk-cardgrid__heading">{p.heading}</h2> : null}
      <div className={`blk-cardgrid__grid blk-cardgrid__grid--${cols}`}>
        {cards.map((c, i) => (
          <div className="blk-card" key={i}>
            {c.title ? <h3 className="blk-card__title">{c.title}</h3> : null}
            {c.body ? <p className="blk-card__body">{c.body}</p> : null}
            {c.href && c.linkLabel ? (
              <a className="blk-card__link" href={c.href}>
                {c.linkLabel}
              </a>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
