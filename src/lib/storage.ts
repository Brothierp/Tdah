import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Toutes les données sont stockées localement sur l'appareil.
 * Les données de chaque compte sont isolées par un préfixe propre à l'utilisateur.
 */
const PREFIX = 'focus:';

export const keys = {
  users: `${PREFIX}users`,
  session: `${PREFIX}session`,
  tasks: (userId: string) => `${PREFIX}user:${userId}:tasks`,
  settings: (userId: string) => `${PREFIX}user:${userId}:settings`,
};

export async function readJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function writeJSON(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function removeKeys(...k: string[]): Promise<void> {
  await AsyncStorage.multiRemove(k);
}
