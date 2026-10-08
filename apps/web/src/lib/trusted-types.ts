/**
 * Trusted Types (enforced by the CSP: require-trusted-types-for 'script').
 * The app never writes raw HTML or builds scripts from strings, so the default
 * policy refuses both outright: if an injection ever reached innerHTML or
 * eval, the browser throws instead of running it. The one script URL the app
 * loads from code, the demo's service worker, is the only one allowed.
 */
type PolicyFactory = {
  createPolicy: (
    name: string,
    rules: {
      createHTML?: (input: string) => string;
      createScript?: (input: string) => string;
      createScriptURL?: (input: string) => string;
    },
  ) => unknown;
};

export const ALLOWED_SCRIPT_URLS = new Set(["/mockServiceWorker.js"]);

export function allowScriptUrl(input: string, origin = window.location.origin): string {
  const url = new URL(input, origin);
  if (url.origin === origin && ALLOWED_SCRIPT_URLS.has(url.pathname)) return input;
  throw new TypeError("Blocked a script URL that isn't on the allowlist");
}

export function installTrustedTypesPolicy() {
  const factory = (globalThis as { trustedTypes?: PolicyFactory }).trustedTypes;
  if (!factory) return false; // Browsers without Trusted Types rely on the rest of the CSP.
  try {
    factory.createPolicy("default", {
      createHTML: () => {
        throw new TypeError("Blocked raw HTML (Trusted Types)");
      },
      createScript: () => {
        throw new TypeError("Blocked a script built from a string (Trusted Types)");
      },
      createScriptURL: (input) => allowScriptUrl(input),
    });
    return true;
  } catch {
    // A default policy already exists (e.g. hot reload): keep it.
    return false;
  }
}

installTrustedTypesPolicy();
