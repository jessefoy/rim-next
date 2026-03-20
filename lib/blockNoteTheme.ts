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
      background: "#f0eeec",
    },
    selected: {
      text: "#ffffff",
      background: "#135274",
    },
    disabled: {
      text: "#5a5450",
      background: "#f6f3f0",
    },
    shadow: "rgba(13, 34, 53, 0.08)",
    border: "#ddd8d3",
    sideMenu: "#5a5450",
    highlights: {
      gray:   { text: "#5a5450", background: "#f6f3f0" },
      blue:   { text: "#2c5a7a", background: "#e8f0f6" },
      green:  { text: "#1a5a4a", background: "#e3f0ea" },
    },
  },
  borderRadius: 10,
  fontFamily: "'Inter', sans-serif",
};
