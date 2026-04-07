import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEMO_PREVIEW_TOKEN } from '../constants/auth';
import { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

// 默认演示用户
const defaultUser: User = {
  id: 'demo-user-id',
  email: 'demo@patentguard.local',
  username: '演示用户',
  role: 'admin',
  is_active: true,
  created_at: new Date().toISOString(),
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: defaultUser,
      token: DEMO_PREVIEW_TOKEN,
      isAuthenticated: true, // 默认已登录，方便预览
      setAuth: (user, token) => {
        localStorage.setItem('token', token);
        set({ user, token, isAuthenticated: true });
      },
      logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // 预览模式下登出后重新设置默认用户
        set({ user: defaultUser, token: DEMO_PREVIEW_TOKEN, isAuthenticated: true });
        localStorage.setItem('token', DEMO_PREVIEW_TOKEN);
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          try {
            localStorage.setItem('token', state.token);
          } catch (_) {
            /* ignore */
          }
        }
      },
    }
  )
);
