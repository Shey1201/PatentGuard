import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AppViewMode = 'admin' | 'user';

interface AppModeState {
  /** 演示/视图模式：管理员后台 vs 普通用户前台 */
  viewMode: AppViewMode;
  setViewMode: (mode: AppViewMode) => void;
}

export const useAppModeStore = create<AppModeState>()(
  persist(
    (set) => ({
      viewMode: 'user',
      setViewMode: (viewMode) => set({ viewMode }),
    }),
    { name: 'patentguard-app-mode' }
  )
);
