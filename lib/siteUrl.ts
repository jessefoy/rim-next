/**
 * The public address search engines should use. rootedinmindfulness.org
 * becomes the live domain on launch; until then the site is served at
 * rim-next.vercel.app, which sends X-Robots-Tag: noindex (vercel.json) and
 * points its canonical here. One constant for the layout's metadataBase, the
 * robots file and the sitemap.
 */
export const SITE_ORIGIN = "https://rootedinmindfulness.org";
