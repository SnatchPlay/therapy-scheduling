import type { Preview } from "@storybook/nextjs-vite";
import "../src/app/globals.css";

// Ті самі токени, що в застосунку. Темна тема — за системою (prefers-color-scheme), як у застосунку: перемикайте тему
// ОС чи емуляцію в DevTools. Шрифт Geist підключає next/font у layout.tsx, тут — системний запасний.
const preview: Preview = {
  parameters: {
    layout: "padded",
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    // Перевірка доступності (axe) показується в панелі; помилка контрасту — червона.
    a11y: { test: "error" },
  },
};

export default preview;
