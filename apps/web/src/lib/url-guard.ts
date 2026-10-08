/** Riot sign-in parameters that must never sit in our own address bar. */
const CREDENTIAL_PARAM = /(?:^|[?#&])(?:access_token|id_token|entitlements_token)=/i;

/**
 * If a sign-in token ever lands in this site's URL (a misdirected redirect, a
 * link someone pasted), drop the query and fragment from the address bar and
 * the history entry before the app renders, logs or stores anything.
 * Share links (/c#...) are untouched: their fragment holds no token names.
 */
export function scrubCredentialsFromUrl(
  loc: Pick<Location, "pathname" | "search" | "hash"> = window.location,
) {
  if (!CREDENTIAL_PARAM.test(loc.search) && !CREDENTIAL_PARAM.test(loc.hash)) return false;
  window.history.replaceState(null, "", loc.pathname);
  return true;
}
