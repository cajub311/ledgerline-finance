declare namespace NodeJS {
  interface ProcessEnv {
    /** When set at build time, web builds show a password screen before the app. */
    EXPO_PUBLIC_WEB_ACCESS_PASSWORD?: string;
  }
}
