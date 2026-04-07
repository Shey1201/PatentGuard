import React, { useEffect, useState, useCallback } from "react";
import { Row, Col, Spin, Button, Tag, Tooltip, Badge } from "antd";
import {
  DatabaseOutlined,
  CheckCircleOutlined,
  RocketOutlined,
  SafetyCertificateOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  TrophyOutlined,
  SyncOutlined,
  ArrowUpOutlined,
  UserOutlined,
  CrownOutlined,
} from "@ant-design/icons";
import { useNavigate, useLocation } from "react-router-dom";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/zh-cn";
import { systemApi, analysisApi } from "../services/api";
import { SystemStats, UserStats, ReviewTask } from "../types";
import { ActivityFeed, ActivityItem } from "../components/ActivityFeed";
import { useAuthStore } from "../stores/auth";

dayjs.extend(relativeTime);
dayjs.locale("zh-cn");

// ===== 通用工具 =====
const trendSparkline = (vals: number[], color: string) => {
  if (vals.length < 2) return null;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const w = 60,
    h = 24;
  const points = vals
    .map((v, i) => {
      const x = (i / (vals.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="inline-block opacity-60">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </svg>
  );
};

// ===== 角色徽章 =====
const RoleBadge: React.FC<{ isAdmin: boolean }> = ({ isAdmin }) => (
  <span
    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
      isAdmin
        ? "bg-violet-50 text-violet-700 border-violet-200"
        : "bg-blue-50 text-blue-700 border-blue-200"
    }`}
  >
    {isAdmin ? <CrownOutlined /> : <UserOutlined />}
    {isAdmin ? "管理员" : "普通用户"}
  </span>
);

// ===== 统计数字卡片 =====
const StatCard: React.FC<{
  label: string;
  value: number | string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  sparkVals?: number[];
  sparkColor?: string;
  suffix?: string;
  sub?: string;
  tip?: string;
}> = ({
  label,
  value,
  icon,
  iconBg,
  iconColor,
  sparkVals,
  sparkColor,
  suffix,
  sub,
  tip,
}) => (
  <div className="rounded-xl border border-gray-100 bg-white px-5 py-4 flex flex-col gap-2 transition-shadow hover:shadow-md">
    <div className="flex items-start justify-between">
      <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
        {label}
      </span>
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center text-lg"
        style={{ background: iconBg, color: iconColor }}
      >
        {icon}
      </div>
    </div>
    <div className="flex items-baseline gap-1">
      <span className="text-2xl font-bold text-gray-900 tabular-nums">
        {value}
      </span>
      {suffix && <span className="text-sm text-gray-400">{suffix}</span>}
    </div>
    {sub && <span className="text-xs text-gray-400">{sub}</span>}
    {sparkVals && sparkColor && (
      <div>{trendSparkline(sparkVals, sparkColor)}</div>
    )}
    {tip && (
      <Tooltip title={tip}>
        <InfoCircleIcon />
      </Tooltip>
    )}
  </div>
);

const InfoCircleIcon = () => (
  <svg
    className="inline-block ml-1 text-gray-300 cursor-help"
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
  </svg>
);

// ===== 审查历史列表（用户视图）=====
const ReviewHistoryList: React.FC<{
  tasks: ReviewTask[];
  onView: (t: ReviewTask) => void;
}> = ({ tasks, onView }) => {
  const statusMap: Record<
    string,
    { color: string; label: string; icon: React.ReactNode }
  > = {
    completed: {
      color: "success",
      label: "已完成",
      icon: <CheckCircleOutlined />,
    },
    pending: {
      color: "warning",
      label: "待处理",
      icon: <ClockCircleOutlined />,
    },
    processing: {
      color: "processing",
      label: "处理中",
      icon: <SyncOutlined spin />,
    },
    failed: {
      color: "error",
      label: "失败",
      icon: <ExclamationCircleOutlined />,
    },
  };
  if (!tasks.length)
    return (
      <p className="text-sm text-gray-400 py-4 text-center">暂无审查记录</p>
    );
  return (
    <div className="divide-y divide-gray-50">
      {tasks.slice(0, 5).map((t) => {
        const st = statusMap[t.status] || statusMap.pending;
        const risk = t.result?.risk_level;
        const riskTag = risk ? (
          <Tag
            color={
              risk === "high"
                ? "error"
                : risk === "medium"
                  ? "warning"
                  : "success"
            }
            className="text-xs"
          >
            {risk === "high"
              ? "高风险"
              : risk === "medium"
                ? "中风险"
                : "低风险"}
          </Tag>
        ) : null;
        return (
          <div
            key={t.id}
            className="flex items-center gap-3 px-1 py-3 hover:bg-gray-50/60 rounded-lg transition-colors cursor-pointer"
            onClick={() => onView(t)}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
              style={{
                background:
                  st.color === "success"
                    ? "#f0fdf4"
                    : st.color === "warning"
                      ? "#fffbeb"
                      : st.color === "error"
                        ? "#fef2f2"
                        : "#eff6ff",
                color:
                  st.color === "success"
                    ? "#16a34a"
                    : st.color === "warning"
                      ? "#d97706"
                      : st.color === "error"
                        ? "#dc2626"
                        : "#2563eb",
              }}
            >
              {st.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-800 truncate">
                {t.task_name}
              </div>
              <div className="text-xs text-gray-400">
                {dayjs(t.created_at).fromNow()}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {riskTag}
              <Tag color={st.color} className="text-xs">
                {st.label}
              </Tag>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ===== 管理员主视图 =====
const AdminDashboard: React.FC<{
  stats: SystemStats | null;
  activityItems: ActivityItem[] | null;
}> = ({ stats, activityItems }) => {
  const navigate = useNavigate();
  const d = stats?.total_documents ?? 0;
  const p = stats?.processed_documents ?? 0;
  const c = stats?.total_chunks ?? 0;
  const r = stats?.completed_reviews ?? 0;
  const rate = stats?.compliance_rate ?? 0;

  const adminWelcome = () => {
    const now = dayjs();
    const hour = now.hour();
    const greet = hour < 12 ? "上午好" : hour < 18 ? "下午好" : "晚上好";
    return `${greet}，合规系统管理员`;
  };

  const systemStatus = c > 0 ? "知识引擎运行良好" : "知识库初始化中";

  return (
    <div>
      {/* 顶部欢迎区 */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            工作台
            <RoleBadge isAdmin={true} />
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {adminWelcome()}。{systemStatus}。
          </p>
        </div>
        <div className="hidden md:flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
          系统运行正常
        </div>
      </div>

      {/* 统计卡片 3 列（无向量块） */}
      <Row gutter={[12, 12]} className="mb-5">
        <Col xs={12} sm={8}>
          <StatCard
            label="知识库文档"
            value={d}
            icon={<DatabaseOutlined />}
            iconBg="#f5f3ff"
            iconColor="#7c3aed"
            sparkVals={[8, 10, 9, 12, 11, 14, 15]}
            sparkColor="#7c3aed"
            sub="总文档数"
          />
        </Col>
        <Col xs={12} sm={8}>
          <StatCard
            label="审查完成"
            value={r}
            icon={<CheckCircleOutlined />}
            iconBg="#f0fdf4"
            iconColor="#16a34a"
            sparkVals={[4, 5, 6, 5, 7, 6, 8]}
            sparkColor="#16a34a"
            sub="累计审查"
          />
        </Col>
        <Col xs={12} sm={8}>
          <StatCard
            label="合规率"
            value={`${rate}%`}
            icon={<TrophyOutlined />}
            iconBg="#fffbeb"
            iconColor="#d97706"
            sparkVals={[65, 72, 68, 75, 71, 78, rate || 80]}
            sparkColor="#d97706"
            sub="近 7 天"
          />
        </Col>
      </Row>

      {/* 系统运营指标看板（无按钮） */}
      <Row gutter={[12, 12]} className="mb-5">
        <Col xs={24}>
          <div className="rounded-xl border border-gray-100 bg-white px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <ArrowUpOutlined className="text-sky-500" />
              <span className="text-sm font-semibold text-gray-800">
                系统运营指标
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-slate-50/60 rounded-lg">
                <div className="text-2xl font-bold text-sky-700">
                  {stats?.total_reviews ?? 0}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">审查总数</div>
              </div>
              <div className="text-center p-3 bg-slate-50/60 rounded-lg">
                <div className="text-2xl font-bold text-violet-700">
                  {stats?.pending_documents ?? 0}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">待处理文档</div>
              </div>
              <div className="text-center p-3 bg-slate-50/60 rounded-lg">
                <div className="text-2xl font-bold text-emerald-700">{p}</div>
                <div className="text-xs text-gray-400 mt-0.5">已解析文档</div>
              </div>
              <div className="text-center p-3 bg-slate-50/60 rounded-lg">
                <div className="text-2xl font-bold text-amber-700">{rate}%</div>
                <div className="text-xs text-gray-400 mt-0.5">合规通过率</div>
              </div>
            </div>
          </div>
        </Col>
      </Row>

      {/* 最近动态 */}
      <ActivityFeed items={activityItems ?? undefined} />
    </div>
  );
};

// ===== 用户主视图 =====
const UserDashboard: React.FC<{
  userStats: UserStats | null;
  recentTasks: ReviewTask[];
  activityItems: ActivityItem[] | null;
  onViewTask: (t: ReviewTask) => void;
}> = ({ userStats, recentTasks, activityItems, onViewTask }) => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const userName = user?.username || "用户";
  const pending = userStats?.pending_reviews ?? 0;
  const failed = userStats?.failed_reviews ?? 0;

  const now = dayjs();
  const hour = now.hour();
  const greet = hour < 12 ? "上午好" : hour < 18 ? "下午好" : "晚上好";

  return (
    <div>
      {/* 欢迎区 */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2 flex-wrap">
            工作台
            <RoleBadge isAdmin={false} />
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {greet}，{userName}。
            {pending > 0
              ? `您还有 ${pending} 份文档待审查。`
              : "今日工作已完成。"}
          </p>
        </div>
        {pending > 0 && (
          <Badge count={pending} overflowCount={99} className="shrink-0">
            <Tag
              color="warning"
              className="px-3 py-1 text-sm rounded-full flex items-center gap-1"
            >
              <WarningOutlined /> 待处理
            </Tag>
          </Badge>
        )}
      </div>

      {/* 核心操作区：大按钮 */}
      <div className="mb-5 rounded-2xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 via-white to-sky-50 p-6 flex flex-col sm:flex-row items-center gap-5 shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-violet-600 flex items-center justify-center shadow-lg shrink-0">
          <RocketOutlined className="text-white text-2xl" />
        </div>
        <div className="flex-1 text-center sm:text-left">
          <h2 className="text-lg font-bold text-gray-900 mb-1">
            立即开始文档审查
          </h2>
          <p className="text-sm text-gray-500">
            上传 PDF / Word 文档，AI 自动识别风险点并生成合规报告
          </p>
        </div>
        <Button
          type="primary"
          size="large"
          className="!rounded-xl !bg-violet-600 !border-violet-600 shrink-0 px-8 h-11 shadow-md hover:!bg-violet-700"
          onClick={() => navigate("/review")}
        >
          上传并审查
        </Button>
      </div>

      {/* 个人统计 + 审查历史 */}
      <Row gutter={[12, 12]} className="mb-5">
        {/* 统计卡片 */}
        <Col xs={24} sm={8}>
          <div className="rounded-xl border border-gray-100 bg-white p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              我的审查概况
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                  已完成
                </span>
                <span className="text-base font-bold text-gray-900">
                  {userStats?.completed_reviews ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                  待处理
                </span>
                <span className="text-base font-bold text-amber-600">
                  {pending}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                  失败
                </span>
                <span className="text-base font-bold text-red-500">
                  {failed}
                </span>
              </div>
              <div className="border-t border-gray-100 pt-2 mt-2 flex items-center justify-between">
                <span className="text-sm text-gray-500">总计</span>
                <span className="text-base font-bold text-gray-700">
                  {userStats?.total_reviews ?? 0}
                </span>
              </div>
            </div>
          </div>
        </Col>

        {/* 审查历史列表 */}
        <Col xs={24} sm={16}>
          <div className="rounded-xl border border-gray-100 bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">最近审查</h3>
              <Button
                type="link"
                size="small"
                className="text-xs"
                onClick={() => navigate("/review")}
              >
                查看全部
              </Button>
            </div>
            <ReviewHistoryList tasks={recentTasks} onView={onViewTask} />
          </div>
        </Col>
      </Row>

      {/* 最近动态 */}
      <ActivityFeed items={activityItems ?? undefined} />
    </div>
  );
};

// ===== 主 Dashboard =====
const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [recentTasks, setRecentTasks] = useState<ReviewTask[]>([]);
  const [activityItems, setActivityItems] = useState<ActivityItem[] | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [taskLoading, setTaskLoading] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const user = useAuthStore((s) => s.user);
  const isAdminPath = pathname.startsWith("/admin");
  const isAdminRole = user?.role === "admin";

  const loadActivity = useCallback(async () => {
    try {
      const { data } = await systemApi.getRecentActivity(8);
      const items: ActivityItem[] = (data.items || []).map((a: any) => ({
        id: a.id,
        time: dayjs(a.time).isValid() ? `[${dayjs(a.time).fromNow()}]` : a.time,
        title: a.title,
        type: a.type,
      }));
      setActivityItems(items.length ? items : null);
    } catch (_) {
      setActivityItems(null);
    }
  }, []);

  const loadRecentTasks = useCallback(async () => {
    setTaskLoading(true);
    try {
      const { data } = await analysisApi.getHistory({ page: 1, page_size: 5 });
      setRecentTasks(data?.items ?? []);
    } catch (e) {
      if (isAdminPath && isAdminRole) {
        try {
          const { data } = await analysisApi.getAllHistory({
            page: 1,
            page_size: 5,
          });
          setRecentTasks(data?.items ?? []);
        } catch (e2) {
          console.warn("all history load failed", e2);
        }
      } else {
        console.warn("history load failed", e);
      }
    }
    setTaskLoading(false);
  }, [isAdminPath, isAdminRole]);

  const loadStats = useCallback(async () => {
    // 管理员视图下请求系统统计（后端已允许已登录用户读取）
    if (isAdminPath) {
      try {
        const { data } = await systemApi.getStats();
        setStats(data);
      } catch (e) {
        console.warn("stats load failed", e);
        setStats(null);
      }
    } else {
      setStats(null);
    }
    if (!isAdminPath) {
      try {
        const { data } = await systemApi.getUserStats();
        setUserStats(data);
      } catch (e) {
        console.warn("user stats load failed", e);
      }
      await loadRecentTasks();
    }
  }, [isAdminPath, loadRecentTasks]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.allSettled([loadStats(), loadActivity()]);
    } finally {
      setLoading(false);
    }
  }, [loadStats, loadActivity]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleViewTask = (task: ReviewTask) => {
    navigate("/review");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spin size="large" />
      </div>
    );
  }

  if (isAdminPath) {
    return <AdminDashboard stats={stats} activityItems={activityItems} />;
  }

  return (
    <UserDashboard
      userStats={userStats}
      recentTasks={recentTasks}
      activityItems={activityItems}
      onViewTask={handleViewTask}
    />
  );
};

export default Dashboard;
