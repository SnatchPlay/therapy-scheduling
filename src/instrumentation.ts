import * as Sentry from "@sentry/nextjs";

// Лише серверні помилки (їх читає той, хто на черговості). Sentry v11 за замовчуванням збирає cookie, тіла запитів,
// користувача, SQL і вхід та вихід AI SDK, а тут у запитах дані клієнтів практики й текст звернень: усе це вимкнено.
// Без SENTRY_DSN (локально, CI) Sentry вимкнений. Трасування не вмикаємо.
export function register() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.APP_ENV ?? process.env.VERCEL_ENV,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      genAI: { inputs: false, outputs: false },
      mcp: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
    },
  });
}

export const onRequestError = Sentry.captureRequestError;
