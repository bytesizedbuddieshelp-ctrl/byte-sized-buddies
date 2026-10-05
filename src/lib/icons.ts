// The one set of icon drawings. Outlined, drawn on a 24x24 grid, stroke 2.5, round caps.
// Used by src/components/Icon.astro and src/components/forms/Icon.tsx.
export const iconPaths = {
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  alert: '<path d="M12 4.5l9 15.5H3z"/><path d="M12 10v4.5M12 17.5v.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5v.01"/>',
  'arrow-left': '<path d="M20 12H5M11 6l-6 6 6 6"/>',
  'arrow-right': '<path d="M4 12h15M13 6l6 6-6 6"/>',
  download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M15 9V6.5A2.5 2.5 0 0 0 12.5 4h-6A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15H9"/>',
  home: '<path d="M4 11l8-7 8 7"/><path d="M6 10v9.5h12V10"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>',
  question: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17v.01"/>',
  play: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M10 9l5 3-5 3z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M4 8l8 6 8-6"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  video: '<rect x="2.5" y="6" width="13" height="12" rx="3"/><path d="M15.5 10.5l6-3.5v10l-6-3.5z"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
  screen: '<rect x="3" y="4" width="18" height="12" rx="2.5"/><path d="M8 20h8M12 16v4"/>',
  record: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/>',
  pause: '<path d="M9 6v12M15 6v12"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2.5"/>',
  pen: '<path d="M4 20l1.2-4.4L15.8 5a2.1 2.1 0 0 1 3 3L8.4 18.8z"/><path d="M13.8 7l3 3"/>',
  highlighter: '<path d="M14.5 4.5l5 5-7.5 7.5-5-5z"/><path d="M7 12.5l-2.5 5 2 2 5-2.5"/><path d="M3.5 20.5h6"/>',
  pointer: '<path d="M5 19L18 6"/><path d="M10 6h8v8"/>',
  oval: '<ellipse cx="12" cy="12" rx="9" ry="6.5"/>',
  undo: '<path d="M9 5L4 10l5 5"/><path d="M4 10h10a5 5 0 0 1 0 10h-3"/>',
  float: '<rect x="3" y="4" width="18" height="16" rx="3"/><rect x="11" y="11" width="7" height="6" rx="1.5"/>',
} as const;

export type IconName = keyof typeof iconPaths;
