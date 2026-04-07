/**
 * 管理员数据可视化组件
 * 包含用户活跃趋势、审查漏斗、类型分布、风险分布、API 性能等图表
 */
import React, { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, Spin } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { trackingApi } from '../services/api';
import { useTrack } from '../hooks/useTrack';

const COLORS = {
  primary: '#7c3aed',
  success: '#16a34a',
  warning: '#d97706',
  danger: '#dc2626',
  info: '#2563eb',
  gray: '#6b7280',
};

// 趋势数据项
interface DailyTrendItem {
  date: string;
  dau?: number;
  page_views?: number;
  reviews?: number;
  uploads?: number;
  searches?: number;
}

// 漏斗数据项
interface FunnelItem {
  step: string;
  count: number;
  rate: number;
}

// 分布数据项
interface DistributionItem {
  name: string;
  value: number;
  color?: string;
}

// API 性能数据项
interface APIPerfItem {
  endpoint: string;
  avg_ms: number;
  p50_ms: number;
  p95_ms: number;
  call_count: number;
}

// ===== 迷你趋势指示器 =====
const TrendBadge: React.FC<{ value: number; suffix?: string }> = ({ value, suffix }) => {
  const isPositive = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full ${
        isPositive ? 'text-emerald-600 bg-emerald-50' : 'text-red-500 bg-red-50'
      }`}
    >
      {isPositive ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
      {Math.abs(value).toFixed(1)}%{suffix}
    </span>
  );
};

// ===== 用户活跃趋势图 =====
const UserActivityChart: React.FC<{ data: DailyTrendItem[]; loading?: boolean }> = ({
  data,
  loading,
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Spin size="small" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        暂无活跃趋势数据
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickFormatter={(v) => dayjs(v).format('MM-DD')}
        />
        <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} width={30} />
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: '1px solid #f0f0f0',
            fontSize: 12,
          }}
          labelFormatter={(v) => dayjs(v as string).format('YYYY-MM-DD')}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line
          type="monotone"
          dataKey="dau"
          name="活跃用户"
          stroke={COLORS.primary}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="page_views"
          name="页面浏览"
          stroke={COLORS.info}
          strokeWidth={2}
          dot={false}
          strokeDasharray="5 5"
        />
        <Line
          type="monotone"
          dataKey="reviews"
          name="审查完成"
          stroke={COLORS.success}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

// ===== 审查流程漏斗图 =====
const ReviewFunnelChart: React.FC<{ data: FunnelItem[]; loading?: boolean }> = ({
  data,
  loading,
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Spin size="small" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        暂无漏斗数据
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} />
        <YAxis
          type="category"
          dataKey="step"
          tick={{ fontSize: 12, fill: '#4b5563' }}
          width={60}
        />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => [
            name === 'rate' ? `${value}%` : value,
            name === 'count' ? '数量' : '转化率',
          ]}
        />
        <Bar dataKey="count" name="count" fill={COLORS.primary} radius={[0, 4, 4, 0]}>
          {data.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={`rgba(124, 58, 237, ${1 - index * 0.15})`}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

// ===== 饼图组件 =====
const DistributionPieChart: React.FC<{
  data: DistributionItem[];
  loading?: boolean;
  centerLabel?: string;
}> = ({ data, loading, centerLabel }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Spin size="small" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
        暂无数据
      </div>
    );
  }

  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={70}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color || COLORS.primary} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: '1px solid #f0f0f0',
              fontSize: 12,
            }}
            formatter={(value: any) => [
              `${value} (${total > 0 ? ((value / total) * 100).toFixed(1) : 0}%)`,
              '数量',
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
      {centerLabel && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-lg font-bold text-gray-800">{total}</div>
            <div className="text-xs text-gray-400">{centerLabel}</div>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2 justify-center mt-2">
        {data.map((item, index) => (
          <div key={index} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: item.color || COLORS.primary }}
            />
            <span className="text-xs text-gray-500">
              {item.name}{' '}
              <span className="font-medium">
                {total > 0 ? ((item.value / total) * 100).toFixed(0) : 0}%
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ===== API 性能柱状图 =====
const APIPerformanceChart: React.FC<{ data: APIPerfItem[]; loading?: boolean }> = ({
  data,
  loading,
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Spin size="small" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        暂无 API 性能数据
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data.slice(0, 6)} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="endpoint"
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          tickFormatter={(v) => v.split('/').pop() || v}
        />
        <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} width={40} />
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: '1px solid #f0f0f0',
            fontSize: 12,
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => {
            const labels: Record<string, string> = {
              avg_ms: '平均响应',
              p50_ms: 'P50',
              p95_ms: 'P95',
              call_count: '调用次数',
            };
            return [`${value}${name.includes('ms') ? 'ms' : ''}`, labels[name] || name];
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="avg_ms" name="avg_ms" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
        <Bar dataKey="p95_ms" name="p95_ms" fill={COLORS.warning} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

// ===== 主组件：管理员数据看板 =====
interface AdminStatsChartsProps {
  dateRange?: [dayjs.Dayjs, dayjs.Dayjs];
  onDateRangeChange?: (range: [dayjs.Dayjs, dayjs.Dayjs]) => void;
}

interface DailyTrendItem {
  date: string;
  dau?: number;
  page_views?: number;
  reviews?: number;
  uploads?: number;
  searches?: number;
}

const AdminStatsCharts: React.FC<AdminStatsChartsProps> = () => {
  const { trackPerformance } = useTrack();

  const [loading, setLoading] = useState(true);
  const [trendData, setTrendData] = useState<DailyTrendItem[]>([]);
  const [funnelData, setFunnelData] = useState<FunnelItem[]>([]);
  const [reviewTypeData, setReviewTypeData] = useState<DistributionItem[]>([]);
  const [riskData, setRiskData] = useState<DistributionItem[]>([]);
  const [apiPerfData, setApiPerfData] = useState<APIPerfItem[]>([]);
  const [quickRange, setQuickRange] = useState<string>('7d');

  // 计算对比期增长率
  const [dauGrowth, setDauGrowth] = useState(0);
  const [reviewGrowth, setReviewGrowth] = useState(0);
  const [uploadGrowth, setUploadGrowth] = useState(0);

  // 加载数据
  const loadData = async () => {
    setLoading(true);
    const startDate = dayjs()
      .subtract(quickRange === '7d' ? 7 : quickRange === '30d' ? 30 : 14, 'day')
      .format('YYYY-MM-DD');
    const endDate = dayjs().format('YYYY-MM-DD');

    // 上一个周期的日期范围
    const prevStartDate = dayjs()
      .subtract(quickRange === '7d' ? 14 : quickRange === '30d' ? 60 : 28, 'day')
      .format('YYYY-MM-DD');
    const prevEndDate = dayjs()
      .subtract(quickRange === '7d' ? 8 : quickRange === '30d' ? 31 : 15, 'day')
      .format('YYYY-MM-DD');

    try {
      // 并行加载多个数据源
      const [trendRes, funnelRes, reviewTypeRes, riskRes, apiPerfRes] = await Promise.allSettled([
        trackingApi.getDailyTrend({ start_date: startDate, end_date: endDate }),
        trackingApi.getFunnelData({ start_date: startDate, end_date: endDate }),
        trackingApi.getReviewTypeDistribution({ start_date: startDate, end_date: endDate }),
        trackingApi.getRiskDistribution({ start_date: startDate, end_date: endDate }),
        trackingApi.getAPIPerformance({ start_date: startDate, end_date: endDate }),
      ]);

      // 处理趋势数据
      if (trendRes.status === 'fulfilled' && trendRes.value.data) {
        setTrendData(trendRes.value.data.trend || []);

        // 计算增长率
        const currentData = trendRes.value.data.trend || [];
        const prevRes = await trackingApi
          .getDailyTrend({ start_date: prevStartDate, end_date: prevEndDate })
          .catch(() => ({ data: { trend: [] } }));
        const prevData = prevRes.data?.trend || [];

        const calcGrowth = (curr: number, prev: number) => {
          if (prev === 0) return curr > 0 ? 100 : 0;
          return ((curr - prev) / prev) * 100;
        };

        const currDau = currentData.reduce((s: number, i: DailyTrendItem) => s + (i.dau || 0), 0);
        const prevDau = prevData.reduce((s: number, i: DailyTrendItem) => s + (i.dau || 0), 0);
        const currReviews = currentData.reduce((s: number, i: DailyTrendItem) => s + (i.reviews || 0), 0);
        const prevReviews = prevData.reduce((s: number, i: DailyTrendItem) => s + (i.reviews || 0), 0);
        const currUploads = currentData.reduce((s: number, i: DailyTrendItem) => s + (i.uploads || 0), 0);
        const prevUploads = prevData.reduce((s: number, i: DailyTrendItem) => s + (i.uploads || 0), 0);

        setDauGrowth(calcGrowth(currDau, prevDau));
        setReviewGrowth(calcGrowth(currReviews, prevReviews));
        setUploadGrowth(calcGrowth(currUploads, prevUploads));
      }

      // 处理漏斗数据
      if (funnelRes.status === 'fulfilled' && funnelRes.value.data) {
        setFunnelData(funnelRes.value.data.funnel || []);
      }

      // 处理审查类型分布
      if (reviewTypeRes.status === 'fulfilled' && reviewTypeRes.value.data) {
        const types = reviewTypeRes.value.data.distribution || [];
        const colorMap: Record<string, string> = {
          patent: COLORS.primary,
          contract: COLORS.info,
          trademark: COLORS.success,
          copyright: COLORS.warning,
          other: COLORS.gray,
        };
        setReviewTypeData(
          types.map((t: any) => ({
            name: t.name,
            value: t.value,
            color: colorMap[t.name] || COLORS.primary,
          }))
        );
      }

      // 处理风险分布
      if (riskRes.status === 'fulfilled' && riskRes.value.data) {
        const risks = riskRes.value.data.distribution || [];
        setRiskData(
          risks.map((r: any) => ({
            name: r.name,
            value: r.value,
            color:
              r.name === '高风险'
                ? COLORS.danger
                : r.name === '中风险'
                  ? COLORS.warning
                  : COLORS.success,
          }))
        );
      }

      // 处理 API 性能数据
      if (apiPerfRes.status === 'fulfilled' && apiPerfRes.value.data) {
        setApiPerfData(apiPerfRes.value.data.performance || []);
      }

      // 记录性能埋点
      trackPerformance({
        page_url: window.location.pathname,
      });
    } catch (e) {
      console.warn('Failed to load dashboard stats:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [quickRange]);

  // 快捷日期选择
  const handleQuickRangeChange = (value: string) => {
    setQuickRange(value);
  };

  return (
    <div>
      {/* 时间范围选择器 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
          <svg
            className="w-4 h-4 text-violet-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          数据趋势分析
        </h3>
        <div className="flex items-center gap-2">
          {['7d', '14d', '30d'].map((range) => (
            <button
              key={range}
              onClick={() => handleQuickRangeChange(range)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                quickRange === range
                  ? 'bg-violet-100 text-violet-700 font-medium'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {range === '7d' ? '近7天' : range === '14d' ? '近14天' : '近30天'}
            </button>
          ))}
        </div>
      </div>

      {/* 趋势对比指标卡片 */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-slate-50/60 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-violet-700">
            {trendData.reduce((s, i) => s + (i.dau || 0), 0)}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">累计活跃用户</div>
          <TrendBadge value={dauGrowth} />
        </div>
        <div className="bg-slate-50/60 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-emerald-700">
            {trendData.reduce((s, i) => s + (i.reviews || 0), 0)}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">审查完成数</div>
          <TrendBadge value={reviewGrowth} />
        </div>
        <div className="bg-slate-50/60 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-sky-700">
            {trendData.reduce((s, i) => s + (i.uploads || 0), 0)}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">文档上传数</div>
          <TrendBadge value={uploadGrowth} />
        </div>
      </div>

      {/* 用户活跃趋势图 */}
      <Card
        size="small"
        className="mb-4"
        styles={{ body: { padding: '16px' } }}
      >
        <UserActivityChart data={trendData} loading={loading} />
      </Card>

      {/* 下方四宫格 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* 审查流程漏斗 */}
        <Card
          size="small"
          title={
            <span className="text-sm font-semibold flex items-center gap-1.5">
              <svg
                className="w-4 h-4 text-violet-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 14l-7 7m0 0l-7-7m7 7V3"
                />
              </svg>
              审查流程转化漏斗
            </span>
          }
          styles={{ body: { padding: '16px' } }}
        >
          <ReviewFunnelChart data={funnelData} loading={loading} />
        </Card>

        {/* 审查类型分布 */}
        <Card
          size="small"
          title={
            <span className="text-sm font-semibold flex items-center gap-1.5">
              <svg
                className="w-4 h-4 text-sky-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"
                />
              </svg>
              审查类型分布
            </span>
          }
          styles={{ body: { padding: '16px' } }}
        >
          <DistributionPieChart
            data={reviewTypeData}
            loading={loading}
            centerLabel="总审查"
          />
        </Card>

        {/* 风险等级分布 */}
        <Card
          size="small"
          title={
            <span className="text-sm font-semibold flex items-center gap-1.5">
              <WarningOutlined className="text-amber-500" />
              风险等级分布
            </span>
          }
          styles={{ body: { padding: '16px' } }}
        >
          <DistributionPieChart
            data={riskData}
            loading={loading}
            centerLabel="总文档"
          />
        </Card>

        {/* API 性能监控 */}
        <Card
          size="small"
          title={
            <span className="text-sm font-semibold flex items-center gap-1.5">
              <svg
                className="w-4 h-4 text-emerald-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              API 响应性能 (ms)
            </span>
          }
          styles={{ body: { padding: '16px' } }}
        >
          <APIPerformanceChart data={apiPerfData} loading={loading} />
        </Card>
      </div>
    </div>
  );
};

export default AdminStatsCharts;
