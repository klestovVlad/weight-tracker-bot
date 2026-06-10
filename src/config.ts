export const APP_VERSION = "1.0.0";
export const WEIGHT_MIN = 30;
export const WEIGHT_MAX = 300;
export const TIMEZONE = "Asia/Nicosia";
export const PENDING_ACTION_TTL_HOURS = 24;

/**
 * Owner-toggleable boolean feature flags, stored in the `settings` table.
 * Rendered automatically in the admin ⚙️ Настройки menu — add an entry here
 * and it appears as a toggle with no extra wiring.
 */
export interface FeatureFlag {
  /** settings.key used for storage. */
  key: string;
  /** Button label shown in the settings menu. */
  label: string;
  /** Value used when the flag has never been set. */
  default: boolean;
}

export const FEATURE_FLAGS: FeatureFlag[] = [
  { key: "memes_enabled", label: "🖼 Мемы в отчётах", default: true },
];

export function getFlagDef(key: string): FeatureFlag | undefined {
  return FEATURE_FLAGS.find((f) => f.key === key);
}
