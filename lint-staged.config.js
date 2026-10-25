const ignorePatterns = [
  /(?:^|\/)jsr\.json$/,
  /(?:^|\/)CHANGELOG\.md$/,
  /(?:^|\/)pnpm-lock\.yaml$/,
  /(?:^|\/)dist\//,
];

const isIgnored = (file) =>
  ignorePatterns.some((pattern) => pattern.test(file));

// demo/ is a Nuxt app with its own oxlint/oxfmt configs (Vue support).
const isDemo = (file) => /(?:^|\/)demo\//.test(file);

export default {
  /** @param {string[]} files */
  'demo/**/*.{js,ts,vue,css,json,jsonc,md}': (files) => [
    `pnpm --filter maplibre-gl-wind-demo exec oxlint --fix ${files.filter((f) => /\.(js|ts|vue)$/.test(f)).join(' ') || '.'}`,
    `pnpm --filter maplibre-gl-wind-demo exec oxfmt --write ${files.join(' ')}`,
  ],
  /** @param {string[]} files */
  '*.{js,ts}': (files) => {
    const filtered = files.filter((f) => !isIgnored(f) && !isDemo(f));
    return filtered.length > 0
      ? [
          `vp lint --fix ${filtered.join(' ')}`,
          `vp fmt --write ${filtered.join(' ')}`,
        ]
      : [];
  },
  /** @param {string[]} files */
  '*.{json,jsonc,md,yml,yaml,css}': (files) => {
    const filtered = files.filter((f) => !isIgnored(f) && !isDemo(f));
    return filtered.length > 0 ? [`vp fmt --write ${filtered.join(' ')}`] : [];
  },
};
