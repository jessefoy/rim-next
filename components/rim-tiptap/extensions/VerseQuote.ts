/**
 * VerseQuote — smaller centered serif quote, reverent.
 *
 * Used for canonical or external dharma text. Smaller and quieter than
 * PullQuote, with the same attribution pattern.
 *
 * Storage HTML:
 *   <div class="rim-el-verse">
 *     <div class="rim-el-verse__text">{content}</div>
 *     <cite class="rim-el-verse__attribution">{attribution}</cite>
 *   </div>
 */

import { Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    verseQuote: {
      setVerseQuote: (attrs?: { attribution?: string }) => ReturnType;
    };
  }
}

export const VerseQuote = Node.create({
  name: "verseQuote",
  group: "block",
  content: "inline*",
  defining: true,

  addAttributes() {
    return {
      attribution: {
        default: null,
        parseHTML: (el) =>
          el.querySelector(".rim-el-verse__attribution")?.textContent ?? null,
      },
    };
  },

  parseHTML() {
    return [{ tag: "div.rim-el-verse" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const children: (string | Array<unknown>)[] = [
      ["div", { class: "rim-el-verse__text" }, 0],
    ];
    if (node.attrs.attribution) {
      children.push([
        "cite",
        { class: "rim-el-verse__attribution" },
        node.attrs.attribution,
      ]);
    }
    return [
      "div",
      mergeAttributes(HTMLAttributes, { class: "rim-el-verse" }),
      ...(children as any),
    ];
  },

  addCommands() {
    return {
      setVerseQuote:
        (attrs) =>
        ({ commands }) =>
          commands.setNode(this.name, attrs ?? {}),
    };
  },
});
