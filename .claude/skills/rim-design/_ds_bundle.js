/* @ds-bundle: {"format":4,"namespace":"RootedInMindfulnessDesignSystem_980dba","components":[{"name":"DetailRow","sourcePath":"components/content/DetailRow.jsx"},{"name":"HeroPanel","sourcePath":"components/content/HeroPanel.jsx"},{"name":"ListRow","sourcePath":"components/content/ListRow.jsx"},{"name":"ProgramCard","sourcePath":"components/content/ProgramCard.jsx"},{"name":"PullQuote","sourcePath":"components/content/PullQuote.jsx"},{"name":"ScheduleRow","sourcePath":"components/content/ScheduleRow.jsx"},{"name":"Testimonial","sourcePath":"components/content/Testimonial.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Eyebrow","sourcePath":"components/core/Eyebrow.jsx"},{"name":"Panel","sourcePath":"components/core/Panel.jsx"},{"name":"StateMessage","sourcePath":"components/core/StateMessage.jsx"},{"name":"TextField","sourcePath":"components/core/TextField.jsx"},{"name":"AccountSidebar","sourcePath":"components/navigation/AccountSidebar.jsx"},{"name":"MemberBar","sourcePath":"components/navigation/MemberBar.jsx"},{"name":"SiteFooter","sourcePath":"components/navigation/SiteFooter.jsx"},{"name":"SiteNav","sourcePath":"components/navigation/SiteNav.jsx"}],"sourceHashes":{"components/content/DetailRow.jsx":"180aa47f9e2a","components/content/HeroPanel.jsx":"09e32d39a2a5","components/content/ListRow.jsx":"120734e3f69f","components/content/ProgramCard.jsx":"d41544a95387","components/content/PullQuote.jsx":"12fd41970273","components/content/ScheduleRow.jsx":"3a64392269a6","components/content/Testimonial.jsx":"3b78953a0ebb","components/core/Badge.jsx":"6af78884a5bc","components/core/Button.jsx":"b187b0bee2ce","components/core/Card.jsx":"518f6ac051a6","components/core/Eyebrow.jsx":"76b98c68c92e","components/core/Panel.jsx":"30556e1edb2f","components/core/StateMessage.jsx":"5782a5712202","components/core/TextField.jsx":"ddc14c1ba70e","components/navigation/AccountSidebar.jsx":"d02c232112c8","components/navigation/MemberBar.jsx":"4cf643cd8521","components/navigation/SiteFooter.jsx":"93f423e90074","components/navigation/SiteNav.jsx":"223964a2598e","ui_kits/member-area/Dashboard.jsx":"ad14c595835e","ui_kits/member-area/Profile.jsx":"c5febb194f76","ui_kits/public-website/Home.jsx":"262fded654d7","ui_kits/public-website/ProgramDetail.jsx":"90f470a9da28","ui_kits/public-website/ProgramsList.jsx":"690774317878"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.RootedInMindfulnessDesignSystem_980dba = window.RootedInMindfulnessDesignSystem_980dba || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/content/DetailRow.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Icon + fact row inside a program details card. Divider between rows. */
function DetailRow({
  icon,
  children,
  link,
  linkHref,
  last = false,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "flex",
      alignItems: "center",
      gap: 16,
      padding: "15px 5px 15px 0",
      borderBottom: last ? "none" : "1px solid var(--rim-rule)",
      ...style
    }
  }, rest), icon ? /*#__PURE__*/React.createElement("span", {
    style: {
      flexShrink: 0,
      color: "var(--rim-text-muted)",
      display: "flex",
      alignItems: "center"
    }
  }, icon) : null, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      fontFamily: "var(--font-sans)",
      fontSize: 17,
      color: "var(--rim-text)",
      lineHeight: 1.77
    }
  }, children), link ? /*#__PURE__*/React.createElement("a", {
    href: linkHref,
    style: {
      color: "var(--rim-mid)",
      fontSize: "var(--text-ui)",
      textDecoration: "none",
      whiteSpace: "nowrap"
    }
  }, link) : null);
}
Object.assign(__ds_scope, { DetailRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/content/DetailRow.jsx", error: String((e && e.message) || e) }); }

// components/content/HeroPanel.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Matte paper panel over a full-bleed image or video — the homepage hero. */
function HeroPanel({
  heading,
  children,
  cta,
  ctaHref = "#",
  backgroundImage,
  minHeight = 640,
  overlay = "rgba(12,18,22,0.38)",
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("section", _extends({
    style: {
      position: "relative",
      minHeight,
      display: "flex",
      alignItems: "center",
      backgroundColor: "var(--rim-dark)",
      backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
      backgroundSize: "cover",
      backgroundPosition: "center",
      overflow: "hidden",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: overlay,
      zIndex: 1
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      zIndex: 2,
      width: "100%",
      maxWidth: "var(--container-max)",
      margin: "0 auto",
      padding: "0 var(--container-pad)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-block",
      background: "rgb(255 255 255 / 0.95)",
      padding: "56px 64px",
      maxWidth: 560,
      margin: "80px 0"
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: "0 0 20px",
      fontFamily: "var(--font-serif)",
      fontSize: "var(--text-hero)",
      fontWeight: 400,
      color: "var(--rim-text)",
      lineHeight: 1.2
    }
  }, heading), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 32px",
      fontSize: "var(--text-body)",
      color: "var(--rim-text)",
      lineHeight: "var(--lh-body)"
    }
  }, children), cta ? /*#__PURE__*/React.createElement("a", {
    href: ctaHref,
    style: {
      display: "inline-block",
      background: "var(--rim-blue)",
      color: "#fff",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-ui)",
      fontWeight: 600,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      textDecoration: "none",
      padding: "14px 28px",
      borderRadius: 32
    }
  }, cta) : null)));
}
Object.assign(__ds_scope, { HeroPanel });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/content/HeroPanel.jsx", error: String((e && e.message) || e) }); }

// components/content/ProgramCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Catalog card for the community programs listing. Whole card is the link. */
function ProgramCard({
  title,
  tags = [],
  meta = [],
  description,
  action,
  href = "#",
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("a", _extends({
    href: href,
    style: {
      display: "block",
      minWidth: 0,
      overflow: "hidden",
      borderRadius: "var(--radius-xl)",
      background: "var(--rim-surface)",
      boxShadow: "var(--card-shadow)",
      color: "var(--rim-text)",
      textDecoration: "none",
      transition: "background-color var(--transition-fast) ease",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "minmax(0,1fr) auto",
      alignItems: "center",
      gap: 20,
      padding: "21px 24px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: "7px 12px"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-serif)",
      fontSize: "var(--text-h4)",
      color: "var(--rim-text)"
    }
  }, title), tags.map(t => /*#__PURE__*/React.createElement("span", {
    key: t,
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-xxs)",
      fontWeight: 700,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      color: "var(--rim-mid)"
    }
  }, t))), description ? /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "8px 0 0",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-small)",
      color: "var(--rim-text-quote)",
      lineHeight: 1.6
    }
  }, description) : null, meta.length ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: "8px 12px",
      margin: "14px 0 0",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-label)",
      color: "var(--rim-text-muted)"
    }
  }, meta.map((m, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: m
  }, i > 0 ? /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      color: "var(--rim-rule)"
    }
  }, "\xB7") : null, /*#__PURE__*/React.createElement("span", null, m)))) : null), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-small)",
      fontWeight: 600,
      color: "var(--rim-blue)",
      whiteSpace: "nowrap"
    }
  }, action || "View →")));
}
Object.assign(__ds_scope, { ProgramCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/content/ProgramCard.jsx", error: String((e && e.message) || e) }); }

// components/content/PullQuote.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Serif pull-quote card. On program heroes it floats up over the band. */
function PullQuote({
  children,
  source,
  floating = false,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("figure", _extends({
    style: {
      background: "var(--rim-surface)",
      borderRadius: "var(--radius-2xl)",
      padding: "42px 44px 38px",
      margin: floating ? "-92px auto 56px" : "0 auto 56px",
      maxWidth: 720,
      textAlign: "center",
      position: "relative",
      zIndex: 2,
      boxShadow: "var(--card-shadow)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("blockquote", {
    style: {
      margin: "0 0 10px",
      fontFamily: "var(--font-serif)",
      fontSize: "var(--text-h4)",
      fontWeight: 400,
      lineHeight: 1.6,
      color: "var(--rim-text)"
    }
  }, children), source ? /*#__PURE__*/React.createElement("figcaption", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-small)",
      color: "var(--rim-text-muted)"
    }
  }, source) : null);
}
Object.assign(__ds_scope, { PullQuote });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/content/PullQuote.jsx", error: String((e && e.message) || e) }); }

// components/content/ScheduleRow.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** One line of the weekly schedule table: day / program / time / format. */
function ScheduleRow({
  day,
  name,
  description,
  time,
  format,
  inPerson = false,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "grid",
      gridTemplateColumns: "130px 1fr 130px 180px",
      alignItems: "center",
      padding: "18px 0",
      borderBottom: "1px solid var(--rim-rule)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-xxs)",
      fontWeight: 700,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      color: "var(--rim-text-muted)"
    }
  }, day), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 3
    }
  }, /*#__PURE__*/React.createElement("strong", {
    style: {
      fontFamily: "var(--font-serif)",
      fontSize: "var(--text-h4)",
      fontWeight: 400,
      color: "var(--rim-text)"
    }
  }, name), description ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-xs)",
      color: "var(--rim-text-muted)"
    }
  }, description) : null), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-small)",
      color: "var(--rim-text)",
      fontVariantNumeric: "tabular-nums"
    }
  }, time), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-xs)",
      fontWeight: inPerson ? 600 : 500,
      color: inPerson ? "var(--rim-mid)" : "var(--rim-text-muted)"
    }
  }, format));
}
Object.assign(__ds_scope, { ScheduleRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/content/ScheduleRow.jsx", error: String((e && e.message) || e) }); }

// components/content/Testimonial.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Community voice — italic body on the warm ground with a top rule. */
function Testimonial({
  children,
  attribution = "— Community member",
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("blockquote", _extends({
    style: {
      margin: 0,
      padding: "36px 32px",
      background: "var(--rim-bg)",
      borderTop: "3px solid var(--rim-rule)",
      display: "flex",
      flexDirection: "column",
      gap: 20,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      flex: 1,
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-body)",
      lineHeight: "var(--lh-body)",
      fontStyle: "italic",
      color: "var(--rim-text)"
    }
  }, children), /*#__PURE__*/React.createElement("footer", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-xs)",
      fontWeight: 600,
      fontStyle: "normal",
      color: "var(--rim-text-muted)"
    }
  }, attribution));
}
Object.assign(__ds_scope, { Testimonial });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/content/Testimonial.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const TONES = {
  neutral: {
    background: "var(--rim-bg-accent)",
    color: "var(--rim-text-muted)"
  },
  blue: {
    background: "var(--rim-bg-accent)",
    color: "var(--rim-blue)"
  },
  success: {
    background: "var(--color-success-bg)",
    color: "var(--color-success)"
  },
  warning: {
    background: "var(--color-warning-bg)",
    color: "var(--color-warning)"
  },
  alert: {
    background: "var(--color-alert-bg)",
    color: "var(--color-alert)"
  },
  error: {
    background: "var(--color-error-bg)",
    color: "var(--color-error)"
  }
};

/** Small status pill — registration state, live indicators, dana chips. */
function Badge({
  children,
  tone = "neutral",
  uppercase = false,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: "inline-flex",
      alignItems: "center",
      padding: "4px 9px",
      borderRadius: "var(--radius-pill)",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-xxs)",
      fontWeight: 600,
      letterSpacing: uppercase ? "0.05em" : undefined,
      textTransform: uppercase ? "uppercase" : "none",
      ...TONES[tone],
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const SIZES = {
  sm: {
    minHeight: 36,
    padding: "0 18px",
    fontSize: "var(--text-small)"
  },
  md: {
    minHeight: 44,
    padding: "0 22px",
    fontSize: "var(--text-ui)"
  },
  lg: {
    minHeight: 50,
    padding: "0 30px",
    fontSize: "16px"
  }
};

/** RIM pill button. Primary = filled blue; secondary = white with blue rule;
 *  ghost = bare; donate = the one warm red in the system. */
function Button({
  children,
  variant = "primary",
  size = "md",
  href,
  disabled = false,
  fullWidth = false,
  onClick,
  type = "button",
  style,
  ...rest
}) {
  const base = {
    boxSizing: "border-box",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: fullWidth ? "100%" : undefined,
    borderRadius: "var(--radius-pill)",
    fontFamily: "var(--font-sans)",
    fontWeight: 600,
    lineHeight: 1.2,
    textDecoration: "none",
    whiteSpace: "nowrap",
    cursor: disabled ? "default" : "pointer",
    transition: "background var(--transition-fast), opacity var(--transition-fast), color var(--transition-fast)",
    opacity: disabled ? 0.45 : 1,
    ...SIZES[size]
  };
  const variants = {
    primary: {
      background: "var(--rim-blue)",
      color: "#fff",
      border: "1px solid var(--rim-blue)"
    },
    secondary: {
      background: "var(--rim-surface)",
      color: "var(--rim-blue)",
      border: "1px solid var(--rim-blue)"
    },
    ghost: {
      background: "transparent",
      color: "var(--rim-blue)",
      border: "1px solid transparent"
    },
    donate: {
      background: "var(--rim-donate)",
      color: "#fff",
      border: "1px solid var(--rim-donate)",
      letterSpacing: "0.08em",
      fontWeight: 700,
      fontSize: "var(--text-label)",
      minHeight: 36,
      padding: "0 18px"
    }
  };
  const merged = {
    ...base,
    ...variants[variant],
    ...style
  };
  const Tag = href && !disabled ? "a" : "button";
  return /*#__PURE__*/React.createElement(Tag, _extends({
    href: href,
    type: Tag === "button" ? type : undefined,
    disabled: Tag === "button" ? disabled : undefined,
    onClick: disabled ? undefined : onClick,
    style: merged
  }, rest), children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/content/ListRow.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Universal list row — community programs, dashboard Zoom links, My Library,
 *  course lessons. White card, name + schedule on the left, one action right. */
function ListRow({
  name,
  badge,
  schedule,
  note,
  announcement,
  actionLabel,
  actionHref,
  actionDisabled = false,
  onAction,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 24,
      background: "var(--rim-surface)",
      borderRadius: "var(--radius-sm)",
      padding: "20px 24px",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 2px",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-body)",
      fontWeight: 600,
      color: "var(--rim-text)",
      lineHeight: 1.3
    }
  }, name, badge ? /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 4,
      fontSize: "var(--text-small)",
      fontWeight: 400,
      color: "var(--rim-text-muted)"
    }
  }, badge) : null), schedule ? /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-small)",
      color: "var(--rim-mid)",
      lineHeight: 1.5
    }
  }, schedule) : null, note ? /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "6px 0 0",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-small)",
      fontStyle: "italic",
      color: "var(--rim-mid)"
    }
  }, note) : null, announcement ? /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "8px 0 0",
      padding: "6px 12px",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-small)",
      color: "var(--color-warning)",
      background: "var(--color-warning-bg)",
      lineHeight: 1.5
    }
  }, announcement) : null), actionLabel ? /*#__PURE__*/React.createElement("div", {
    style: {
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Button, {
    size: "sm",
    href: actionHref,
    disabled: actionDisabled,
    onClick: onAction,
    style: actionDisabled ? {
      background: "var(--rim-mid)",
      borderColor: "var(--rim-mid)"
    } : undefined
  }, actionLabel)) : null);
}
Object.assign(__ds_scope, { ListRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/content/ListRow.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** White surface on the warm Pampas ground. Cards are for a distinct thing a
 *  person can understand or act on — not for wrapping every paragraph. */
function Card({
  children,
  padding = 32,
  radius = "var(--radius-lg)",
  elevated = true,
  bordered = false,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      background: "var(--rim-surface)",
      borderRadius: radius,
      padding,
      border: bordered ? "1px solid var(--rim-rule)" : "none",
      boxShadow: elevated ? "var(--card-shadow)" : "none",
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Eyebrow.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Quiet uppercase orientation label above a heading. */
function Eyebrow({
  children,
  tone = "muted",
  style,
  ...rest
}) {
  const colors = {
    muted: "var(--rim-text-muted)",
    blue: "var(--rim-mid)",
    onDark: "rgba(255,255,255,0.72)"
  };
  return /*#__PURE__*/React.createElement("p", _extends({
    style: {
      margin: "0 0 10px",
      color: colors[tone],
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-xxs)",
      fontWeight: 700,
      letterSpacing: "var(--tracking-eyebrow)",
      lineHeight: 1.4,
      textTransform: "uppercase",
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Eyebrow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Eyebrow.jsx", error: String((e && e.message) || e) }); }

// components/core/Panel.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Receding Pampas-accent panel — supporting context that should be available
 *  without competing with the main action. */
function Panel({
  children,
  padding = 32,
  radius = "var(--radius-lg)",
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      background: "var(--rim-bg-accent)",
      borderRadius: radius,
      padding,
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Panel });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Panel.jsx", error: String((e && e.message) || e) }); }

// components/core/StateMessage.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const TONES = {
  success: {
    background: "var(--color-success-bg)",
    borderColor: "var(--color-success)"
  },
  warning: {
    background: "var(--color-warning-bg)",
    borderColor: "var(--color-warning)"
  },
  error: {
    background: "var(--color-error-bg)",
    borderColor: "var(--color-error)"
  },
  alert: {
    background: "var(--color-alert-bg)",
    borderColor: "var(--color-alert)"
  }
};

/** Inline feedback message with a left accent rule. */
function StateMessage({
  children,
  tone = "success",
  label,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("p", _extends({
    style: {
      margin: 0,
      padding: "16px 18px",
      borderLeft: "3px solid",
      borderRadius: "var(--radius-xs)",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-small)",
      color: "var(--rim-text)",
      ...TONES[tone],
      ...style
    }
  }, rest), label ? /*#__PURE__*/React.createElement("strong", null, label, " ") : null, children);
}
Object.assign(__ds_scope, { StateMessage });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/StateMessage.jsx", error: String((e && e.message) || e) }); }

// components/core/TextField.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Calm labelled form field. Labels are plain, fields are white. */
function TextField({
  label,
  help,
  id,
  type = "text",
  placeholder,
  value,
  defaultValue,
  onChange,
  required,
  onDark = false,
  style,
  ...rest
}) {
  const fieldId = id || `f-${(label || placeholder || "field").replace(/\W+/g, "-").toLowerCase()}`;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      ...style
    }
  }, label ? /*#__PURE__*/React.createElement("label", {
    htmlFor: fieldId,
    style: {
      marginBottom: 8,
      color: onDark ? "#fff" : "var(--rim-text)",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-xs)",
      fontWeight: 700
    }
  }, label) : null, /*#__PURE__*/React.createElement("input", _extends({
    id: fieldId,
    type: type,
    placeholder: placeholder,
    value: value,
    defaultValue: defaultValue,
    onChange: onChange,
    required: required,
    style: {
      width: "100%",
      minHeight: 44,
      padding: onDark ? "11px 14px" : "10px 12px",
      border: onDark ? "1px solid rgba(255,255,255,0.35)" : "1px solid var(--rim-rule)",
      borderRadius: "var(--radius-sm)",
      background: onDark ? "rgba(255,255,255,0.12)" : "var(--rim-surface)",
      color: onDark ? "#fff" : "var(--rim-text)",
      fontFamily: "var(--font-sans)",
      fontSize: 16,
      outline: "none"
    }
  }, rest)), help ? /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "8px 0 0",
      color: "var(--rim-text-muted)",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-label)"
    }
  }, help) : null);
}
Object.assign(__ds_scope, { TextField });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/TextField.jsx", error: String((e && e.message) || e) }); }

// components/navigation/AccountSidebar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Quiet left rail for /account/* — the authoritative member navigation. */
function AccountSidebar({
  sections = [],
  activeHref,
  collapsed = false,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("nav", _extends({
    "aria-label": "Account navigation",
    style: {
      width: collapsed ? "var(--sidebar-width-collapsed)" : "var(--sidebar-width)",
      padding: "22px 12px 48px",
      borderRight: "1px solid var(--rim-rule)",
      background: "var(--rim-surface)",
      flexShrink: 0,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 4
    }
  }, sections.map((section, si) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: section.label || si
  }, si > 0 ? /*#__PURE__*/React.createElement("div", {
    role: "separator",
    style: {
      height: 1,
      margin: "14px 8px 10px",
      background: "var(--rim-rule)"
    }
  }) : null, section.label && !collapsed ? /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 6px 12px",
      color: "var(--rim-text-muted)",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-xxs)",
      fontWeight: 700,
      letterSpacing: "0.1em",
      textTransform: "uppercase"
    }
  }, section.label) : null, section.links.map(l => {
    const active = l.href === activeHref;
    return /*#__PURE__*/React.createElement("a", {
      key: l.href,
      href: l.href,
      style: {
        minHeight: 44,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: collapsed ? "10px 0" : "10px 12px",
        justifyContent: collapsed ? "center" : "flex-start",
        borderRadius: "var(--radius-md)",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-ui)",
        fontWeight: active ? 600 : 400,
        color: active ? "var(--rim-blue)" : "var(--rim-text)",
        background: active ? "var(--rim-bg)" : "transparent",
        textDecoration: "none"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        flexShrink: 0
      }
    }, l.icon), !collapsed ? /*#__PURE__*/React.createElement("span", null, l.label) : null);
  })))));
}
Object.assign(__ds_scope, { AccountSidebar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/AccountSidebar.jsx", error: String((e && e.message) || e) }); }

// components/navigation/MemberBar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Quiet identity header for signed-in member, admin, and tool surfaces. */
function MemberBar({
  logoSrc,
  name = "Member",
  onSignOut,
  style,
  ...rest
}) {
  const first = name.split(" ")[0];
  return /*#__PURE__*/React.createElement("header", _extends({
    style: {
      position: "sticky",
      top: 0,
      zIndex: 100,
      height: "var(--member-bar-height)",
      padding: "0 32px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottom: "1px solid var(--rim-rule)",
      background: "var(--rim-bg-bright)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("a", {
    href: "/account/dashboard",
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 10,
      color: "var(--rim-text)",
      fontFamily: "var(--font-serif)",
      fontSize: "var(--text-small)",
      textDecoration: "none"
    }
  }, logoSrc ? /*#__PURE__*/React.createElement("img", {
    src: logoSrc,
    alt: "",
    height: 36,
    style: {
      display: "block",
      width: "auto"
    }
  }) : null, /*#__PURE__*/React.createElement("span", null, "Rooted In Mindfulness")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "/account/dashboard-my-profile",
    style: {
      minHeight: 44,
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      color: "var(--rim-text)",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-xs)",
      fontWeight: 600,
      textDecoration: "none"
    }
  }, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      width: 30,
      height: 30,
      borderRadius: "50%",
      background: "var(--rim-bg-accent)",
      color: "var(--rim-blue)",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: 700
    }
  }, first.charAt(0).toUpperCase()), /*#__PURE__*/React.createElement("span", null, first)), /*#__PURE__*/React.createElement("button", {
    onClick: onSignOut,
    style: {
      minHeight: 44,
      padding: "8px 0",
      border: "none",
      background: "transparent",
      color: "var(--rim-text-muted)",
      cursor: "pointer",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-xs)"
    }
  }, "Sign out")));
}
Object.assign(__ds_scope, { MemberBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/MemberBar.jsx", error: String((e && e.message) || e) }); }

// components/navigation/SiteFooter.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Blue site footer — newsletter row, logo, address, contact, copyright. */
function SiteFooter({
  logoSrc,
  memberArea = false,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("footer", _extends({
    style: {
      background: "var(--rim-blue)",
      padding: "100px 24px 40px",
      textAlign: "center",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 680,
      margin: "0 auto"
    }
  }, !memberArea ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: "0 0 8px",
      color: "#fff",
      fontFamily: "var(--font-serif)",
      fontSize: "var(--text-h3)",
      fontWeight: 400
    }
  }, "Stay Connected"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 20px",
      color: "rgba(255,255,255,0.75)",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-small)"
    }
  }, "Sign up for programs, events, and community news."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement("input", {
    placeholder: "First name",
    style: inputStyle
  }), /*#__PURE__*/React.createElement("input", {
    placeholder: "Email address",
    style: inputStyle
  }), /*#__PURE__*/React.createElement("button", {
    style: {
      padding: "11px 22px",
      background: "var(--rim-surface)",
      color: "var(--rim-blue)",
      border: "none",
      borderRadius: "var(--radius-sm)",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-small)",
      fontWeight: 600,
      cursor: "pointer",
      whiteSpace: "nowrap"
    }
  }, "Subscribe"))), /*#__PURE__*/React.createElement("hr", {
    style: {
      border: "none",
      borderTop: "1px solid rgba(255,255,255,0.18)",
      margin: "36px 0"
    }
  })) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 8
    }
  }, logoSrc ? /*#__PURE__*/React.createElement("img", {
    src: logoSrc,
    alt: "Rooted In Mindfulness",
    width: 65,
    style: {
      marginBottom: 4
    }
  }) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      color: "#fff",
      fontFamily: "var(--font-serif)",
      fontSize: 16
    }
  }, "Rooted In Mindfulness"), /*#__PURE__*/React.createElement("div", {
    style: {
      color: "rgba(255,255,255,0.75)",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-ui)"
    }
  }, "4040 N. Calhoun Rd., Brookfield, WI 53005"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      flexWrap: "wrap",
      justifyContent: "center",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-ui)"
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "tel:4148828932",
    style: {
      color: "rgba(255,255,255,0.75)",
      textDecoration: "none"
    }
  }, "(414) 882-8932"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "rgba(255,255,255,0.4)"
    }
  }, "\xB7"), /*#__PURE__*/React.createElement("a", {
    href: "mailto:support@rootedinmindfulness.org",
    style: {
      color: "rgba(255,255,255,0.75)",
      textDecoration: "none"
    }
  }, "support@rootedinmindfulness.org")))), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 680,
      margin: "36px auto 0",
      paddingTop: 20,
      borderTop: "1px solid rgba(255,255,255,0.18)",
      display: "flex",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: 6,
      color: "rgba(255,255,255,0.5)",
      fontSize: "var(--text-label)"
    }
  }, /*#__PURE__*/React.createElement("span", null, "\xA92020 Rooted In Mindfulness | 501(c)(3) Non-Profit | ", /*#__PURE__*/React.createElement("a", {
    href: "/donate",
    style: {
      color: "rgba(255,255,255,0.5)"
    }
  }, "Donate")), /*#__PURE__*/React.createElement("span", null, "Powered by Kind People :) ", /*#__PURE__*/React.createElement("a", {
    href: "/volunteerism/volunteer",
    style: {
      color: "rgba(255,255,255,0.5)"
    }
  }, "Volunteer"))));
}
const inputStyle = {
  flex: 1,
  maxWidth: 210,
  padding: "11px 14px",
  border: "1px solid rgba(255,255,255,0.35)",
  borderRadius: "var(--radius-sm)",
  background: "rgba(255,255,255,0.12)",
  color: "#fff",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-small)",
  outline: "none"
};
Object.assign(__ds_scope, { SiteFooter });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/SiteFooter.jsx", error: String((e && e.message) || e) }); }

// components/navigation/SiteNav.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState
} = React;
/** Public site header — sticky white bar, logo + wordmark, hover dropdowns,
 *  red DONATE pill, hamburger below 768px. */
function SiteNav({
  logoSrc,
  items = [],
  donateHref = "/donate",
  activeLabel,
  style,
  ...rest
}) {
  const [open, setOpen] = useState(null);
  const linkBase = {
    fontFamily: "var(--font-sans)",
    fontSize: 16,
    fontWeight: 500,
    color: "var(--rim-text)",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "8px 12px",
    borderRadius: "var(--radius-xs)",
    whiteSpace: "nowrap",
    textDecoration: "none",
    transition: "color var(--transition-fast), background var(--transition-fast)"
  };
  return /*#__PURE__*/React.createElement("header", _extends({
    style: {
      position: "sticky",
      top: 0,
      zIndex: 100,
      background: "#fff",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      maxWidth: 1200,
      margin: "0 auto",
      padding: "0 24px",
      height: "var(--nav-height)",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "/",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      textDecoration: "none",
      flexShrink: 0
    }
  }, logoSrc ? /*#__PURE__*/React.createElement("img", {
    src: logoSrc,
    alt: "Rooted In Mindfulness",
    height: 45
  }) : null, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-serif)",
      fontSize: "var(--text-h4)",
      fontWeight: 400,
      color: "var(--rim-text)",
      lineHeight: 1.2
    }
  }, "Rooted In Mindfulness")), /*#__PURE__*/React.createElement("nav", {
    "aria-label": "Main navigation",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 2,
      marginLeft: "auto"
    }
  }, items.map(item => item.children ? /*#__PURE__*/React.createElement("div", {
    key: item.label,
    style: {
      position: "relative"
    },
    onMouseEnter: () => setOpen(item.label),
    onMouseLeave: () => setOpen(null)
  }, /*#__PURE__*/React.createElement("button", {
    style: {
      ...linkBase,
      display: "flex",
      alignItems: "center",
      gap: 5,
      background: open === item.label ? "var(--rim-bg)" : "none",
      color: open === item.label ? "var(--rim-blue)" : "var(--rim-text)"
    }
  }, item.label, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      fontSize: 10,
      color: "var(--rim-text-muted)"
    }
  }, "\u25BE")), open === item.label ? /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: "100%",
      right: 0,
      minWidth: 230,
      paddingTop: 6,
      zIndex: 200
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#fff",
      borderRadius: "var(--radius-sm)",
      padding: 8,
      boxShadow: "var(--card-shadow)"
    }
  }, item.children.map((c, i) => /*#__PURE__*/React.createElement("a", {
    key: c.label,
    href: c.href,
    style: {
      display: "block",
      padding: "10px 12px",
      textDecoration: "none",
      color: "var(--rim-text)",
      borderBottom: i < item.children.length - 1 ? "1px solid var(--rim-bg-accent)" : "none"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      fontSize: "var(--text-ui)"
    }
  }, c.label), c.description ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-label)",
      color: "var(--rim-text-muted)",
      marginTop: 2
    }
  }, c.description) : null)))) : null) : /*#__PURE__*/React.createElement("a", {
    key: item.label,
    href: item.href,
    style: {
      ...linkBase,
      color: activeLabel === item.label ? "var(--rim-blue)" : "var(--rim-text)",
      fontWeight: activeLabel === item.label ? 600 : 500
    }
  }, item.label))), /*#__PURE__*/React.createElement("a", {
    href: donateHref,
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-label)",
      fontWeight: 700,
      letterSpacing: "0.08em",
      color: "#fff",
      background: "var(--rim-donate)",
      padding: "8px 18px",
      borderRadius: "var(--radius-pill)",
      textDecoration: "none",
      marginLeft: 8,
      flexShrink: 0
    }
  }, "DONATE")));
}
Object.assign(__ds_scope, { SiteNav });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/SiteNav.jsx", error: String((e && e.message) || e) }); }

// ui_kits/member-area/Dashboard.jsx
try { (() => {
const {
  Badge,
  Button,
  Card
} = window.RootedInMindfulnessDesignSystem_980dba;
function SectionLabel({
  children
}) {
  return /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 12px",
      color: "var(--rim-text-muted)",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-xxs)",
      fontWeight: 700,
      letterSpacing: "0.1em",
      textTransform: "uppercase"
    }
  }, children);
}
function TodayRow({
  time,
  title,
  meta,
  state,
  next,
  onJoin
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16,
      minHeight: next ? 92 : 74,
      padding: "16px 22px",
      borderTop: "1px solid var(--rim-rule)",
      background: state === "live" ? "var(--rim-bg-bright)" : "var(--rim-surface)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      minWidth: 0,
      flexDirection: "column",
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--rim-text-muted)",
      fontSize: "var(--text-xs)"
    }
  }, time), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-serif)",
      fontSize: next ? "var(--text-h4)" : "var(--text-small)",
      color: "var(--rim-text)"
    }
  }, title), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: "4px 10px",
      color: "var(--rim-text-muted)",
      fontSize: "var(--text-label)",
      lineHeight: 1.35
    }
  }, meta)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      flexShrink: 0
    }
  }, state === "live" ? /*#__PURE__*/React.createElement(Badge, {
    tone: "success",
    uppercase: true
  }, "Live now") : null, state === "setup" ? /*#__PURE__*/React.createElement(Badge, {
    tone: "blue",
    uppercase: true
  }, "Setup") : null, onJoin ? /*#__PURE__*/React.createElement(Button, {
    size: "md",
    onClick: onJoin
  }, "Join") : /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--rim-text-muted)",
      fontSize: "var(--text-xs)"
    }
  }, "Opens 15 min before")));
}
function UpcomingItem({
  month,
  day,
  title,
  time,
  chip
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      minHeight: 76,
      borderBottom: "1px solid var(--rim-rule)",
      background: "var(--rim-surface)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 72,
      alignSelf: "stretch",
      background: "var(--rim-bg-bright)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      color: "var(--rim-text-muted)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-xxs)",
      fontWeight: 700,
      letterSpacing: "0.08em",
      textTransform: "uppercase"
    }
  }, month), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-h4)",
      fontFamily: "var(--font-serif)"
    }
  }, day)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      padding: 16,
      display: "flex",
      flexDirection: "column",
      gap: 3
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-serif)",
      fontSize: "var(--text-small)",
      color: "var(--rim-text)"
    }
  }, title), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--rim-text-muted)",
      fontSize: "var(--text-label)"
    }
  }, time)), /*#__PURE__*/React.createElement("div", {
    style: {
      paddingRight: 18
    }
  }, chip));
}
function Dashboard({
  name,
  onJoin
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 820
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      margin: "0 0 40px"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 8px",
      color: "var(--rim-text-muted)",
      fontSize: "var(--text-xs)",
      fontWeight: 600
    }
  }, "Tuesday, August 4"), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: "0 0 10px",
      fontSize: "var(--text-h1)",
      lineHeight: "var(--lh-heading)"
    }
  }, "Good morning, ", name.split(" ")[0], "."), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: "var(--rim-text-muted)",
      fontSize: "var(--text-small)"
    }
  }, "One session today, and two more this week.")), /*#__PURE__*/React.createElement("div", {
    style: {
      margin: "0 0 44px"
    }
  }, /*#__PURE__*/React.createElement(SectionLabel, null, "Today"), /*#__PURE__*/React.createElement("div", {
    style: {
      overflow: "hidden",
      border: "1px solid var(--rim-rule)",
      borderRadius: "var(--radius-xl)",
      background: "var(--rim-surface)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "12px 22px",
      background: "var(--rim-bg-bright)",
      fontSize: "var(--text-xs)",
      fontWeight: 600,
      color: "var(--rim-text-muted)"
    }
  }, "Tuesday, August 4"), /*#__PURE__*/React.createElement(TodayRow, {
    next: true,
    time: "9:30 AM",
    title: "The Art of Meditation",
    meta: "In person & online \xB7 Jesse Foy",
    state: "live",
    onJoin: onJoin
  }), /*#__PURE__*/React.createElement(TodayRow, {
    time: "7:30 PM",
    title: "Silent Meditation",
    meta: "Online \xB7 30 minutes"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      margin: "0 0 44px"
    }
  }, /*#__PURE__*/React.createElement(SectionLabel, null, "Coming up"), /*#__PURE__*/React.createElement("div", {
    style: {
      overflow: "hidden",
      borderRadius: "var(--radius-xl)",
      background: "var(--rim-surface)"
    }
  }, /*#__PURE__*/React.createElement(UpcomingItem, {
    month: "Aug",
    day: "6",
    title: "Qigong at RIM",
    time: "10:00 AM \xB7 Online",
    chip: /*#__PURE__*/React.createElement(Badge, {
      tone: "success"
    }, "Registered")
  }), /*#__PURE__*/React.createElement(UpcomingItem, {
    month: "Aug",
    day: "7",
    title: "Essential Dharma Study",
    time: "9:30 AM \xB7 Online",
    chip: /*#__PURE__*/React.createElement(Badge, {
      tone: "success"
    }, "Registered")
  }), /*#__PURE__*/React.createElement(UpcomingItem, {
    month: "Aug",
    day: "13",
    title: "Foundations of Mindfulness \u2014 Week 3",
    time: "6:30 PM \xB7 In person",
    chip: /*#__PURE__*/React.createElement(Badge, {
      tone: "neutral"
    }, "Dana")
  }))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SectionLabel, null, "Your teams"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(2,minmax(0,1fr))",
      gap: 10
    }
  }, [["Saturday Host Team", "Hosting"], ["Welcome Team", "Hospitality"]].map(([n, t]) => /*#__PURE__*/React.createElement("div", {
    key: n,
    style: {
      minHeight: 86,
      padding: 18,
      border: "1px solid var(--rim-rule)",
      borderRadius: "var(--radius-lg)",
      background: "var(--rim-surface)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: "var(--rim-text)",
      fontSize: "var(--text-small)",
      fontFamily: "var(--font-serif)"
    }
  }, n), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      color: "var(--rim-text-muted)",
      fontSize: "var(--text-xxs)",
      letterSpacing: "0.08em",
      textTransform: "uppercase"
    }
  }, t))))));
}
Object.assign(window, {
  Dashboard,
  SectionLabel
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/member-area/Dashboard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/member-area/Profile.jsx
try { (() => {
const {
  TextField,
  Button,
  Card,
  Panel,
  StateMessage
} = window.RootedInMindfulnessDesignSystem_980dba;
function Profile() {
  const [saved, setSaved] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 820
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: "0 0 10px",
      fontSize: "var(--text-h1)"
    }
  }, "My Profile"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 36px",
      color: "var(--rim-text-muted)",
      fontSize: "var(--text-small)"
    }
  }, "How we reach you, and how you appear to the community."), saved ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement(StateMessage, {
    tone: "success",
    label: "Saved."
  }, "Your changes have been saved.")) : null, /*#__PURE__*/React.createElement(Card, {
    padding: 32,
    bordered: true,
    elevated: false,
    style: {
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 20
    }
  }, /*#__PURE__*/React.createElement(TextField, {
    label: "First name",
    defaultValue: "Marguerite"
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "Last name",
    defaultValue: "Chen"
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "Email address",
    type: "email",
    defaultValue: "marguerite@example.org",
    help: "This is also your sign-in."
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "Phone",
    type: "tel",
    defaultValue: "(414) 555-0148"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 24,
      display: "flex",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Button, {
    onClick: () => setSaved(true)
  }, "Save changes"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    onClick: () => setSaved(false)
  }, "Cancel"))), /*#__PURE__*/React.createElement(Panel, {
    padding: 28
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: "0 0 8px",
      fontFamily: "var(--font-serif)",
      fontSize: "var(--text-h4)",
      fontWeight: 500
    }
  }, "Community care agreements"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 16px",
      fontSize: 16,
      lineHeight: 1.6
    }
  }, "You agreed to these when you joined. They're short, and worth rereading now and then."), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    href: "#"
  }, "Read the agreements")));
}
Object.assign(window, {
  Profile
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/member-area/Profile.jsx", error: String((e && e.message) || e) }); }

// ui_kits/public-website/Home.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  HeroPanel,
  ScheduleRow,
  Testimonial,
  Card,
  Eyebrow
} = window.RootedInMindfulnessDesignSystem_980dba;
const SCHEDULE = [{
  day: "Monday",
  name: "Awakening the Heart",
  description: "Lovingkindness practice",
  time: "9:30 AM",
  format: "Online"
}, {
  day: "Tuesday",
  name: "The Art of Meditation",
  description: "Guided practice and teaching",
  time: "9:30 AM",
  format: "In person & online",
  inPerson: true
}, {
  day: "Wednesday",
  name: "Qigong at RIM",
  description: "Gentle movement and breath",
  time: "10:00 AM",
  format: "Online"
}, {
  day: "Thursday",
  name: "Essential Dharma Study",
  description: "Teaching and dialogue",
  time: "9:30 AM",
  format: "Online"
}, {
  day: "Saturday",
  name: "Meditation and Dharma Talk",
  description: "Guided sit and teaching",
  time: "9:30 AM",
  format: "In person & online",
  inPerson: true
}, {
  day: "Sunday",
  name: "Our Hearts Were Made for This",
  description: "Lovingkindness practice",
  time: "9:00 AM",
  format: "Online"
}, {
  day: "Every day",
  name: "Silent Meditation",
  description: "Morning · Evening",
  time: "6:30 AM · 7:30 PM",
  format: "Online"
}];
function Section({
  tone = "white",
  narrow = false,
  children
}) {
  const bg = {
    white: "var(--rim-surface)",
    grey: "var(--rim-bg)",
    teal: "var(--rim-blue)"
  }[tone];
  return /*#__PURE__*/React.createElement("section", {
    style: {
      background: bg,
      paddingTop: 96,
      paddingBottom: 96,
      color: tone === "teal" ? "rgba(255,255,255,0.92)" : "var(--rim-text)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%",
      maxWidth: narrow ? 700 : 1140,
      margin: "0 auto",
      padding: "0 40px",
      boxSizing: "border-box"
    }
  }, children));
}
function ArrowLink({
  children,
  onClick
}) {
  return /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onClick && onClick();
    },
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-body)",
      color: "var(--rim-mid)",
      fontWeight: 500,
      textDecoration: "none"
    }
  }, children);
}
function Home({
  go
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(HeroPanel, {
    heading: "A place to practice, together.",
    cta: "Come to a Drop-In \u2192",
    ctaHref: "#",
    backgroundImage: "../../assets/images/Bodhi_Leaves-poster.jpg"
  }, "We're a meditation and dharma community in Brookfield, Wisconsin. We sit together, we study the teachings, and we try to bring what we find into the rest of our lives. Buddhist-rooted, open to everyone, and offered in the spirit of generosity."), /*#__PURE__*/React.createElement(Section, {
    narrow: true
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 24px",
      fontSize: "var(--text-body)",
      lineHeight: "var(--lh-body)"
    }
  }, "People come to RIM for different reasons. Some want to learn to meditate. Some have been practicing on their own and are ready for a teacher and a community. Some are going through something hard and need a place where they don't have to explain themselves."), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontFamily: "var(--font-serif)",
      fontSize: "var(--text-h3)",
      color: "var(--rim-mid)",
      lineHeight: 1.5
    }
  }, "Whatever brought you here, you're welcome. No experience needed. No fees. Come as you are, and see what you find.")), /*#__PURE__*/React.createElement(Section, {
    tone: "grey"
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: "0 0 36px"
    }
  }, "This Week at RIM"), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: "1px solid var(--rim-rule)",
      marginBottom: 20
    }
  }, SCHEDULE.map(r => /*#__PURE__*/React.createElement(ScheduleRow, _extends({
    key: r.day
  }, r)))), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: "var(--text-small)",
      color: "var(--rim-text-muted)",
      lineHeight: "var(--lh-body)",
      margin: "0 0 28px"
    }
  }, "New to meditation? ", /*#__PURE__*/React.createElement("strong", null, "Tuesdays"), " and ", /*#__PURE__*/React.createElement("strong", null, "Saturdays"), " are great places to start \u2014 both are offered in person at the center and online."), /*#__PURE__*/React.createElement(ArrowLink, {
    onClick: () => go("programs")
  }, "See All Programs \u2192")), /*#__PURE__*/React.createElement(Section, null, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: "var(--text-h3)",
      margin: "0 0 48px",
      textAlign: "center"
    }
  }, "What people find here"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3,1fr)",
      gap: 24
    }
  }, /*#__PURE__*/React.createElement(Testimonial, null, "\"RIM has been a safe place for me to bring my anxiety and brokenness \u2014 to feel supported and okay. You allow me to show up with all my baggage and leave it here. Feeling lighter.\""), /*#__PURE__*/React.createElement(Testimonial, null, "\"I have not found anyone else who melds the philosophy of mindfulness with the practice itself. There are those who teach, those who do, and only one I have found who does both.\""), /*#__PURE__*/React.createElement(Testimonial, null, "\"After the first drop-in session, I knew I was home. The warm, welcoming, engaging community were where I wanted to grow my practice.\""))), /*#__PURE__*/React.createElement(Section, {
    tone: "grey"
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      maxWidth: 620,
      margin: "0 0 48px"
    }
  }, "Wherever you are, there's a place to practice"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3,1fr)",
      borderTop: "1px solid var(--rim-rule)",
      borderBottom: "1px solid var(--rim-rule)"
    }
  }, [["Drop-In Sessions", "The open door. Guided meditation, short teaching, time for questions. Come when you can, as often as you like. No commitment, no experience needed."], ["Courses", "Multi-week programs for those ready to go deeper. Foundations of Mindfulness is where most people begin. Each course builds a real practice — not just ideas, but skills you can use."], ["Study & Community Groups", "Dharma study, book clubs, qigong, nature meditation, community service. For the practitioner who wants to keep going — and wants company on the way."]].map(([name, body], i) => /*#__PURE__*/React.createElement("div", {
    key: name,
    style: {
      padding: "36px 32px 36px 0",
      paddingLeft: i > 0 ? 32 : 0,
      borderRight: i < 2 ? "1px solid var(--rim-rule)" : "none"
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontFamily: "var(--font-serif)",
      fontSize: "var(--text-h4)",
      fontWeight: 400,
      color: "var(--rim-blue)",
      margin: "0 0 12px"
    }
  }, name), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: "var(--text-body)",
      lineHeight: "var(--lh-body)"
    }
  }, body)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 32,
      marginTop: 32
    }
  }, /*#__PURE__*/React.createElement(ArrowLink, {
    onClick: () => go("programs")
  }, "See All Programs \u2192"), /*#__PURE__*/React.createElement(ArrowLink, {
    onClick: () => go("programs")
  }, "Upcoming Courses \u2192"))), /*#__PURE__*/React.createElement(Section, {
    tone: "teal"
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      textAlign: "center",
      color: "#fff",
      margin: "0 0 56px"
    }
  }, "Why we practice together"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3,1fr)",
      gap: 48
    }
  }, [["For yourself.", "This is where practice begins — a steadier mind, a more open heart, a clearer way of being in your own life."], ["For those you love.", "What changes in you moves outward. The way you listen, the way you respond, the patience you bring home."], ["For our shared world.", "We don't practice only for ourselves. We practice because the world needs people who are present, compassionate, and willing to show up."]].map(([t, b]) => /*#__PURE__*/React.createElement("div", {
    key: t
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontFamily: "var(--font-serif)",
      fontSize: "var(--text-h3)",
      fontWeight: 400,
      color: "#fff",
      margin: "0 0 16px"
    }
  }, t), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: "rgba(255,255,255,0.88)"
    }
  }, b))))), /*#__PURE__*/React.createElement(Section, {
    narrow: true
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: "0 0 20px"
    }
  }, "A generosity-based community"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 18px"
    }
  }, "Everything at RIM is offered in the spirit of ", /*#__PURE__*/React.createElement("em", null, "dana"), " \u2014 a P\u0101li word meaning generosity of heart, mind, and action."), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 18px"
    }
  }, "In the Buddhist tradition, teachers offer their teachings freely, and the community supports the teachers and the center to the level of their ability. RIM follows this model. We don't charge fees or tuition."), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 18px"
    }
  }, /*#__PURE__*/React.createElement("em", null, "RIM is a 501(c)(3) nonprofit organization.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 32,
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement(ArrowLink, null, "Give a Donation \u2192"), /*#__PURE__*/React.createElement(ArrowLink, null, "Volunteer \u2192"))), /*#__PURE__*/React.createElement(Section, {
    tone: "grey",
    narrow: true
  }, /*#__PURE__*/React.createElement("blockquote", {
    style: {
      margin: 0,
      padding: "0 0 0 28px",
      borderLeft: "3px solid var(--rim-rule)"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "var(--font-serif)",
      fontSize: "var(--text-h3)",
      fontStyle: "italic",
      lineHeight: 1.45,
      margin: "0 0 16px"
    }
  }, "\"If something brought you here, that's enough. Come to a drop-in. Sit for an hour. See what you notice.\""), /*#__PURE__*/React.createElement("footer", {
    style: {
      fontSize: "var(--text-small)",
      color: "var(--rim-text-muted)",
      fontWeight: 600
    }
  }, "\u2014 Jesse")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 36
    }
  }, /*#__PURE__*/React.createElement(ArrowLink, {
    onClick: () => go("programs")
  }, "This Week's Schedule \u2192"))));
}
Object.assign(window, {
  Home,
  Section,
  ArrowLink
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/public-website/Home.jsx", error: String((e && e.message) || e) }); }

// ui_kits/public-website/ProgramDetail.jsx
try { (() => {
const {
  PullQuote,
  DetailRow,
  Panel,
  Button,
  Eyebrow
} = window.RootedInMindfulnessDesignSystem_980dba;
function ProgramDetail({
  program = {},
  go
}) {
  const title = program.title || "The Art of Meditation";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--rim-bg)"
    }
  }, /*#__PURE__*/React.createElement("section", {
    style: {
      backgroundColor: "var(--rim-blue)",
      backgroundImage: "url(../../assets/images/Forest-Path.jpg)",
      backgroundSize: "cover",
      backgroundPosition: "center 44%",
      padding: "112px 24px 188px",
      textAlign: "center",
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: "linear-gradient(180deg, rgba(49,87,109,0.84), rgba(13,34,53,0.91))"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 700,
      margin: "0 auto",
      position: "relative",
      zIndex: 1
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      go("programs");
    },
    style: {
      display: "inline-block",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-label)",
      fontWeight: 600,
      letterSpacing: "0.14em",
      textTransform: "uppercase",
      color: "rgba(255,255,255,0.72)",
      textDecoration: "none",
      margin: "0 0 16px"
    }
  }, program.tags && program.tags[0] || "Drop-in"), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: "var(--font-serif)",
      fontSize: "var(--text-hero)",
      fontWeight: 500,
      lineHeight: 1.15,
      letterSpacing: "-0.5px",
      color: "#fff",
      margin: "0 0 14px"
    }
  }, title), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-h4)",
      lineHeight: 1.4,
      color: "rgba(255,255,255,0.85)",
      margin: 0
    }
  }, program.description || "Guided practice and a short teaching, with time for questions."))), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 760,
      margin: "0 auto",
      padding: "0 24px 96px",
      boxSizing: "border-box"
    }
  }, /*#__PURE__*/React.createElement(PullQuote, {
    source: "\u2014 Jesse",
    floating: true
  }, "Meditation isn't a technique you master. It's a relationship you keep returning to."), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--rim-surface)",
      borderRadius: "var(--radius-2xl)",
      padding: "24px 30px 26px",
      boxShadow: "var(--card-shadow)",
      marginBottom: 15
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: "var(--font-serif)",
      fontSize: "var(--text-h2)",
      fontWeight: 400,
      margin: "0 0 16px"
    }
  }, "Details"), /*#__PURE__*/React.createElement(DetailRow, {
    icon: /*#__PURE__*/React.createElement("i", {
      "data-lucide": "calendar-days"
    })
  }, program.meta && program.meta.slice(0, 2).join(", ") || "Tuesdays, 9:30–10:45 AM"), /*#__PURE__*/React.createElement(DetailRow, {
    icon: /*#__PURE__*/React.createElement("i", {
      "data-lucide": "map-pin"
    }),
    link: "Directions \u2192",
    linkHref: "#"
  }, "4040 N. Calhoun Rd., Brookfield, WI 53005"), /*#__PURE__*/React.createElement(DetailRow, {
    icon: /*#__PURE__*/React.createElement("i", {
      "data-lucide": "video"
    })
  }, "Also offered on Zoom \u2014 the link is on your dashboard once you register."), /*#__PURE__*/React.createElement(DetailRow, {
    icon: /*#__PURE__*/React.createElement("i", {
      "data-lucide": "heart-handshake"
    }),
    last: true
  }, "Offered freely in the spirit of dana. Give what feels right, or nothing at all."), /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 22
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    href: "#"
  }, "Register"))), /*#__PURE__*/React.createElement(Panel, {
    padding: 30,
    radius: "var(--radius-2xl)",
    style: {
      margin: "5px 0 15px"
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontFamily: "var(--font-serif)",
      fontSize: "var(--text-h4)",
      fontWeight: 500,
      margin: "0 0 10px"
    }
  }, "Before you come"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 16,
      lineHeight: 1.6
    }
  }, "Chairs and cushions are both available. Arrive a few minutes early if it's your first time \u2014 someone will meet you at the door and show you where things are.")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 32,
      fontSize: "var(--text-body)",
      lineHeight: "var(--lh-body)"
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: "var(--font-serif)",
      fontSize: "var(--text-h2)",
      fontWeight: 400,
      margin: "0 0 16px"
    }
  }, "About this program"), /*#__PURE__*/React.createElement("p", null, "We begin with a settling period, move into a guided practice of about twenty-five minutes, and close with a short teaching and open questions. You don't need to have meditated before."), /*#__PURE__*/React.createElement("p", null, "People come every week; people come twice a year. Both are fine. The door is the same either way.")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 45,
      background: "var(--rim-bg-accent)",
      borderRadius: "var(--radius-lg)",
      padding: "30px 30px 25px"
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontFamily: "var(--font-serif)",
      fontSize: "var(--text-h2)",
      fontWeight: 400,
      margin: "0 0 10px"
    }
  }, "Come sit with us"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 16px",
      fontSize: 16,
      lineHeight: 1.6
    }
  }, "Registration helps us set out the right number of chairs. It is never a payment."), /*#__PURE__*/React.createElement(Button, {
    href: "#"
  }, "Register for this session"))));
}
Object.assign(window, {
  ProgramDetail
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/public-website/ProgramDetail.jsx", error: String((e && e.message) || e) }); }

// ui_kits/public-website/ProgramsList.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  ProgramCard,
  Eyebrow
} = window.RootedInMindfulnessDesignSystem_980dba;
const CATALOG = [{
  heading: "Drop-In Sessions",
  items: [{
    title: "The Art of Meditation",
    tags: ["Drop-in"],
    meta: ["Tuesdays", "9:30 AM", "In person & online"],
    description: "Guided practice and a short teaching, with time for questions."
  }, {
    title: "Meditation and Dharma Talk",
    tags: ["Drop-in"],
    meta: ["Saturdays", "9:30 AM", "In person & online"],
    description: "A guided sit followed by a talk on the week's theme."
  }, {
    title: "Awakening the Heart",
    tags: ["Drop-in"],
    meta: ["Mondays", "9:30 AM", "Online"],
    description: "Lovingkindness practice to begin the week."
  }]
}, {
  heading: "Courses",
  items: [{
    title: "Foundations of Mindfulness",
    tags: ["Course", "Registration"],
    meta: ["8 weeks", "Wednesdays", "6:30 PM"],
    description: "Where most people begin. Each session builds a real practice — not just ideas, but skills you can use."
  }, {
    title: "Essential Dharma Study",
    tags: ["Course"],
    meta: ["6 weeks", "Thursdays", "9:30 AM"],
    description: "Reading the earliest teachings together, in plain language."
  }]
}, {
  heading: "Community Groups",
  items: [{
    title: "Qigong at RIM",
    tags: ["Group"],
    meta: ["Wednesdays", "10:00 AM", "Online"],
    description: "Gentle movement and breath, open to every body."
  }, {
    title: "Nature Meditation Walk",
    tags: ["Group"],
    meta: ["Monthly", "Saturdays", "In person"],
    description: "Practice outdoors, weather permitting, at the Calhoun Rd. trails."
  }]
}];
function ProgramsList({
  go
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--rim-bg)"
    }
  }, /*#__PURE__*/React.createElement("section", {
    style: {
      minHeight: 430,
      boxSizing: "border-box",
      display: "flex",
      alignItems: "center",
      position: "relative",
      overflow: "hidden",
      backgroundColor: "var(--rim-blue)",
      backgroundImage: "url(../../assets/images/Looking-Up-Pine-Trees.jpg)",
      backgroundSize: "cover",
      backgroundPosition: "center 48%"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: "linear-gradient(90deg, rgba(13,34,53,0.96) 0%, rgba(49,87,109,0.83) 54%, rgba(49,87,109,0.48) 100%)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      zIndex: 1,
      width: "100%",
      maxWidth: 1140,
      margin: "0 auto",
      padding: "72px 40px 76px",
      boxSizing: "border-box"
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    tone: "onDark",
    style: {
      letterSpacing: "0.15em"
    }
  }, "Community Programs"), /*#__PURE__*/React.createElement("h1", {
    style: {
      maxWidth: 650,
      margin: "0 0 22px",
      color: "#fff",
      fontFamily: "var(--font-serif)",
      fontSize: "var(--text-hero)",
      fontWeight: 500,
      letterSpacing: "-0.02em",
      lineHeight: 1.08
    }
  }, "Everything we offer, in one place"), /*#__PURE__*/React.createElement("p", {
    style: {
      maxWidth: 600,
      margin: "0 0 34px",
      color: "rgba(255,255,255,0.88)",
      fontSize: "var(--text-body)",
      lineHeight: "var(--lh-body)"
    }
  }, "Drop-ins are open to anyone, any week. Courses run in seasons and ask for registration. Community groups keep going all year."), /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => e.preventDefault(),
    style: {
      minHeight: 44,
      display: "inline-flex",
      alignItems: "center",
      gap: 12,
      color: "#fff",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-small)",
      fontWeight: 600,
      textDecoration: "none"
    }
  }, "New here? Start with a drop-in ", /*#__PURE__*/React.createElement("span", null, "\u2192")))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "68px 0 88px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 900,
      margin: "0 auto 52px",
      padding: "0 40px",
      boxSizing: "border-box"
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    tone: "blue"
  }, "The catalog"), /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: "0 0 18px",
      fontSize: "var(--text-h1)",
      fontWeight: 400
    }
  }, "What's running now"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      maxWidth: 700,
      fontSize: "var(--text-body)",
      lineHeight: "var(--lh-body)"
    }
  }, "No fees, no tuition. Registration exists so we know how many chairs to set out \u2014 nothing more.")), CATALOG.map(cat => /*#__PURE__*/React.createElement("div", {
    key: cat.heading,
    style: {
      maxWidth: 900,
      margin: "0 auto 60px",
      padding: "0 40px",
      boxSizing: "border-box"
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: "0 0 18px",
      fontSize: "var(--text-h2)",
      fontWeight: 400
    }
  }, cat.heading), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 14
    }
  }, cat.items.map(p => /*#__PURE__*/React.createElement(ProgramCard, _extends({
    key: p.title
  }, p, {
    href: "#",
    onClick: e => {
      e.preventDefault();
      go("detail", p);
    }
  }))))))));
}
Object.assign(window, {
  ProgramsList
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/public-website/ProgramsList.jsx", error: String((e && e.message) || e) }); }

__ds_ns.DetailRow = __ds_scope.DetailRow;

__ds_ns.HeroPanel = __ds_scope.HeroPanel;

__ds_ns.ListRow = __ds_scope.ListRow;

__ds_ns.ProgramCard = __ds_scope.ProgramCard;

__ds_ns.PullQuote = __ds_scope.PullQuote;

__ds_ns.ScheduleRow = __ds_scope.ScheduleRow;

__ds_ns.Testimonial = __ds_scope.Testimonial;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Eyebrow = __ds_scope.Eyebrow;

__ds_ns.Panel = __ds_scope.Panel;

__ds_ns.StateMessage = __ds_scope.StateMessage;

__ds_ns.TextField = __ds_scope.TextField;

__ds_ns.AccountSidebar = __ds_scope.AccountSidebar;

__ds_ns.MemberBar = __ds_scope.MemberBar;

__ds_ns.SiteFooter = __ds_scope.SiteFooter;

__ds_ns.SiteNav = __ds_scope.SiteNav;

})();
