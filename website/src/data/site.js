export const navItems = [
  { href: '/', label: 'Home' },
  { href: '/scholar-vs-merchant', label: 'PasteCraft Scholar vs Merchant' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/changelog', label: 'Changelog' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
  { href: '/account', label: 'Account' },
];

export const exploreLinks = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/changelog', label: 'Changelog' },
  { href: '/scholar-vs-merchant', label: 'Scholar vs Merchant' },
];

export const helpLinks = [
  { href: '/support', label: 'Support' },
  { href: '/contact', label: 'Contact' },
  { href: '/changelog', label: 'Changelog' },
  { href: '/upgrade', label: 'Upgrade' },
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
];

export const footerLinks = [...exploreLinks, ...helpLinks];

export const socialLinks = [
  { href: 'https://www.facebook.com/PasteCraftOfficial', label: 'Facebook' },
  { href: 'https://www.reddit.com/r/PasteCraft/', label: 'Reddit' },
];

export const storeLinks = {
  chrome: 'https://chromewebstore.google.com/detail/pastecraft-smart-clipboar/fidljmdohgkjmmgojdblbbnfoeengoko',
  edge: 'https://microsoftedge.microsoft.com/addons/detail/pastecraft/fblihhfoojjhmhnhilhhejdcigjmmncc',
};

export const pricingPlans = [
  {
    id: 'freemium',
    name: 'Freemium',
    price: '$0',
    cadence: '/forever',
    note: 'Unlimited clips, notes, and categories on your device for fast study and work capture.',
    popular: false,
    tier: 'Free',
    features: [
      'Unlimited clips',
      'Unlimited notes',
      'Unlimited categories',
      '20+ markup formats and 190+ languages',
      'Local device storage',
    ],
  },
  {
    id: 'basic',
    name: 'Basic',
    price: '$1.99',
    cadence: '/month',
    note: 'Cloud sync and database-backed storage across devices.',
    popular: true,
    tier: 'Basic',
    features: [
      'Everything in Freemium',
      'Cloud sync',
      'Cloud-backed storage',
      'Cross-device continuity',
      'Standard support',
    ],
    billing: {
      weekly: { amount: 0.99, suffix: '/week' },
      monthly: { amount: 1.99, suffix: '/month' },
      yearly: { amount: 9.99, suffix: '/year' },
    },
  },
  {
    id: 'enhanced',
    name: 'Enhanced',
    price: '$3.99',
    cadence: '/week',
    note: 'AI Lab text tools on top of full cloud sync.',
    popular: false,
    tier: 'Enhanced',
    features: [
      'Everything in Basic',
      'AI Lab breakdowns',
      'AI Lab summaries',
      '4,000 weekly text credits with rollover up to 20,000',
      '35,000 monthly text credits',
      '500,000 yearly text credits',
      'Bring-your-own profile image gallery',
    ],
    billing: {
      weekly: { amount: 3.99, suffix: '/week' },
      monthly: { amount: 9.99, suffix: '/month' },
      yearly: { amount: 49.99, suffix: '/year' },
    },
  },
];

export const trustPills = [
  'Built for productivity',
  'Built for studying',
  'Categories and notes',
  'AI Lab',
];
