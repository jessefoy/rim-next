/**
 * Callout — titled box with an icon. Two variants:
 *   - "note":     💡 warm beige tint, "aside information worth surfacing"
 *   - "decision": ✓ teal-green tint, marks a concluded decision
 *
 * Storage HTML:
 *   <div class="rim-el-note rim-el-note--{variant}" data-variant="{variant}">
 *     <div class="rim-el-note__title">{title}</div>     (only if title)
 *     <div class="rim-el-note__body">{block content}</div>
 *   </div>
 *
 * Note: title is an optional attribute. Body is block-level (paragraphs, lists).
 */

import { Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (attrs?: {
        variant?: "note" | "decision";
        title?: string;
      }) => ReturnType;
      toggleCallout: (attrs?: {
        variant?: "note" | "decision";
        title?: string;
      }) => ReturnType;
    };
  }
}

export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      variant: {
        default: "note",
        parseHTML: (el) => el.getAttribute("data-variant") ?? "note",
        renderHTML: (attrs) => ({ "data-variant": attrs.variant }),
      },
      title: {
        default: null,
        parseHTML: (el) =>
          el.querySelector(".rim-el-note__title")?.textContent ?? null,
      },
    };
  },

  parseHTML() {
    return [{ tag: "div.rim-el-note" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const variant = node.attrs.variant ?? "note";
    const children: (string | Array<unknown>)[] = [];
    if (node.attrs.title) {
      children.push([
        "div",
        { class: "rim-el-note__title" },
        node.attrs.title,
      ]);
    }
    children.push(["div", { class: "rim-el-note__body" }, 0]);
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        class: `rim-el-note rim-el-note--${variant}`,
      }),
      ...(children as any),
    ];
  },

  addCommands() {
    return {
      setCallout:
        (attrs) =>
        ({ commands }) =>
          commands.wrapIn(this.name, attrs ?? { variant: "note" }),
      toggleCallout:
        (attrs) =>
        ({ commands }) =>
          commands.toggleWrap(this.name, attrs ?? { variant: "note" }),
    };
  },
});
