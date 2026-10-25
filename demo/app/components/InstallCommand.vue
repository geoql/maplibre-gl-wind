<script setup lang="ts">
  import { INSTALL, type InstallManager } from '~/data/site';

  const MANAGERS: InstallManager[] = ['npm', 'pnpm', 'jsr'];

  const manager = ref<InstallManager>('npm');
  const copied = ref(false);
  const { track } = useAnalytics();
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function copy() {
    await navigator.clipboard.writeText(INSTALL[manager.value]);
    copied.value = true;
    track('install_copied', { manager: manager.value });
    clearTimeout(timer);
    timer = setTimeout(() => (copied.value = false), 1600);
  }

  onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <div class="border border-rule bg-paper-2">
    <div
      role="tablist"
      aria-label="Package manager"
      class="flex border-b border-rule"
    >
      <button
        v-for="m in MANAGERS"
        :key="m"
        type="button"
        role="tab"
        :aria-selected="manager === m"
        class="h-8 px-3 font-mono text-xs transition-colors"
        :class="
          manager === m
            ? 'bg-paper text-ink shadow-[inset_0_-2px_0_var(--accent)]'
            : 'text-ink-3 hover:text-ink'
        "
        @click="manager = m"
      >
        {{ m }}
      </button>
    </div>
    <div class="flex items-start gap-2 p-3">
      <code
        class="min-w-0 flex-1 font-mono text-xs leading-relaxed break-words text-ink-2"
      >
        <span class="text-ink-3 select-none">$ </span>{{ INSTALL[manager] }}
      </code>
      <button
        type="button"
        class="h-7 shrink-0 border border-rule px-2 font-mono text-xs text-ink-2 transition-colors hover:border-ink-3 hover:text-ink"
        :aria-label="`Copy the ${manager} install command`"
        @click="copy"
      >
        {{ copied ? 'copied' : 'copy' }}
      </button>
    </div>
    <p class="sr-only" aria-live="polite">
      {{ copied ? 'Copied to clipboard' : '' }}
    </p>
  </div>
</template>
