/**
 * 埋点 Hook
 * 提供便捷的埋点功能调用方式
 */
import { useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  tracker,
  ClickData,
  ReviewData,
  KBDocumentData,
  KBCategoryData,
  KBSearchData,
  SettingsData,
  ReviewFlowData,
  UIActionData,
  PerformanceSampleData,
} from '../utils/tracker';
import { useTrackerStore } from '../stores/tracker';
import { useAuthStore } from '../stores/auth';

export function useTrack() {
  const { trackPageView, initTracker } = useTrackerStore();
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  useEffect(() => {
    initTracker();
    if (user?.id) {
      tracker.setUserId(user.id);
    }
  }, [user?.id, initTracker]);

  useEffect(() => {
    const path = location.pathname;
    const title = getPageTitle(path);
    trackPageView(path, title);
  }, [location.pathname, trackPageView]);

  const handleClick = useCallback(
    (data: ClickData) => {
      tracker.trackClick(data);
    },
    []
  );

  const trackDocumentUpload = useCallback((data: ReviewData) => {
    tracker.trackDocumentUpload(data);
  }, []);

  const trackReviewSubmit = useCallback((data: ReviewData) => {
    tracker.trackReviewSubmit(data);
  }, []);

  const trackReviewComplete = useCallback(
    (data: ReviewData & { success: boolean; duration_ms: number }) => {
      tracker.trackReviewComplete(data);
    },
    []
  );

  const trackSearch = useCallback((query: string, resultCount: number) => {
    tracker.trackSearch(query, resultCount);
  }, []);

  const trackLogin = useCallback((method: string, success: boolean) => {
    tracker.trackLogin(method, success);
  }, []);

  const trackLogout = useCallback(() => {
    tracker.trackLogout();
  }, []);

  const trackError = useCallback(
    (errorType: string, errorMessage: string, context?: Record<string, any>) => {
      tracker.trackError(errorType, errorMessage, context);
    },
    []
  );

  const trackCustom = useCallback(
    (eventName: string, properties?: Record<string, any>) => {
      tracker.track({
        event_name: eventName,
        event_category: 'custom',
        properties,
      });
    },
    []
  );

  // ===== 新增：知识库相关埋点 =====
  const trackKBDocumentView = useCallback((data: KBDocumentData) => {
    tracker.trackKBDocumentView(data);
  }, []);

  const trackKBDocumentDelete = useCallback((data: KBDocumentData) => {
    tracker.trackKBDocumentDelete(data);
  }, []);

  const trackKBCategoryCreate = useCallback((data: KBCategoryData) => {
    tracker.trackKBCategoryCreate(data);
  }, []);

  const trackKBCategoryDelete = useCallback((data: KBCategoryData) => {
    tracker.trackKBCategoryDelete(data);
  }, []);

  const trackKBSearch = useCallback((data: KBSearchData) => {
    tracker.trackKBSearch(data);
  }, []);

  const trackKBUpload = useCallback((data: KBDocumentData) => {
    tracker.trackKBUpload(data);
  }, []);

  // ===== 新增：系统设置相关埋点 =====
  const trackSettingsSave = useCallback((data: SettingsData) => {
    tracker.trackSettingsSave(data);
  }, []);

  const trackSettingsTest = useCallback((data: SettingsData) => {
    tracker.trackSettingsTest(data);
  }, []);

  // ===== 新增：审查流程扩展埋点 =====
  const trackReviewTypeSelect = useCallback((data: { review_type?: string }) => {
    tracker.trackReviewTypeSelect(data);
  }, []);

  const trackReviewFileSelect = useCallback((data: ReviewFlowData) => {
    tracker.trackReviewFileSelect(data);
  }, []);

  const trackReviewViewResult = useCallback((data: ReviewFlowData) => {
    tracker.trackReviewViewResult(data);
  }, []);

  const trackReviewDownload = useCallback((data: ReviewFlowData) => {
    tracker.trackReviewDownload(data);
  }, []);

  const trackReviewShare = useCallback((data: ReviewFlowData) => {
    tracker.trackReviewShare(data);
  }, []);

  // ===== 新增：用户交互扩展埋点 =====
  const trackUIAction = useCallback((data: UIActionData) => {
    tracker.trackUIAction(data);
  }, []);

  const trackDropdownSelect = useCallback((data: UIActionData) => {
    tracker.trackDropdownSelect(data);
  }, []);

  const trackModalOpen = useCallback((data: { modal_id?: string; modal_title?: string; page_url?: string }) => {
    tracker.trackModalOpen(data);
  }, []);

  const trackModalClose = useCallback((data: { modal_id?: string; modal_title?: string; page_url?: string }) => {
    tracker.trackModalClose(data);
  }, []);

  const trackExport = useCallback((data: { export_type?: string; format?: string; record_count?: number }) => {
    tracker.trackExport(data);
  }, []);

  // ===== 新增：性能采样埋点 =====
  const trackPerformance = useCallback((data: PerformanceSampleData) => {
    tracker.trackPerformance(data);
  }, []);

  // ===== 新增：表单验证错误 =====
  const trackValidationError = useCallback((data: { form_name?: string; field_name?: string; error_message?: string; page_url?: string }) => {
    tracker.trackValidationError(data);
  }, []);

  // ===== 新增：上传错误 =====
  const trackUploadError = useCallback((data: { error_type?: string; file_name?: string; file_type?: string; error_message?: string }) => {
    tracker.trackUploadError(data);
  }, []);

  // ===== 新增：搜索无结果 =====
  const trackSearchNoResult = useCallback((data: { query?: string; search_scope?: string }) => {
    tracker.trackSearchNoResult(data);
  }, []);

  return {
    handleClick,
    trackDocumentUpload,
    trackReviewSubmit,
    trackReviewComplete,
    trackSearch,
    trackLogin,
    trackLogout,
    trackError,
    trackCustom,
    // 知识库相关
    trackKBDocumentView,
    trackKBDocumentDelete,
    trackKBCategoryCreate,
    trackKBCategoryDelete,
    trackKBSearch,
    trackKBUpload,
    // 系统设置相关
    trackSettingsSave,
    trackSettingsTest,
    // 审查流程扩展
    trackReviewTypeSelect,
    trackReviewFileSelect,
    trackReviewViewResult,
    trackReviewDownload,
    trackReviewShare,
    // 用户交互扩展
    trackUIAction,
    trackDropdownSelect,
    trackModalOpen,
    trackModalClose,
    trackExport,
    // 性能采样
    trackPerformance,
    // 错误埋点
    trackValidationError,
    trackUploadError,
    trackSearchNoResult,
  };
}

function getPageTitle(path: string): string {
  const titles: Record<string, string> = {
    '/': '工作台',
    '/admin': '工作台',
    '/admin/knowledge': '知识库管理',
    '/admin/settings': '系统设置',
    '/review': '文档审查',
    '/history': '历史记录',
    '/login': '登录',
  };

  return titles[path] || '未知页面';
}

export function useAutoTrackClick(containerId?: string) {
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!containerId) return;

    const container = document.getElementById(containerId);
    if (!container) return;

    containerRef.current = container;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const button = target.closest('button, a, [data-track]') as HTMLElement;

      if (button) {
        const data: ClickData = {
          element_id: button.id || button.getAttribute('data-track-id') || undefined,
          element_text: button.textContent?.trim() || undefined,
          element_class: button.className,
          page_url: window.location.pathname,
        };

        tracker.trackClick(data);
      }
    };

    container.addEventListener('click', handleClick);

    return () => {
      container.removeEventListener('click', handleClick);
    };
  }, [containerId]);
}

export function usePageLeave() {
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    startTimeRef.current = Date.now();

    return () => {
      const duration = Date.now() - startTimeRef.current;
      if (duration > 1000) {
        tracker.track({
          event_name: 'page_stay',
          event_category: 'navigation',
          properties: {
            page_url: window.location.pathname,
            duration_ms: duration,
          },
        });
      }
    };
  }, []);
}
