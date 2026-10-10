import type { StateStorage } from 'zustand/middleware';

/** Sur le web (tests dans le navigateur), l'état est stocké dans le localStorage. */
export const appStorage: StateStorage = {
  getItem: (name) => (typeof localStorage === 'undefined' ? null : localStorage.getItem(name)),
  setItem: (name, value) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(name, value);
  },
  removeItem: (name) => {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(name);
  },
};
