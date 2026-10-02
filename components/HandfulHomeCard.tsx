import Link from "next/link";
import { HANDFUL_PATHS } from "@/lib/handfulPaths";

/**
 * My Home's card for the two Handful of Leaves documents (the integration
 * follow-up brief, F4). The introduction is the primary link, the map the
 * secondary. One quiet white surface, like the Today card; no badge, no
 * "new" mark. The documents themselves are members-only reading pages.
 */
export default function HandfulHomeCard() {
  return (
    <section className="db-handful" aria-labelledby="db-handful-title">
      <h2 id="db-handful-title" className="db-handful__title">
        A Handful of Leaves
      </h2>
      <p className="db-handful__text">
        The introduction to the teachings behind our practice, and the full map of them.
      </p>
      <div className="rim-home-links">
        <Link href={HANDFUL_PATHS.introduction}>
          The introduction <span aria-hidden="true">→</span>
        </Link>
        <Link href={HANDFUL_PATHS.map}>
          The map <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}
