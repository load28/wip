import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {},
  },
  plugins: [],
  corePlugins: {
    preflight: false, // MUI와 충돌 방지
  },
};

export default config;
