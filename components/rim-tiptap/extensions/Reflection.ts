/**
 * Reflection — italic question lead-in + block-level body.
 *
 * Invites sitting with a question. Used in program descriptions and lessons.
 *
 * Storage HTML:
 *   <div class="rim-el-reflection">
 *     <div class="rim-el-reflection__question">{question}</div>  (only if set)
 *     <div class="rim-el-reflection__body">{block content}</div>
 *   </div>
 */

import { Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    reflection: {
      setReflection: (attrs?: { question?: string }) => ReturnType;
    };
  }
}

export const Reflection = Node.create({
  name: "reflection",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      question: {
        default: null,
        parseHTML: (el) =>
          el.querySelector(".rim-el-reflection__question")?.textContent ?? null,
      },
    };
  },

  parseHTML() {
    return [{ tag: "div.rim-el-reflection" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const children: (string | Array<unknown>)[] = [];
    if (node.attrs.question) {
      children.push([
        "div",
        { class: "rim-el-reflection__question" },
        node.attrs.question,
      ]);
    }
    children.push(["div", { class: "rim-el-reflection__body" }, 0]);
    return [
      "div",
      mergeAttributes(HTMLAttributes, { class: "rim-el-reflection" }),
      ...(children as any),
    ];
  },

  addCommands() {
    return {
      setReflection:
        (attrs) =>
        ({ commands }) =>
          commands.wrapIn(this.name, attrs ?? {}),
    };
  },
});
