# OnlyOffice — retired

OnlyOffice was removed in session 161. It had only test documents; the retirement migration deletes those records and their Blob files, removes the office-only columns and enum value, and removes the self-hosted editor/save-callback code.

RIM documents are now native documents, links, and uploaded PDFs. See `RIM_Documents.md` for the supported filing and editing system.

After the deploy that runs `retire_onlyoffice_v1`, shut down the OnlyOffice containers and decommission the DigitalOcean droplet, then remove `ONLYOFFICE_URL` and `ONLYOFFICE_JWT_SECRET` from Vercel. This file remains only as a retirement record; it is not an implementation reference.
