import { Theme } from "@blocknote/mantine";

export const rimTheme: Theme = {
  colors: {
    editor: {
      text: "#333333",
      background: "transparent",
    },
    menu: {
      text: "#333333",
      background: "#ffffff",
    },
    tooltip: {
      text: "#ffffff",
      background: "#0d2235",
    },
    hovered: {
      text: "#333333",
      background: "#f0f0f0",
    },
    selected: {
      text: "#ffffff",
      background: "#135274",
    },
    disabled: {
      text: "#666",
      background: "#f5f5f5",
    },
    shadow: "rgba(13, 34, 53, 0.08)",
    border: "#d5d5d5",
    sideMenu: "#666",
    highlights: {
      gray:   { text: "#666", background: "#f5f5f5" },
      blue:   { text: "#2c5a7a", background: "#e8f0f6" },
      green:  { text: "#1a5a4a", background: "#e3f0ea" },
    },
  },
  borderRadius: 10,
  fontFamily: "'Inter', sans-serif",
};
