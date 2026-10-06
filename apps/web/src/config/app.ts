declare const __OFFICIAL_DOMAIN__: string;

/** The domain users should check before pasting their access URL. Set at build time (vite.config.ts). */
export const OFFICIAL_DOMAIN = __OFFICIAL_DOMAIN__;

export const APP_NAME = "ValoVertix";

export const SOURCE_REPO_URL: string | null = null; // Set once the repo is public.

/** Match details are fetched lazily, this many at a time. */
export const MATCH_DETAILS_PAGE = 10;
