const config = {
  "*.{ts,tsx,mjs,mts}": ["eslint --fix --max-warnings=0", "prettier --write"],
  "*.{json,md,yml,yaml,css}": ["prettier --write"],
};
export default config;
