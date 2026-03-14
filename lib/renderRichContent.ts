import { generateHTML } from "@tiptap/html"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import Underline from "@tiptap/extension-underline"
import TextAlign from "@tiptap/extension-text-align"
import { Table } from "@tiptap/extension-table"
import TableRow from "@tiptap/extension-table-row"
import TableHeader from "@tiptap/extension-table-header"
import TableCell from "@tiptap/extension-table-cell"
import { VerseQuote, PracticeSuggestion, Callout } from "./tiptap-extensions"

const contentExtensions = [
  StarterKit,
  Link,
  Underline,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Table.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
  VerseQuote,
  PracticeSuggestion,
  Callout,
]

const formattedExtensions = [
  StarterKit,
  Link,
  Underline,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
]

export function renderContentBody(json: any): string {
  if (!json) return ""
  try {
    return generateHTML(json, contentExtensions)
  } catch {
    return ""
  }
}

export function renderFormattedText(json: any): string {
  if (!json) return ""
  try {
    return generateHTML(json, formattedExtensions)
  } catch {
    return ""
  }
}
