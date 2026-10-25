<script setup lang="ts">
  import { SITE } from '~/data/site';

  const SNIPPET = `import { Map } from 'maplibre-gl';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { WindParticleLayer, generateWindTexture } from 'maplibre-gl-wind';

// direction = where the wind blows TOWARD (weather APIs: from + 180)
const wind = generateWindTexture(points, { width: 240, height: 120 });

const map = new Map({
  container: 'map',
  style: 'https://tiles.openfreemap.org/styles/liberty',
});

map.addControl(
  new MapboxOverlay({
    layers: [
      new WindParticleLayer({
        id: 'wind',
        image: wind.canvas.toDataURL(),
        imageUnscale: wind.imageUnscale,
        numParticles: 8192,
        speedRange: [0, 20],
      }),
    ],
  }),
);`;

  const FACTS = [
    {
      term: 'Transform feedback',
      body: 'Particle positions advance on the GPU every frame; the CPU never touches them.',
    },
    {
      term: 'IDW texture',
      body: 'generateWindTexture turns scattered samples into a U/V texture with inverse-distance weighting.',
    },
    {
      term: 'Live data',
      body: 'This page reads current 10 m wind from Open-Meteo on a 15° grid, refreshed hourly.',
    },
  ];
</script>

<template>
  <section
    id="usage"
    aria-labelledby="usage-title"
    class="grid gap-10 border-t border-rule px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-16 lg:py-20"
  >
    <div>
      <p class="font-mono text-[0.7rem] tracking-[0.14em] text-ink-3 uppercase">
        Usage
      </p>
      <h2
        id="usage-title"
        class="mt-3 font-display text-3xl font-semibold tracking-tight"
      >
        One layer, one overlay.
      </h2>
      <dl class="mt-8 grid gap-6">
        <div v-for="fact in FACTS" :key="fact.term">
          <dt class="text-sm font-bold">{{ fact.term }}</dt>
          <dd class="mt-1 text-sm leading-relaxed text-ink-2">
            {{ fact.body }}
          </dd>
        </div>
      </dl>
      <p class="mt-8 text-sm text-ink-2">
        Full props table in the
        <OutboundLink
          :href="`${SITE.github}#api`"
          section="usage"
          class="underline decoration-rule underline-offset-4 hover:decoration-accent"
          >README</OutboundLink
        >.
      </p>
    </div>
    <pre
      class="min-w-0 overflow-x-auto border border-rule bg-paper-2 p-5 font-mono text-[0.78rem] leading-relaxed text-ink-2"
    ><code>{{ SNIPPET }}</code></pre>
  </section>
</template>
