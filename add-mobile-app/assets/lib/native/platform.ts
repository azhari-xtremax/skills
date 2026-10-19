import { Capacitor } from '@capacitor/core';

/**
 * Centralized Capacitor platform detection — the foundation for any
 * mobile-specific behavior. Import these instead of calling `Capacitor.*`
 * directly, so every native-aware branch in the app goes through one place.
 */

/** True when running inside the Capacitor native shell (iOS or Android), false on web. */
export const isNative = () => Capacitor.isNativePlatform();

/** 'ios' | 'android' | 'web' */
export const platform = () => Capacitor.getPlatform();

const PLATFORM_LABELS: Record<ReturnType<typeof platform>, string> = {
  ios: 'iOS',
  android: 'Android',
  web: 'Web',
};

/** Human-readable form of `platform()` — 'iOS' | 'Android' | 'Web'. */
export const platformLabel = () => PLATFORM_LABELS[platform()];
