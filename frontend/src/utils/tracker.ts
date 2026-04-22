/**
 * 数据埋点 SDK
 * 用于采集用户行为数据和业务事件
 */

import axios from 'axios';

export interface TrackEvent {
  event_name: string;
  event_category?: string;
  session_id?: string;
  resource_id?: string;
  properties?: Record<string, any>;
  system_info?: SystemInfo;
}

export interface SystemInfo {
  device?: string;
  browser?: string;
  os?: string;
  screen_size?: string;
  language?: string;
  timezone?: string;
}

export interface PageViewData {
  page_url: string;
  page_title: string;
  referrer?: string;
  search_query?: string;
}

export interface ClickData {
  element_id?: string;
  element_text?: string;
  element_class?: string;
  page_url: string;
}

export interface ReviewData {
  document_id?: string;
  document_name?: string;
  review_type?: string;
  file_size?: number;
  file_type?: string;
}

// ===== 新增：知识库相关类型 =====
export interface KBDocumentData {
  document_id?: string;
  document_name?: string;
  category_id?: string;
  category_name?: string;
  file_size?: number;
  file_type?: string;
}

export interface KBCategoryData {
  category_id?: string;
  category_name?: string;
  type?: string;
}

export interface KBSearchData {
  query?: string;
  result_count?: number;
  search_scope?: 'all' | 'category';
  category_id?: string;
}

// ===== 新增：系统设置相关类型 =====
export interface SettingsData {
  config_type: 'llm' | 'embedding' | 'api_key';
  provider?: string;
  model?: string;
  success?: boolean;
  duration_ms?: number;
}

// ===== 新增：审查流程扩展类型 =====
export interface ReviewFlowData {
  document_id?: string;
  document_name?: string;
  review_type?: string;
  step: 'type_select' | 'file_select' | 'submit' | 'processing' | 'complete' | 'view_result' | 'download' | 'share';
  file_size?: number;
  file_type?: string;
  duration_ms?: number;
  success?: boolean;
}

// ===== 新增：用户交互类型 =====
export interface UIActionData {
  element_id?: string;
  element_text?: string;
  action_type?: 'dropdown_select' | 'filter_apply' | 'export' | 'modal_open' | 'modal_close' | 'tab_switch' | 'pagination';
  page_url?: string;
  extra?: Record<string, any>;
}

// ===== 新增：系统性能采样类型 =====
export interface PerformanceSampleData {
  page_url?: string;
  fcp?: number;     // First Contentful Paint
  lcp?: number;     // Largest Contentful Paint
  fid?: number;     // First Input Delay
  cls?: number;     // Cumulative Layout Shift
  ttfb?: number;    // Time To First Byte
}

const API_BASE_URL = '/api/v1';

class Tracker {
  private sessionId: string;
  private queue: TrackEvent[] = [];
  private flushInterval: number = 5000;
  private maxQueueSize: number = 20;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private isSending: boolean = false;

  constructor() {
    this.sessionId = this.getOrCreateSessionId();
    this.initSystemInfo();
    this.startFlushTimer();
    this.setupBeforeUnload();
  }

  private getOrCreateSessionId(): string {
    let sessionId = sessionStorage.getItem('pg_session_id');
    if (!sessionId) {
      sessionId = `s_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      sessionStorage.setItem('pg_session_id', sessionId);
    }
    return sessionId;
  }

  private initSystemInfo(): void {
    const info = this.getSystemInfo();
    sessionStorage.setItem('pg_system_info', JSON.stringify(info));
  }

  private getSystemInfo(): SystemInfo {
    let browser = 'Unknown';
    let os = 'Unknown';
    let device = 'Desktop';

    if (navigator.userAgent.match(/Edg/)) browser = 'Edge';
    else if (navigator.userAgent.match(/Chrome/)) browser = 'Chrome';
    else if (navigator.userAgent.match(/Firefox/)) browser = 'Firefox';
    else if (navigator.userAgent.match(/Safari/)) browser = 'Safari';

    if (navigator.userAgent.match(/Windows/)) os = 'Windows';
    else if (navigator.userAgent.match(/Mac/)) os = 'macOS';
    else if (navigator.userAgent.match(/Linux/)) os = 'Linux';
    else if (navigator.userAgent.match(/Android/)) {
      os = 'Android';
      device = 'Mobile';
    } else if (navigator.userAgent.match(/iPhone|iPad/)) {
      os = 'iOS';
      device = navigator.userAgent.match(/iPad/) ? 'Tablet' : 'Mobile';
    }

    return {
      device,
      browser,
      os,
      screen_size: `${window.screen.width}x${window.screen.height}`,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }

  private startFlushTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.flush();
      this.startFlushTimer();
    }, this.flushInterval);
  }

  private setupBeforeUnload(): void {
    window.addEventListener('beforeunload', () => {
      this.flush(true);
    });
  }

  setUserId(userId: string | null): void {
    if (userId) {
      sessionStorage.setItem('pg_user_id', userId);
    } else {
      sessionStorage.removeItem('pg_user_id');
    }
  }

  track(event: TrackEvent): void {
    const enrichedEvent: TrackEvent = {
      ...event,
      session_id: event.session_id || this.sessionId,
      system_info: event.system_info || this.getSystemInfo(),
      properties: {
        ...(event.properties || {}),
        user_id: sessionStorage.getItem('pg_user_id') || undefined,
      },
    };

    this.queue.push(enrichedEvent);

    if (this.queue.length >= this.maxQueueSize) {
      this.flush();
    }
  }

  trackPageView(data: PageViewData): void {
    this.track({
      event_name: 'page_view',
      event_category: 'navigation',
      properties: {
        page_url: data.page_url,
        page_title: data.page_title,
        referrer: data.referrer,
        search_query: data.search_query,
      },
    });
  }

  trackClick(data: ClickData): void {
    this.track({
      event_name: 'button_click',
      event_category: 'user_action',
      properties: {
        element_id: data.element_id,
        element_text: data.element_text,
        element_class: data.element_class,
        page_url: data.page_url,
      },
    });
  }

  trackDocumentUpload(data: ReviewData): void {
    this.track({
      event_name: 'document_upload',
      event_category: 'business',
      properties: {
        document_id: data.document_id,
        document_name: data.document_name,
        review_type: data.review_type,
        file_size: data.file_size,
        file_type: data.file_type,
      },
    });
  }

  trackReviewSubmit(data: ReviewData): void {
    this.track({
      event_name: 'review_submit',
      event_category: 'business',
      resource_id: data.document_id,
      properties: {
        document_id: data.document_id,
        document_name: data.document_name,
        review_type: data.review_type,
      },
    });
  }

  trackReviewComplete(data: ReviewData & { success: boolean; duration_ms: number }): void {
    this.track({
      event_name: 'review_complete',
      event_category: 'business',
      resource_id: data.document_id,
      properties: {
        document_id: data.document_id,
        document_name: data.document_name,
        review_type: data.review_type,
        success: data.success,
        duration_ms: data.duration_ms,
      },
    });
  }

  trackSearch(query: string, resultCount: number): void {
    this.track({
      event_name: 'search_action',
      event_category: 'user_action',
      properties: {
        query,
        result_count: resultCount,
      },
    });
  }

  trackLogin(method: string, success: boolean): void {
    this.track({
      event_name: 'login',
      event_category: 'user_action',
      properties: {
        method,
        success,
      },
    });
  }

  trackLogout(): void {
    this.track({
      event_name: 'logout',
      event_category: 'user_action',
    });
  }

  trackError(errorType: string, errorMessage: string, context?: Record<string, any>): void {
    this.track({
      event_name: 'error',
      event_category: 'system',
      properties: {
        error_type: errorType,
        error_message: errorMessage,
        ...context,
      },
    });
  }

  // ===== 新增：知识库相关埋点 =====
  trackKBDocumentView(data: KBDocumentData): void {
    this.track({
      event_name: 'kb_document_view',
      event_category: 'user_action',
      resource_id: data.document_id,
      properties: {
        document_id: data.document_id,
        document_name: data.document_name,
        category_id: data.category_id,
        category_name: data.category_name,
        file_type: data.file_type,
      },
    });
  }

  trackKBDocumentDelete(data: KBDocumentData): void {
    this.track({
      event_name: 'kb_document_delete',
      event_category: 'user_action',
      resource_id: data.document_id,
      properties: {
        document_id: data.document_id,
        document_name: data.document_name,
        category_id: data.category_id,
        file_size: data.file_size,
      },
    });
  }

  trackKBCategoryCreate(data: KBCategoryData): void {
    this.track({
      event_name: 'kb_category_create',
      event_category: 'user_action',
      resource_id: data.category_id,
      properties: {
        category_id: data.category_id,
        category_name: data.category_name,
        type: data.type,
      },
    });
  }

  trackKBCategoryDelete(data: KBCategoryData): void {
    this.track({
      event_name: 'kb_category_delete',
      event_category: 'user_action',
      resource_id: data.category_id,
      properties: {
        category_id: data.category_id,
        category_name: data.category_name,
        type: data.type,
      },
    });
  }

  trackKBSearch(data: KBSearchData): void {
    this.track({
      event_name: 'kb_search',
      event_category: 'user_action',
      properties: {
        query: data.query,
        result_count: data.result_count,
        search_scope: data.search_scope,
        category_id: data.category_id,
        has_results: (data.result_count ?? 0) > 0,
      },
    });
  }

  trackKBUpload(data: KBDocumentData): void {
    this.track({
      event_name: 'kb_upload',
      event_category: 'business',
      resource_id: data.document_id,
      properties: {
        document_id: data.document_id,
        document_name: data.document_name,
        category_id: data.category_id,
        category_name: data.category_name,
        file_size: data.file_size,
        file_type: data.file_type,
      },
    });
  }

  // ===== 新增：系统设置相关埋点 =====
  trackSettingsSave(data: SettingsData): void {
    this.track({
      event_name: 'settings_save',
      event_category: 'system',
      properties: {
        config_type: data.config_type,
        provider: data.provider,
        model: data.model,
        success: data.success,
        duration_ms: data.duration_ms,
      },
    });
  }

  trackSettingsTest(data: SettingsData): void {
    this.track({
      event_name: 'settings_test',
      event_category: 'system',
      properties: {
        config_type: data.config_type,
        provider: data.provider,
        success: data.success,
        duration_ms: data.duration_ms,
      },
    });
  }

  // ===== 新增：审查流程扩展埋点 =====
  trackReviewTypeSelect(data: { review_type?: string }): void {
    this.track({
      event_name: 'review_type_select',
      event_category: 'user_action',
      properties: {
        review_type: data.review_type,
      },
    });
  }

  trackReviewFileSelect(data: ReviewFlowData): void {
    this.track({
      event_name: 'review_file_select',
      event_category: 'user_action',
      properties: {
        document_name: data.document_name,
        review_type: data.review_type,
        file_size: data.file_size,
        file_type: data.file_type,
      },
    });
  }

  trackReviewViewResult(data: ReviewFlowData): void {
    this.track({
      event_name: 'review_view_result',
      event_category: 'business',
      resource_id: data.document_id,
      properties: {
        document_id: data.document_id,
        document_name: data.document_name,
        review_type: data.review_type,
        duration_ms: data.duration_ms,
      },
    });
  }

  trackReviewDownload(data: ReviewFlowData): void {
    this.track({
      event_name: 'review_download',
      event_category: 'business',
      resource_id: data.document_id,
      properties: {
        document_id: data.document_id,
        document_name: data.document_name,
        review_type: data.review_type,
      },
    });
  }

  trackReviewShare(data: ReviewFlowData): void {
    this.track({
      event_name: 'review_share',
      event_category: 'business',
      resource_id: data.document_id,
      properties: {
        document_id: data.document_id,
        document_name: data.document_name,
        review_type: data.review_type,
      },
    });
  }

  // ===== 新增：用户交互扩展埋点 =====
  trackUIAction(data: UIActionData): void {
    this.track({
      event_name: 'ui_action',
      event_category: 'user_action',
      properties: {
        element_id: data.element_id,
        element_text: data.element_text,
        action_type: data.action_type,
        page_url: data.page_url,
        ...data.extra,
      },
    });
  }

  trackDropdownSelect(data: UIActionData): void {
    this.track({
      event_name: 'dropdown_select',
      event_category: 'user_action',
      properties: {
        element_id: data.element_id,
        element_text: data.element_text,
        page_url: data.page_url,
        ...data.extra,
      },
    });
  }

  trackModalOpen(data: { modal_id?: string; modal_title?: string; page_url?: string }): void {
    this.track({
      event_name: 'modal_open',
      event_category: 'user_action',
      properties: {
        modal_id: data.modal_id,
        modal_title: data.modal_title,
        page_url: data.page_url,
      },
    });
  }

  trackModalClose(data: { modal_id?: string; modal_title?: string; page_url?: string }): void {
    this.track({
      event_name: 'modal_close',
      event_category: 'user_action',
      properties: {
        modal_id: data.modal_id,
        modal_title: data.modal_title,
        page_url: data.page_url,
      },
    });
  }

  trackExport(data: { export_type?: string; format?: string; record_count?: number }): void {
    this.track({
      event_name: 'export_action',
      event_category: 'user_action',
      properties: {
        export_type: data.export_type,
        format: data.format,
        record_count: data.record_count,
      },
    });
  }

  // ===== 新增：性能采样埋点 =====
  trackPerformance(data: PerformanceSampleData): void {
    this.track({
      event_name: 'performance_sample',
      event_category: 'system',
      properties: {
        page_url: data.page_url,
        fcp: data.fcp,
        lcp: data.lcp,
        fid: data.fid,
        cls: data.cls,
        ttfb: data.ttfb,
      },
    });
  }

  // ===== 新增：表单验证错误 =====
  trackValidationError(data: { form_name?: string; field_name?: string; error_message?: string; page_url?: string }): void {
    this.track({
      event_name: 'validation_error',
      event_category: 'system',
      properties: {
        form_name: data.form_name,
        field_name: data.field_name,
        error_message: data.error_message,
        page_url: data.page_url,
      },
    });
  }

  // ===== 新增：上传错误 =====
  trackUploadError(data: { error_type?: string; file_name?: string; file_type?: string; error_message?: string }): void {
    this.track({
      event_name: 'upload_error',
      event_category: 'system',
      properties: {
        error_type: data.error_type,
        file_name: data.file_name,
        file_type: data.file_type,
        error_message: data.error_message,
      },
    });
  }

  // ===== 新增：搜索无结果 =====
  trackSearchNoResult(data: { query?: string; search_scope?: string }): void {
    this.track({
      event_name: 'search_no_result',
      event_category: 'user_action',
      properties: {
        query: data.query,
        search_scope: data.search_scope,
      },
    });
  }

  private async flush(sync: boolean = false): Promise<void> {
    if (this.queue.length === 0 || this.isSending) return;

    this.isSending = true;
    const events = [...this.queue];
    this.queue = [];

    try {
      if (sync) {
        await this.sendEventsSync(events);
      } else {
        await this.sendEvents(events);
      }
    } catch (error) {
      this.queue = [...events, ...this.queue];
    } finally {
      this.isSending = false;
    }
  }

  private async sendEvents(events: TrackEvent[]): Promise<void> {
    await axios.post(`${API_BASE_URL}/track/events/batch`, { events }, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  private async sendEventsSync(events: TrackEvent[]): Promise<void> {
    await navigator.sendBeacon(
      `${API_BASE_URL}/track/events/batch`,
      JSON.stringify({ events })
    );
  }

  destroy(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.flush(true);
  }
}

export const tracker = new Tracker();

export default tracker;
