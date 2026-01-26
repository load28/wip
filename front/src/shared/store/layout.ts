import { atom } from 'jotai';

export const sidebarOpenAtom = atom(true);
export const sidebarWidthAtom = atom(240);

export const toggleSidebarAtom = atom(null, (get, set) => {
  set(sidebarOpenAtom, !get(sidebarOpenAtom));
});
