/**
 * 埋点状态管理
 * 用于管理会话信息和用户关联
 */
import { create } from 'zustand';
import { tracker } from '../utils/tracker';

interface TrackerState {
  sessionId: string;
  isInitialized: boolean;
  pageViewHistory: string[];
  initTracker: () => void;
  setUserId: (userId: string | null) => void;
  trackPageView: (pageUrl: string, pageTitle: string) => void;
}

export const useTrackerStore = create<TrackerState>((set, get) => ({
  sessionId: '',
  isInitialized: false,
  pageViewHistory: [],

  initTracker: () => {
    if (get().isInitialized) return;

    const sessionId = sessionStorage.getItem('pg_session_id') || '';
    set({ sessionId, isInitialized: true });
  },

  setUserId: (userId: string | null) => {
    tracker.setUserId(userId);
  },

  trackPageView: (pageUrl: string, pageTitle: string) => {
    const history = get().pageViewHistory;

    if (!history.includes(pageUrl)) {
      tracker.trackPageView({
        page_url: pageUrl,
        page_title: pageTitle,
        referrer: document.referrer,
      });

      set({ pageViewHistory: [...history, pageUrl] });
    }
  },
}));
