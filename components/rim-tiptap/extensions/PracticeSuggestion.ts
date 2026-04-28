/**
 * PracticeSuggestion — "PRACTICE" eyebrow + serif title + block-level body.
 *
 * A contemplative invitation. Used in program descriptions and lessons.
 * Title is an attribute (optional). Body is children (paragraphs, lists).
 *
 * Storage HTML:
 *   <div class="rim-el-practice">
 *     <div class="rim-el-practice__eyebrow">Practice</div>
 *     <div class="rim-el-practice__title">{title}</div>     (only if title)
 *     <div class="rim-el-practice__body">{block content}</div>
 *   </div>
 */

import { Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    practiceSuggestion: {
      setPracticeSuggestion: (attrs?: { title?: string }) => ReturnType;
    };
  }
}

export const PracticeSuggestion = Node.create({
  name: "practiceSuggestion",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      title: {
        default: null,
        parseHTML: (el) =>
          el.querySelector(".rim-el-practice__title")?.textContent ?? null,
      },
    };
  },

  parseHTML() {
    return [{ tag: "div.rim-el-practice" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const children: (string | Array<unknown>)[] = [
      ["div", { class: "rim-el-practice__eyebrow" }, "Practice"],
    ];
    if (node.attrs.title) {
      children.push([
        "div",
        { class: "rim-el-practice__title" },
        node.attrs.title,
      ]);
    }
    children.push(["div", { class: "rim-el-practice__body" }, 0]);
    return [
      "div",
      mergeAttributes(HTMLAttributes, { class: "rim-el-practice" }),
      ...(children as any),
    ];
  },

  addCommands() {
    return {
      setPracticeSuggestion:
        (attrs) =>
        ({ commands }) =>
          commands.wrapIn(this.name, attrs ?? {}),
    };
  },
});
