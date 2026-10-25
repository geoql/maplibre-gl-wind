<script setup lang="ts">
  import { SITE } from '~/data/site';
</script>

<template>
  <footer
    class="flex flex-col gap-3 border-t border-rule px-4 py-8 font-mono text-xs text-ink-3 sm:flex-row sm:items-center sm:justify-between sm:px-6"
  >
    <p>
      MIT ·
      <OutboundLink :href="SITE.github" section="footer" class="hover:text-ink"
        >geoql/maplibre-gl-wind</OutboundLink
      >
      ·
      <OutboundLink :href="SITE.jsr" section="footer" class="hover:text-ink"
        >JSR</OutboundLink
      >
    </p>
    <p>
      Wind data by
      <OutboundLink
        :href="SITE.openMeteo"
        section="footer"
        class="hover:text-ink"
        >Open-Meteo.com</OutboundLink
      >
      (CC BY 4.0)
    </p>
  </footer>
</template>
