import AccountLayout from "@/components/AccountLayout";
import { loadHandfulDoc } from "@/lib/handfulContent";
import type { HandfulSlug } from "@/lib/handfulPaths";

/**
 * A Handful of Leaves document as a members-only reading page. The route group
 * (authenticated) already sends signed-out visitors to sign-in, so nothing
 * here checks the session. The document's own title is the page heading; the
 * body is the document, rendered. A print stylesheet (custom.css, "A HANDFUL
 * OF LEAVES — member reading pages") drops the member chrome so either page
 * prints as a clean document.
 */
export default function HandfulReading({ slug }: { slug: HandfulSlug }) {
  const doc = loadHandfulDoc(slug);
  return (
    <AccountLayout>
      <article className="ac-member-page hol-reading">
        <header className="ac-page-head">
          <h1 className="ac-page-title">{doc.title}</h1>
        </header>
        <div className="rim-content hol-content" dangerouslySetInnerHTML={{ __html: doc.html }} />
      </article>
    </AccountLayout>
  );
}
