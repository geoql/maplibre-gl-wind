<script setup lang="ts">
  import type { AnalyticsEventMap } from '~/types/analytics';
  import { RAMP_LABEL, type RampId } from '~/utils/color-ramps';
  import type { WindControls } from '~/types/wind-controls';

  const controls = defineModel<WindControls>({ required: true });
  const { track } = useAnalytics();

  const PARTICLES = [2048, 4096, 8192, 16384, 32768];
  const RAMPS = Object.keys(RAMP_LABEL) as RampId[];

  type Control = AnalyticsEventMap['wind_control']['control'];
  function commit(control: Control, value: string | number | boolean) {
    track('wind_control', { control, value: String(value) });
  }

  function setRamp(ramp: RampId) {
    controls.value.ramp = ramp;
    commit('ramp', ramp);
  }

  function toggleAnimate() {
    controls.value.animate = !controls.value.animate;
    commit('animate', controls.value.animate);
  }
</script>

<template>
  <fieldset class="grid gap-5">
    <legend
      class="mb-4 font-mono text-[0.7rem] tracking-[0.14em] text-ink-3 uppercase"
    >
      Layer props
    </legend>

    <div class="grid gap-1.5">
      <label for="particles" class="text-sm text-ink-2">numParticles</label>
      <select
        id="particles"
        v-model.number="controls.numParticles"
        class="h-9 w-full border border-rule bg-paper px-2 font-mono text-xs text-ink"
        @change="commit('particles', controls.numParticles)"
      >
        <option v-for="n in PARTICLES" :key="n" :value="n">
          {{ n.toLocaleString('en') }}
        </option>
      </select>
    </div>

    <RangeControl
      v-model="controls.speedFactor"
      label="speedFactor"
      :min="5"
      :max="120"
      :step="5"
      @commit="commit('speed', $event)"
    />
    <RangeControl
      v-model="controls.maxAge"
      label="maxAge"
      :min="10"
      :max="120"
      :step="5"
      unit=" frames"
      @commit="commit('trail', $event)"
    />
    <RangeControl
      v-model="controls.width"
      label="width"
      :min="0.5"
      :max="4"
      :step="0.5"
      unit=" px"
      @commit="commit('width', $event)"
    />

    <div class="grid gap-1.5">
      <span id="ramp-label" class="text-sm text-ink-2">colorRamp</span>
      <div
        role="radiogroup"
        aria-labelledby="ramp-label"
        class="grid grid-cols-4 border border-rule"
      >
        <button
          v-for="(r, i) in RAMPS"
          :key="r"
          type="button"
          role="radio"
          :aria-checked="controls.ramp === r"
          class="h-9 font-mono text-xs transition-colors"
          :class="[
            i > 0 ? 'border-l border-rule' : '',
            controls.ramp === r
              ? 'bg-ink text-paper'
              : 'text-ink-2 hover:text-ink',
          ]"
          @click="setRamp(r)"
        >
          {{ RAMP_LABEL[r] }}
        </button>
      </div>
    </div>

    <button
      type="button"
      class="h-9 border border-ink px-3 font-mono text-xs text-ink transition-colors hover:bg-ink hover:text-paper"
      :aria-pressed="!controls.animate"
      @click="toggleAnimate"
    >
      {{ controls.animate ? 'Pause particles' : 'Resume particles' }}
    </button>
  </fieldset>
</template>
