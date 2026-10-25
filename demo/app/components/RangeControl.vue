<script setup lang="ts">
  const props = defineProps<{
    label: string;
    min: number;
    max: number;
    step: number;
    unit?: string;
  }>();
  const model = defineModel<number>({ required: true });
  const emit = defineEmits<{ commit: [value: number] }>();
  const id = useId();
</script>

<template>
  <div class="grid gap-1.5">
    <div class="flex items-baseline justify-between gap-3">
      <label :for="id" class="text-sm text-ink-2">{{ props.label }}</label>
      <output :for="id" class="font-mono text-xs text-ink tabular-nums">
        {{ model }}{{ props.unit ?? '' }}
      </output>
    </div>
    <input
      :id="id"
      v-model.number="model"
      type="range"
      class="wind-range w-full"
      :min="props.min"
      :max="props.max"
      :step="props.step"
      @change="emit('commit', model)"
    />
  </div>
</template>
