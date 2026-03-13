/**
 * VariableNode — Tiptap custom inline node for {{token}} variables.
 *
 * Behaviour:
 *   - Displays as an amber pill badge inside the editor (non-editable atom)
 *   - Serializes to plain markdown as {{token}}
 *   - Parses {{token}} patterns in incoming markdown back to VariableNode atoms
 *
 * Integration:
 *   - Add to `extensions` array in RimEditor
 *   - Insert via: editor.commands.insertVariable("firstName")
 *   - Works with tiptap-markdown: storage.markdown.serialize + parse.setup
 */

import { Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    variable: {
      insertVariable: (name: string) => ReturnType;
    };
  }
}

export const VariableNode = Node.create({
  name: "variable",
  group: "inline",
  inline: true,
  atom: true,      // non-editable; treated as a single unit
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      name: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-variable"),
        renderHTML: (attrs) => ({ "data-variable": attrs.name }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-variable]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class: "ri-var-chip",
        contenteditable: "false",
      }),
      `{{${node.attrs.name}}}`,
    ];
  },

  addCommands() {
    return {
      insertVariable:
        (name: string) =>
        ({ chain }) => {
          return chain()
            .focus()
            .insertContent({ type: "variable", attrs: { name } })
            .run();
        },
    };
  },

  // tiptap-markdown integration: serialize this node back to {{token}}
  // and parse incoming {{token}} patterns from markdown.
  addStorage() {
    return {
      markdown: {
        serialize(
          state: { write: (s: string) => void },
          node: { attrs: { name: string } }
        ) {
          state.write(`{{${node.attrs.name}}}`);
        },
        parse: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setup(markdownit: any) {
            // Guard: setup is called on every parse() call (same markdownit instance).
            // Only register once to avoid duplicate rules.
            const alreadyRegistered = markdownit.inline.ruler.__rules__.some(
              (r: { name: string }) => r.name === "variable"
            );
            if (alreadyRegistered) return;

            // Register inline rule before linkify to catch {{token}} patterns
            markdownit.inline.ruler.before(
              "linkify",
              "variable",
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (state: any, silent: boolean) => {
                const pos = state.pos;
                const src = state.src;

                if (src.charCodeAt(pos) !== 0x7b || src.charCodeAt(pos + 1) !== 0x7b) {
                  return false;
                }

                const end = src.indexOf("}}", pos + 2);
                if (end === -1 || end === pos + 2) return false;

                const name = src.slice(pos + 2, end).trim();
                // Only treat as a variable if the name is a simple identifier
                if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) return false;

                if (!silent) {
                  const token = state.push("variable_inline", "span", 0);
                  token.attrSet("data-variable", name);
                  token.markup = src.slice(pos, end + 2);
                }

                state.pos = end + 2;
                return true;
              }
            );

            // Render the token as the HTML that parseHTML() will recognise
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            markdownit.renderer.rules["variable_inline"] = (tokens: any[], idx: number) => {
              const name = tokens[idx].attrGet("data-variable");
              return `<span data-variable="${name}"></span>`;
            };
          },
        },
      },
    };
  },
});
