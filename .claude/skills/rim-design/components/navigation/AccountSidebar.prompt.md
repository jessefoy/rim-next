White 248px rail beside the warm member content area. Lucide icons at 17px / strokeWidth 1.75.

```jsx
<AccountSidebar activeHref="/account/dashboard" sections={[{ label: "My RIM", links: [{ label: "Home", href: "/account/dashboard", icon: <Home size={17} strokeWidth={1.75} /> }] }]} />
```

Active link = `--rim-bg` fill, `--rim-blue` label, 600 weight. Collapses to 64px, icons only.
