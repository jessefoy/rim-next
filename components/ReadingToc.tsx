/**
 * "On this page" for the long reading pages (the 2026-10-09 refresh): a
 * sticky list beside the article from 901px up, and a native disclosure above
 * it on narrower screens. One list of sections feeds both and the page's own
 * h2 ids, so they cannot drift. Server-rendered; no JavaScript.
 */
export type ReadingSection = { readonly id: string; readonly title: string };

export default function ReadingToc({ sections }: { sections: readonly ReadingSection[] }) {
  const list = (
    <ol>
      {sections.map((s) => (
        <li key={s.id}>
          <a href={`#${s.id}`}>{s.title}</a>
        </li>
      ))}
    </ol>
  );
  return (
    <nav className="pp-reading__toc" aria-label="On this page">
      <div className="pp-reading__toc-desktop">
        <p aria-hidden="true">On this page</p>
        {list}
      </div>
      <details className="pp-reading__toc-mobile">
        <summary>
          On this page <span aria-hidden="true">+</span>
        </summary>
        {list}
      </details>
    </nav>
  );
}
