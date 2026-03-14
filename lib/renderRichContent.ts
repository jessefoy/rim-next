import { generateHTML } from "@tiptap/html"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import { VerseQuote, PracticeSuggestion, Callout } from "./tiptap-extensions"

const contentExtensions = [StarterKit, Link, VerseQuote, PracticeSuggestion, Callout]
const formattedExtensions = [StarterKit, Link]

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
