// All user-facing words for the shared page frame live here, so they can be translated later.
export const copy = {
  siteName: 'Byte-Sized Buddies',
  tagline: 'Learn it. Try it. Keep it.',
  skipLink: 'Skip to main content',
  logoHomeLabel: 'Byte-Sized Buddies, home',
  nav: {
    label: 'Main',
    items: [
      { label: 'Lessons', href: '/lessons' },
      { label: 'For senior homes', href: '/for-senior-homes' },
      { label: 'Ask a question', href: '/ask' },
      { label: 'Teach it yourself', href: '/teach' },
      { label: 'About', href: '/about' },
    ],
    visit: { label: 'Request a visit', href: '/for-senior-homes#contact' },
    menuOpen: 'Menu',
    menuClose: 'Close menu',
  },
  footer: {
    line: 'Byte-Sized Buddies · Free to print and share · [YOUR WEBSITE]',
    studentLed: 'Student-led volunteer project.',
    linksLabel: 'About this site',
    links: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'License', href: '/license' },
    ],
  },
  form: {
    required: '(required)',
    errorPrefix: 'Problem:',
  },
  home: {
    title: 'Byte-Sized Buddies',
    description:
      'Free, patient, hands-on technology lessons for older adults, and free materials for anyone who wants to teach them.',
    hello: 'Our website is on its way. Thank you for your patience.',
  },
} as const;
