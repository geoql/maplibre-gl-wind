/**
 * Automation browsers (Playwright, headless checkers) get no analytics: bot
 * traffic pollutes the dataset and third-party beacons stretch the
 * networkidle window that agent checkers wait on. Real users are unaffected.
 *
 * QA opt-in: an automation run that sets `window.__plausible = true` before
 * the page loads (Plausible's own bypass flag) keeps the trackers on, so the
 * tracker requests can be verified from a scripted browser.
 *
 * Gate the `useHead()` call itself, not the value passed to it: `useHead`
 * also runs during SSR, where this helper is always false.
 */
export function isAutomationBrowser(): boolean {
  if (!import.meta.client) return false;
  const optIn = (window as { __plausible?: unknown }).__plausible === true;
  return navigator.webdriver === true && !optIn;
}
