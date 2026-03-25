-- Add toolSlug column to hub_app_links (nullable, references tool registry)
ALTER TABLE "hub_app_links" ADD COLUMN "toolSlug" TEXT;

-- Backfill existing links based on href
UPDATE "hub_app_links" SET "toolSlug" = 'schedule' WHERE "href" LIKE '%/tools/schedule%';
UPDATE "hub_app_links" SET "toolSlug" = 'inbox' WHERE "href" LIKE '%/tools/inbox%';
UPDATE "hub_app_links" SET "toolSlug" = 'programs' WHERE "href" LIKE '%/tools/programs%';
UPDATE "hub_app_links" SET "toolSlug" = 'learning' WHERE "href" LIKE '%/tools/learning%';
