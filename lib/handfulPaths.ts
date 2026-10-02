/** Where the two Handful of Leaves documents live in the member area. Kept
    apart from lib/handfulContent.ts (which reads files) so client components
    can import it. */
export type HandfulSlug = "introduction" | "map";

export const HANDFUL_PATHS: Record<HandfulSlug, string> = {
  introduction: "/account/handful-of-leaves",
  map: "/account/handful-of-leaves/map",
};
