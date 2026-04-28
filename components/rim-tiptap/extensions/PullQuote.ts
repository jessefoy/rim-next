/**
 * PullQuote — oversized centered serif quote with decorative teal mark.
 *
 * Visual: page-scale dramatic pause. Used in program descriptions, lessons.
 * Attribution renders as a cite element below the quote text.
 *
 * Storage HTML:
 *   <div class="rim-el-pull-quote">
 *     <div class="rim-el-pull-quote__text">{content}</div>
 *     <cite class="rim-el-pull-quote__attribution">{attribution}</cite>
 *   </div>
 */

import { Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    pullQuote: {
      setPullQuote: (attrs?: { attribution?: string }) => ReturnType;
    };
  }
}

export const PullQuote = Node.create({
  name: "pullQuote",
  group: "block",
  content: "inline*",
  defining: true,

  addAttributes() {
    return {
      attribution: {
        default: null,
        parseHTML: (el) =>
          el.querySelector(".rim-el-pull-quote__attribution")?.textContent ?? null,
      },
    };
  },

  parseHTML() {
    return [{ tag: "div.rim-el-pull-quote" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const children: (string | Array<unknown>)[] = [
      ["div", { class: "rim-el-pull-quote__text" }, 0],
    ];
    if (node.attrs.attribution) {
      children.push([
        "cite",
        { class: "rim-el-pull-quote__attribution" },
        node.attrs.attribution,
      ]);
    }
    return [
      "div",
      mergeAttributes(HTMLAttributes, { class: "rim-el-pull-quote" }),
      ...(children as any),
    ];
  },

  addCommands() {
    return {
      setPullQuote:
        (attrs) =>
        ({ commands }) =>
          commands.setNode(this.name, attrs ?? {}),
    };
  },
});
