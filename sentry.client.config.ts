import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://f2d0b0a3f2b439e685f47fe1ab2d5f5d@o4509517678051328.ingest.us.sentry.io/4510786419228672",

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Enable structured logging
  enableLogs: true,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  replaysOnErrorSampleRate: 1.0,

  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // Integrations
  integrations: [
    // Session Replay
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
    // Auto-capture console logs
    Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] }),
  ],
});
