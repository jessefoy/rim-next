/**
 * Upsert ManualSection for hub documents editor features.
 * Run: npx tsx prisma/upsert-hub-documents-manual.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({
  datasources: { db: { url: process.env.POSTGRES_URL_NON_POOLING } },
});

async function main() {
  const body = {
    type: "rawHtml",
    html: `
<p>Hub Documents let hub coordinators create, edit, and share documents within any hub workspace. Documents are created using the rich text editor (RimTiptapEditor, document variant) and stored as plain HTML in the database.</p>

<h2>Creating a document</h2>
<p>Go to your hub's Documents tab and click <strong>"New Document"</strong>. You can also add external links via "Add Link." Native documents open in the built-in editor; link documents open in a new tab.</p>

<h2>The editor</h2>
<p>The document editor has two toolbar contexts:</p>
<ul>
  <li><strong>Selection toolbar</strong> — appears when you select text. Includes bold, italic, underline, link, text alignment, and a block type selector (paragraph, H1, H2, H3, bullet list, numbered list, quote).</li>
  <li><strong>Empty-line pill</strong> — appears on empty paragraphs. Includes heading and list dropdowns, formatting buttons, and insert buttons for tables and images.</li>
</ul>

<h3>Headings</h3>
<p>Three heading levels: H1 (largest), H2, and H3. Use the paragraph dropdown (&#182;&#9662;) in the selection toolbar or the H&#9662; dropdown in the empty-line pill. You can also type <code># </code>, <code>## </code>, or <code>### </code> at the start of a line.</p>

<h3>Images</h3>
<p>Insert images via the camera button in the empty-line pill, or drag and drop an image directly into the editor. Once inserted, hover over the image to see alignment controls (left, center, right). Any logged-in member can upload images.</p>

<h3>Tables</h3>
<p>Insert a table via the grid button in the empty-line pill. Tables support colored cells (background and text color), header rows, and split cells. To delete a table, hover over it and click the &times; button at the top-left corner.</p>

<h2>Document locking</h2>
<p>The document author can <strong>lock</strong> a document to prevent edits from other hub members. Click the lock icon in the editor toolbar. Admins can always unlock and edit any document. When a document is locked, other members see it as read-only.</p>

<h2>Collaborative editing</h2>
<p>If someone else is currently editing a document, you'll see a warning banner when you open the editor. You can choose "Continue anyway" to proceed, but be aware that the other person's changes may be overwritten.</p>

<h2>Published view</h2>
<p>When viewing a document (not editing), it renders in the same clean reading style as the staff manual. All formatting — headings, lists, tables with colors, images with alignment — carries over to the published view.</p>

<h2>Image storage</h2>
<p>Images are stored in Vercel Blob. When you remove an image from a document and save, the blob file is automatically cleaned up. If a document is deleted, all its images are cleaned up too.</p>
    `.trim(),
  };

  await db.manualSection.upsert({
    where: { slug: "hub-documents" },
    update: { title: "Hub Documents", body, order: 7 },
    create: {
      slug: "hub-documents",
      title: "Hub Documents",
      body,
      order: 7,
    },
  });

  console.log("Upserted hub-documents manual section");
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
