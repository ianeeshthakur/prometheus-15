// Shell + accessibility state (docs/frontend.md §1, §3.0). Zustand chosen over
// Context/Redux -- see docs/prd.md §15 decision log.
import { create } from "zustand";

export type FontStep = 0 | 1 | 2; // three fixed steps, per docs/frontend.md §1
export type Language = "EN" | "HI" | "GU";
export type ColorScheme = "light" | "dark";

interface UiState {
  sidebarCollapsed: boolean;
  fontStep: FontStep;
  language: Language;
  highContrast: boolean;
  colorScheme: ColorScheme;
  toggleSidebar: () => void;
  increaseFontStep: () => void;
  decreaseFontStep: () => void;
  setLanguage: (lang: Language) => void;
  toggleHighContrast: () => void;
  toggleColorScheme: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  fontStep: 1,
  language: "EN",
  highContrast: false,
  colorScheme: "light",
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  increaseFontStep: () =>
    set((s) => ({ fontStep: (Math.min(2, s.fontStep + 1) as FontStep) })),
  decreaseFontStep: () =>
    set((s) => ({ fontStep: (Math.max(0, s.fontStep - 1) as FontStep) })),
  setLanguage: (language) => set({ language }),
  toggleHighContrast: () => set((s) => ({ highContrast: !s.highContrast })),
  toggleColorScheme: () =>
    set((s) => ({ colorScheme: s.colorScheme === "light" ? "dark" : "light" })),
}));
