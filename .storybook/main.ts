import tailwindcss from "@tailwindcss/vite";
import type { StorybookConfig } from "@storybook/nextjs-vite";

// Історії лежать поруч із компонентами (src/**/*.stories.tsx); дизайн-система — DESIGN.md, токени — src/app/globals.css.
const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-a11y", "@storybook/addon-docs"],
  framework: "@storybook/nextjs-vite",
  core: { disableTelemetry: true },
  // Застосунок збирає Tailwind 4 через Next (@tailwindcss/turbopack); Vite у Storybook потребує свого плагіна.
  viteFinal: async (viteConfig) => ({ ...viteConfig, plugins: [...(viteConfig.plugins ?? []), tailwindcss()] }),
};

export default config;
