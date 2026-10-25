<script setup lang="ts">
  import { SITE } from '~/data/site';
</script>

<template>
  <header
    class="sticky top-0 z-30 border-b border-rule bg-paper/90 backdrop-blur-md"
  >
    <div class="flex h-14 items-center justify-between gap-4 px-4 sm:px-6">
      <a
        :href="SITE.geoql"
        class="flex min-w-0 items-baseline gap-2"
        aria-label="GeoQL home"
      >
        <span class="font-display text-base font-semibold tracking-tight">
          Geo<span class="text-accent">QL</span>
        </span>
        <span class="truncate font-mono text-xs text-ink-3">
          / maplibre-gl-wind
        </span>
      </a>

      <nav aria-label="Project links" class="flex items-center gap-1 sm:gap-2">
        <OutboundLink
          :href="SITE.github"
          section="header"
          class="hidden h-9 items-center px-3 font-mono text-xs text-ink-2 transition-colors hover:text-ink sm:inline-flex"
        >
          GitHub
        </OutboundLink>
        <OutboundLink
          :href="SITE.npm"
          section="header"
          class="hidden h-9 items-center px-3 font-mono text-xs text-ink-2 transition-colors hover:text-ink sm:inline-flex"
        >
          npm
        </OutboundLink>
        <ThemeToggle />
      </nav>
    </div>
  </header>
</template>
