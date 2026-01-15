import type { Configuration } from 'lint-staged';

const config: Configuration = {
  '*.{js,ts}': ['oxlint --fix', 'prettier --write'],
  '*.{json,md,yml,yaml}': ['prettier --write'],
};

export default config;
