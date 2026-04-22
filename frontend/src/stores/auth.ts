import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEMO_PREVIEW_TOKEN, ENABLE_DEMO_MODE } from '../constants/auth';
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
      user: ENABLE_DEMO_MODE ? defaultUser : null,
      token: ENABLE_DEMO_MODE ? DEMO_PREVIEW_TOKEN : null,
      isAuthenticated: ENABLE_DEMO_MODE,
      setAuth: (user, token) => {
        localStorage.setItem('token', token);
        set({ user, token, isAuthenticated: true });
      },
      logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (ENABLE_DEMO_MODE) {
          set({ user: defaultUser, token: DEMO_PREVIEW_TOKEN, isAuthenticated: true });
          localStorage.setItem('token', DEMO_PREVIEW_TOKEN);
        } else {
          set({ user: null, token: null, isAuthenticated: false });
        }
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
