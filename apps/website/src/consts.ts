import type { Route, SiteConfig } from '@/types';

// Single source of truth for the site's name. Rename the project here once and
// the browser tab, the header brand, and the footer all follow.
export const SITE: SiteConfig = {
  name: 'JilataX',
  description:
    'Jilatax — Android-first application framework for Lynx and Rspeedy. Scaffold, build and ship Android apps with one command: npm create jilatax@latest.',
  url: 'https://jilatax.dev',
};

// The "connected routes" registry. Header builds its nav from this, and 404.astro
// links home from it — add a top-level page in ONE place and both update.
//
// Detail routes (e.g. /project/[slug]) are generated from Content Collections,
// not hand-listed here. See ARCHITECTURE.md → "Routing convention".
export const ROUTES: Route[] = [
  { href: '/', label: 'Home' },
  { href: '/#box', label: 'Box' },
  { href: '/#packages', label: 'Packages' },
];

/** External links used across the landing page. */
export const LINKS = {
  npm: 'https://www.npmjs.com/package/create-jilatax',
  github: 'https://github.com/jilatax/jilatax',
  command: 'npm create jilatax@latest',
} as const;
