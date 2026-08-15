const ignorePatterns = [
  /(?:^|\/)jsr\.json$/,
  /(?:^|\/)CHANGELOG\.md$/,
  /(?:^|\/)pnpm-lock\.yaml$/,
  /(?:^|\/)dist\//,
];

const isIgnored = (file) =>
  ignorePatterns.some((pattern) => pattern.test(file));

export default {
  /** @param {string[]} files */
  '*.{js,ts}': (files) => {
    const filtered = files.filter((f) => !isIgnored(f));
    return filtered.length > 0
      ? [
          `vp lint --fix ${filtered.join(' ')}`,
          `vp fmt --write ${filtered.join(' ')}`,
        ]
      : [];
  },
  /** @param {string[]} files */
  '*.{json,jsonc,md,yml,yaml,css}': (files) => {
    const filtered = files.filter((f) => !isIgnored(f));
    return filtered.length > 0 ? [`vp fmt --write ${filtered.join(' ')}`] : [];
  },
};
