/**
 * Security headers for every response.
 *
 * Scripts: a per-request nonce plus 'strict-dynamic'. The nonce lands on
 * every SSR <script> (server/plugins/csp-nonce.ts); scripts those load at
 * runtime (gtag, Plausible pa-*.js) inherit trust through strict-dynamic.
 * 'unsafe-inline' and https: are ignored by CSP3 browsers when a nonce is
 * present; they are only a fallback for older ones.
 *
 * Map: MapLibre fetches style, tiles, glyphs and sprites from OpenFreeMap and
 * runs its tile workers from blob: URLs. The wind texture is a data: URL that
 * deck.gl's image loader fetches, so connect-src allows data:.
 */
const TRACKERS = {
  plausible: 'https://analytics.geoql.in',
  openpanel: 'https://events.geoql.in',
  gtm: 'https://www.googletagmanager.com',
  ga: ['https://*.google-analytics.com', 'https://*.analytics.google.com'],
};

const MAP_TILES = 'https://tiles.openfreemap.org';

export function contentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "script-src-attr 'none'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https: 'unsafe-inline'`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    [
      "img-src 'self' data: blob:",
      MAP_TILES,
      TRACKERS.gtm,
      ...TRACKERS.ga,
    ].join(' '),
    [
      "connect-src 'self' data: blob:",
      MAP_TILES,
      TRACKERS.plausible,
      TRACKERS.openpanel,
      TRACKERS.gtm,
      ...TRACKERS.ga,
    ].join(' '),
    "manifest-src 'self'",
    'upgrade-insecure-requests',
  ].join('; ');
}

export const STATIC_SECURITY_HEADERS: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), display-capture=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, '');
}
