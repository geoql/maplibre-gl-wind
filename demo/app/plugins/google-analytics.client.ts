import type { GtagHandle } from '~/types/analytics';
import { isAutomationBrowser } from '~/utils/automation-browser';

declare module '#app' {
  interface NuxtApp {
    $ga?: GtagHandle;
  }
}

// GA4 stays off until runtimeConfig.public.gtagId is set (NUXT_PUBLIC_GTAG_ID).
export default defineNuxtPlugin((nuxtApp) => {
  const gtagId = useRuntimeConfig().public.gtagId;
  if (!gtagId || isAutomationBrowser()) return;

  const { proxy } = useScriptGoogleAnalytics({ id: gtagId });

  nuxtApp.provide('ga', {
    gtag: (...args: unknown[]) => {
      (proxy.gtag as (...a: unknown[]) => void)(...args);
    },
  } satisfies GtagHandle);
});
