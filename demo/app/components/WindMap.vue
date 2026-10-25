<script setup lang="ts">
  import 'maplibre-gl/dist/maplibre-gl.css';
  import { MapboxOverlay } from '@deck.gl/mapbox';
  import {
    Map as MaplibreMap,
    NavigationControl,
    setWorkerUrl,
  } from 'maplibre-gl';
  // MapLibre 6 resolves its worker next to its own module URL, which a
  // bundler rewrites. Emit the worker as an asset and point MapLibre at it.
  import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
  import { WindParticleLayer, generateWindTexture } from 'maplibre-gl-wind';
  import type { WindSample } from '#shared/types/wind';
  import type { WindControls } from '~/types/wind-controls';
  import { colorRamp } from '~/utils/color-ramps';
  import { toWindPoints } from '~/utils/wind-field';

  const props = defineProps<{
    samples: WindSample[];
    controls: WindControls;
  }>();

  const STYLE = {
    light: 'https://tiles.openfreemap.org/styles/liberty',
    dark: 'https://tiles.openfreemap.org/styles/dark',
  } as const;
  // 10 m wind rarely passes 20 m/s on a 15° grid; above that is all "storm".
  const SPEED_RANGE: [number, number] = [0, 20];
  const BOUNDS = [-180, -90, 180, 90];

  const container = ref<HTMLDivElement>();
  const colorMode = useColorMode();
  const isDark = computed(() => colorMode.value === 'dark');

  let map: MaplibreMap | undefined;
  let overlay: MapboxOverlay | undefined;

  // The texture only changes with the data, never with the controls.
  const texture = computed(() => {
    const raster = generateWindTexture(toWindPoints(props.samples), {
      width: 240,
      height: 120,
      bounds: [-180, -90, 180, 90],
      power: 2,
    });
    return {
      image: raster.canvas.toDataURL('image/png'),
      imageUnscale: raster.imageUnscale,
    };
  });

  // Stable identity: the layer rebuilds its particle buffers whenever the
  // colorRamp array changes, so only make a new one when the ramp really does.
  const ramp = computed(() => colorRamp(props.controls.ramp, isDark.value));

  function windLayer() {
    const { numParticles, speedFactor, maxAge, width, animate } =
      props.controls;
    return new WindParticleLayer({
      id: 'wind',
      image: texture.value.image,
      bounds: BOUNDS,
      imageUnscale: texture.value.imageUnscale,
      numParticles,
      speedFactor,
      maxAge,
      width,
      animate,
      colorRamp: ramp.value,
      speedRange: SPEED_RANGE,
    });
  }

  function render() {
    overlay?.setProps({ layers: [windLayer()] });
  }

  onMounted(() => {
    if (!container.value) return;
    setWorkerUrl(workerUrl);
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;

    map = new MaplibreMap({
      container: container.value,
      style: isDark.value ? STYLE.dark : STYLE.light,
      center: [20, 25],
      zoom: 1.4,
      minZoom: 0.8,
      maxZoom: 8,
      renderWorldCopies: true,
      attributionControl: { compact: true },
      // On phones the map sits inside a scrolling page: one finger scrolls
      // the page, two fingers move the map.
      cooperativeGestures: coarsePointer,
    });
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');

    overlay = new MapboxOverlay({ interleaved: false, layers: [windLayer()] });
    map.addControl(overlay);
  });

  watch(() => ({ ...props.controls }), render);
  watch(texture, render);
  watch(isDark, (dark) => {
    map?.setStyle(dark ? STYLE.dark : STYLE.light);
    render();
  });

  onBeforeUnmount(() => {
    if (overlay && map) map.removeControl(overlay);
    map?.remove();
  });
</script>

<template>
  <div
    ref="container"
    class="size-full"
    role="region"
    aria-label="World map with animated wind particles"
  />
</template>
