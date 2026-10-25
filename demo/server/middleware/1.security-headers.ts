import {
  STATIC_SECURITY_HEADERS,
  contentSecurityPolicy,
  createNonce,
} from '../utils/security-headers';

export default defineEventHandler((event) => {
  const nonce = createNonce();
  event.context.cspNonce = nonce;
  setResponseHeaders(event, {
    ...STATIC_SECURITY_HEADERS,
    'Content-Security-Policy': contentSecurityPolicy(nonce),
  });
});
