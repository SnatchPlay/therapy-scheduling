import * as Sentry from "@sentry/nextjs";
import { appEnv } from "@/lib/health";

// Лише серверні помилки (їх читає той, хто на черговості). Sentry v11 за замовчуванням збирає cookie, тіла запитів,
// користувача, SQL і вхід та вихід AI SDK, а тут у запитах дані клієнтів практики й текст звернень: усе це вимкнено.
// Без SENTRY_DSN (локально, CI) Sentry вимкнений. Трасування не вмикаємо.
export function register() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: appEnv() ?? process.env.VERCEL_ENV,
    // Текст помилки бази може повторювати введене значення (`invalid input syntax for type uuid: "…"`): лапки з вмістом ховаємо до відправки.
    beforeSend(event) {
      for (const exception of event.exception?.values ?? []) {
        if (exception.value) exception.value = exception.value.replace(/"[^"]*"/g, '"…"');
      }
      return event;
    },
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
