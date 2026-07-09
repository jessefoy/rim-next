# OnlyOffice — retired

OnlyOffice was removed in session 161. It had only test documents; the retirement migration deletes those records and their Blob files, removes the office-only columns and enum value, and removes the self-hosted editor/save-callback code.

RIM documents are now native documents, links, and uploaded PDFs. See `RIM_Documents.md` for the supported filing and editing system.

The retirement is complete: the DigitalOcean droplet was destroyed, the `docs.rootedinmindfulness.org` DNS record was removed, and `ONLYOFFICE_URL` / `ONLYOFFICE_JWT_SECRET` were removed from Vercel. This file remains only as a retirement record; it is not an implementation reference.
