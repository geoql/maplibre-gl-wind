<script setup lang="ts">
  import type { WindPayload } from '#shared/types/wind';
  import { formatCoordinate, strongestWind } from '~/utils/wind-field';

  const props = defineProps<{ wind: WindPayload }>();

  const peak = computed(() => strongestWind(props.wind.points));
  const time = computed(() =>
    new Date(props.wind.time).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    }),
  );
</script>

<template>
  <div
    v-if="peak"
    class="pointer-events-none border border-rule bg-paper px-4 py-3"
  >
    <p class="font-mono text-[0.68rem] tracking-[0.14em] text-ink-3 uppercase">
      Strongest wind on the grid · {{ time }} UTC
    </p>
    <p class="mt-1 flex items-baseline gap-2">
      <span
        class="font-display text-[clamp(2.75rem,7vw,5.5rem)] leading-[0.9] font-semibold tracking-tight tabular-nums"
      >
        {{ peak.speed.toFixed(1) }}
      </span>
      <span class="font-mono text-sm text-ink-2">m/s</span>
    </p>
    <p class="mt-1 font-mono text-xs text-ink-2">
      at {{ formatCoordinate(peak.lat, peak.lon) }}
    </p>
  </div>
</template>
