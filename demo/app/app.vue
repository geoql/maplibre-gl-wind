<script setup lang="ts">
  import type { WindPayload } from '#shared/types/wind';
  import { SITE } from '~/data/site';
  import type { WindControls } from '~/types/wind-controls';

  useSeoMeta({
    title: SITE.title,
    description: SITE.description,
    ogType: 'website',
    ogSiteName: 'GeoQL',
    ogUrl: `${SITE.url}/`,
    ogTitle: SITE.title,
    ogDescription: SITE.description,
    twitterCard: 'summary',
    twitterTitle: SITE.title,
    twitterDescription: SITE.description,
  });

  useHead({
    link: [{ rel: 'canonical', href: `${SITE.url}/` }],
    meta: [
      {
        name: 'theme-color',
        content: '#f8f6f1',
        media: '(prefers-color-scheme: light)',
      },
      {
        name: 'theme-color',
        content: '#14161c',
        media: '(prefers-color-scheme: dark)',
      },
    ],
  });

  const { data: wind } = await useFetch<WindPayload>('/api/wind', {
    key: 'wind',
  });

  const controls = ref<WindControls>({
    numParticles: 4096,
    speedFactor: 40,
    maxAge: 25,
    width: 1,
    ramp: 'auto',
    animate: true,
  });

  const sourceLabel = computed(() => {
    if (!wind.value) return '';
    const n = wind.value.points.length;
    return wind.value.source === 'open-meteo'
      ? `Open-Meteo · ${n} points · 15° grid · live`
      : `Bundled Open-Meteo snapshot · ${n} points (live feed unreachable)`;
  });
</script>

<template>
  <div>
    <SiteHeader />
    <main>
      <section
        aria-labelledby="page-title"
        class="grid lg:h-[calc(100dvh-3.5rem)] lg:grid-cols-[24rem_minmax(0,1fr)]"
      >
        <div
          class="relative order-1 h-[62dvh] min-h-80 bg-paper-2 lg:order-2 lg:h-full"
        >
          <ClientOnly>
            <WindMap v-if="wind" :samples="wind.points" :controls="controls" />
          </ClientOnly>
          <div
            v-if="wind"
            class="absolute bottom-8 left-3 z-10 max-w-[calc(100%-1.5rem)] sm:left-4"
          >
            <WindReadout :wind="wind" />
          </div>
        </div>

        <aside
          class="order-2 flex flex-col gap-8 border-rule px-4 py-8 sm:px-6 lg:order-1 lg:overflow-y-auto lg:border-r"
        >
          <div>
            <p
              class="font-mono text-[0.7rem] tracking-[0.14em] text-ink-3 uppercase"
            >
              deck.gl layer · MapLibre GL
            </p>
            <h1
              id="page-title"
              class="mt-3 font-display text-[2.4rem] leading-[1.02] font-semibold tracking-tight"
            >
              Wind, drawn by the GPU.
            </h1>
            <p class="mt-4 text-[0.95rem] leading-relaxed text-ink-2">
              <code class="font-mono text-[0.85em] text-ink"
                >maplibre-gl-wind</code
              >
              animates wind particles with deck.gl transform feedback. Below:
              the current wind on Earth, live.
            </p>
          </div>

          <InstallCommand />

          <ControlPanel v-model="controls" />

          <p v-if="wind" class="font-mono text-xs leading-relaxed text-ink-3">
            {{ sourceLabel }}
          </p>
        </aside>
      </section>

      <UsageSection />
    </main>
    <SiteFooter />
  </div>
</template>
