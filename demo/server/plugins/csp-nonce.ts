/**
 * Stamps the per-request CSP nonce (set by server/middleware/security-headers.ts)
 * onto every SSR-emitted <script>, so the strict-dynamic policy trusts Nuxt's
 * inline bootstrap, the color-mode script and everything they load.
 */
export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('render:html', (html, { event }) => {
    const nonce: string | undefined = event.context.cspNonce;
    if (!nonce) return;

    const stamp = (chunk: string) =>
      chunk.replaceAll(/<script(?![^>]*\snonce=)/g, `<script nonce="${nonce}"`);

    html.head = html.head.map(stamp);
    html.bodyPrepend = html.bodyPrepend.map(stamp);
    html.body = html.body.map(stamp);
    html.bodyAppend = html.bodyAppend.map(stamp);
  });
});
