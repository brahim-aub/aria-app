import Storage from 'expo-sqlite/kv-store';
import type { StateStorage } from 'zustand/middleware';

/** Sur Android, l'état est stocké dans SQLite sur le téléphone. */
export const appStorage: StateStorage = Storage;
