export type UserMemorySettings = {
  behavioralLearningEnabled: boolean;
  journalCoachingEnabled: boolean;
  updatedAt: string | null;
};

export const DEFAULT_USER_MEMORY_SETTINGS: UserMemorySettings = {
  behavioralLearningEnabled: true,
  journalCoachingEnabled: true,
  updatedAt: null,
};

export function normalizeUserMemorySettings(value: Partial<UserMemorySettings> | null | undefined): UserMemorySettings {
  return {
    behavioralLearningEnabled: typeof value?.behavioralLearningEnabled === "boolean" ? value.behavioralLearningEnabled : DEFAULT_USER_MEMORY_SETTINGS.behavioralLearningEnabled,
    journalCoachingEnabled: typeof value?.journalCoachingEnabled === "boolean" ? value.journalCoachingEnabled : DEFAULT_USER_MEMORY_SETTINGS.journalCoachingEnabled,
    updatedAt: typeof value?.updatedAt === "string" ? value.updatedAt : DEFAULT_USER_MEMORY_SETTINGS.updatedAt,
  };
}
