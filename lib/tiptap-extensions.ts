import { Node, mergeAttributes } from "@tiptap/core"

export const VerseQuote = Node.create({
  name: "verseQuote",
  group: "block",
  content: "block*",
  addAttributes() {
    return {
      attribution: { default: "" }
    }
  },
  parseHTML() {
    return [{ tag: "div[data-type='verse-quote']" }]
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "verse-quote",
        class: "lp-verse-quote"
      }),
      0
    ]
  },
})

export const PracticeSuggestion = Node.create({
  name: "practiceSuggestion",
  group: "block",
  content: "block*",
  parseHTML() {
    return [{ tag: "div[data-type='practice-suggestion']" }]
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "practice-suggestion",
        // Uses lp-callout to match existing Practice Suggestion CSS
        // (shared with Sanity PortableText practiceCallout on program pages)
        class: "lp-callout"
      }),
      0
    ]
  },
})

export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block*",
  parseHTML() {
    return [{ tag: "div[data-type='callout']" }]
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "callout",
        // Uses lp-callout-block to match existing Callout CSS
        class: "lp-callout-block"
      }),
      0
    ]
  },
})
