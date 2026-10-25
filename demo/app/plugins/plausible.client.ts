import type { PlausibleFn, PlausibleHandle } from '~/types/analytics';
import { isAutomationBrowser } from '~/utils/automation-browser';

declare module '#app' {
  interface NuxtApp {
    $plausible?: PlausibleHandle;
  }
}

export default defineNuxtPlugin((nuxtApp) => {
  const { plausibleScriptId, plausibleApiHost } = useRuntimeConfig().public;
  if (!plausibleScriptId || !plausibleApiHost || isAutomationBrowser()) return;

  // The pa-*.js tracker only boots if `window.plausible.o` is already set
  // when it loads. Plausible's official snippet: define the queue stub and
  // call init() BEFORE the async script arrives.
  const w = window as unknown as { plausible?: PlausibleFn };
  const stub: PlausibleFn =
    w.plausible ??
    ((...args: unknown[]) => {
      (stub.q ||= []).push(args);
    });
  stub.init ||= (options?: Record<string, unknown>) => {
    stub.o = options || {};
  };
  w.plausible = stub;
  stub.init({
    autoCapturePageviews: true,
    captureOnLocalhost: import.meta.dev,
  });

  useHead({
    script: [
      {
        src: `${plausibleApiHost}/js/pa-${plausibleScriptId}.js`,
        async: true,
      },
    ],
  });

  nuxtApp.provide('plausible', {
    plausible: (...args: unknown[]) => w.plausible?.(...args),
  } satisfies PlausibleHandle);
});
