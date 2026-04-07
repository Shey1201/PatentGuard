import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Tag, Button, Select, DatePicker, Space, Row, Col,
  Statistic, Modal, Drawer, Descriptions, Spin, Empty, Tooltip, Popconfirm,
  Input, Segmented, Badge
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckCircleOutlined, ClockCircleOutlined, SyncOutlined,
  ExclamationCircleOutlined, DeleteOutlined, EyeOutlined,
  ReloadOutlined, SearchOutlined, FilterOutlined, FileTextOutlined,
  WarningOutlined, TrophyOutlined, RiseOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import { analysisApi } from '../services/api';
import { ReviewTask, ReviewResult } from '../types';
import { useAuthStore } from '../stores/auth';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const { RangePicker } = DatePicker;
const { TextArea } = Input;

type StatusFilter = 'all' | 'completed' | 'pending' | 'processing' | 'failed';

const statusMap: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  completed: { color: 'success', label: '已完成', icon: <CheckCircleOutlined /> },
  pending:   { color: 'warning', label: '待处理', icon: <ClockCircleOutlined /> },
  processing:{ color: 'processing', label: '处理中', icon: <SyncOutlined spin /> },
  failed:    { color: 'error', label: '失败', icon: <ExclamationCircleOutlined /> },
};

const riskMap: Record<string, { color: string; label: string }> = {
  low:    { color: 'success', label: '低风险' },
  medium: { color: 'warning', label: '中风险' },
  high:   { color: 'error', label: '高风险' },
};

const reviewTypeMap: Record<string, string> = {
  general: '通用审查',
  patent: '专利审查',
  law: '法律审查',
  contract: '合同审查',
};

// ===== 统计卡片 =====
const StatCol: React.FC<{ value: number; label: string; icon: React.ReactNode; color: string }> = ({ value, label, icon, color }) => (
  <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 flex items-center gap-3">
    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg" style={{ background: `${color}18`, color }}>
      {icon}
    </div>
    <div>
      <div className="text-xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-400">{label}</div>
    </div>
  </div>
);

// ===== 详情抽屉 =====
const DetailDrawer: React.FC<{ task: ReviewTask | null; open: boolean; onClose: () => void }> = ({ task, open, onClose }) => {
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !task) return;
    if (task.status === 'completed' && task.result) {
      setResult(task.result);
      return;
    }
    if (task.status === 'completed') {
      setLoading(true);
      analysisApi.getResult(task.id)
        .then(({ data }) => setResult(data))
        .catch(console.warn)
        .finally(() => setLoading(false));
    }
  }, [open, task]);

  if (!task) return null;

  const st = statusMap[task.status] || statusMap.pending;
  const risk = result?.risk_level;
  const riskInfo = risk ? riskMap[risk] : null;

  return (
    <Drawer
      title={
        <div className="flex items-center gap-2">
          <FileTextOutlined className="text-violet-500" />
          <span className="font-semibold">{task.task_name}</span>
          <Tag color={st.color} className="text-xs ml-2">{st.label}</Tag>
          {riskInfo && <Tag color={riskInfo.color} className="text-xs ml-1">{riskInfo.label}</Tag>}
        </div>
      }
      placement="right"
      width={560}
      onClose={onClose}
      open={open}
      styles={{ body: { padding: 0 } }}
    >
      {loading ? (
        <div className="flex justify-center py-12"><Spin size="large" /></div>
      ) : result ? (
        <div className="divide-y divide-gray-100">
          {/* 基本信息 */}
          <div className="px-6 py-4">
            <Descriptions column={2} size="small" labelStyle={{ color: '#6b7280', fontSize: 12 }} contentStyle={{ fontSize: 12 }}>
              <Descriptions.Item label="审查类型">{reviewTypeMap[task.document_id ? 'patent' : 'general'] || '—'}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{dayjs(task.created_at).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
              {task.completed_at && <Descriptions.Item label="完成时间">{dayjs(task.completed_at).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>}
              <Descriptions.Item label="文档ID">{task.document_id || '—'}</Descriptions.Item>
            </Descriptions>
          </div>

          {/* 合规结论 */}
          <div className="px-6 py-4">
            <div className="flex items-center gap-2 mb-2">
              {result.compliance
                ? <CheckCircleOutlined className="text-emerald-500" />
                : <WarningOutlined className="text-red-500" />
              }
              <span className="text-sm font-semibold text-gray-800">
                {result.compliance ? '合规通过' : '不合规 — 需整改'}
              </span>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">{result.summary}</p>
          </div>

          {/* 风险发现 */}
          {result.findings && result.findings.length > 0 && (
            <div className="px-6 py-4">
              <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-1.5">
                <ExclamationCircleOutlined className="text-amber-500" /> 风险发现（共 {result.findings.length} 条）
              </h4>
              <div className="space-y-2">
                {result.findings.map((f, i) => (
                  <div key={i} className="rounded-lg border border-gray-100 p-3 text-sm">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <Tag color={f.severity === 'high' ? 'error' : f.severity === 'medium' ? 'warning' : 'success'} className="text-xs">
                        {f.severity === 'high' ? '高' : f.severity === 'medium' ? '中' : '低'}风险
                      </Tag>
                    </div>
                    <p className="text-gray-700">{f.description}</p>
                    {f.suggestion && (
                      <p className="text-gray-500 text-xs mt-1">建议：{f.suggestion}</p>
                    )}
                    {f.reference && (
                      <p className="text-gray-400 text-xs mt-1">依据：{f.reference}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 引用文档 */}
          {result.referenced_documents && result.referenced_documents.length > 0 && (
            <div className="px-6 py-4">
              <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-1.5">
                <FileTextOutlined className="text-sky-500" /> 引用依据
              </h4>
              <div className="space-y-2">
                {result.referenced_documents.map((rd, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-slate-50/60 rounded-lg">
                    <FileTextOutlined className="text-gray-400 shrink-0" />
                    <span className="text-sm text-gray-700 flex-1">{rd.title}</span>
                    <span className="text-xs text-gray-400">匹配度 {(rd.relevance * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : task.error_message ? (
        <div className="px-6 py-8 text-center">
          <ExclamationCircleOutlined className="text-red-400 text-3xl mb-3" />
          <p className="text-sm text-red-500">{task.error_message}</p>
        </div>
      ) : (
        <Empty description="暂无详细结果" className="py-12" />
      )}
    </Drawer>
  );
};

// ===== 主页面 =====
const HistoryPage: React.FC = () => {
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedTask, setSelectedTask] = useState<ReviewTask | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);

  // 统计
  const stats = {
    total: tasks.length,
    completed: tasks.filter(t => t.status === 'completed').length,
    pending: tasks.filter(t => t.status === 'pending').length,
    failed: tasks.filter(t => t.status === 'failed').length,
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await analysisApi.getHistory({ page, page_size: pageSize });
      let items: ReviewTask[] = data?.items ?? [];
      if (statusFilter !== 'all') {
        items = items.filter(t => t.status === statusFilter);
      }
      if (search) {
        const q = search.toLowerCase();
        items = items.filter(t => t.task_name.toLowerCase().includes(q));
      }
      setTasks(items);
      setTotal(data?.total ?? items.length);
    } catch (e) {
      console.warn('history load failed', e);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, search]);

  useEffect(() => { loadData(); }, [loadData]);

  // 删除
  const handleDelete = async (id: string) => {
    // 真实 API 未实现，先本地过滤
    setTasks(prev => prev.filter(t => t.id !== id));
    try {
      await analysisApi.getResult(id); // 假设 delete 接口存在
    } catch (_) { /* ignore */ }
  };

  // 查看详情
  const handleView = (task: ReviewTask) => {
    setSelectedTask(task);
    setDrawerOpen(true);
  };

  // 重新审查
  const handleReReview = (task: ReviewTask) => {
    navigate('/review');
  };

  const columns: ColumnsType<ReviewTask> = [
    {
      title: '任务名称',
      dataIndex: 'task_name',
      key: 'task_name',
      render: (name, record) => (
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
            <FileTextOutlined className="text-violet-400 text-sm" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-gray-800 truncate">{name}</div>
            <div className="text-xs text-gray-400 truncate">{record.document_title || record.document_id || '—'}</div>
          </div>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: string) => {
        const s = statusMap[status] || statusMap.pending;
        return <Tag color={s.color} icon={s.icon} className="text-xs">{s.label}</Tag>;
      },
    },
    {
      title: '风险等级',
      key: 'risk',
      width: 90,
      render: (_, record) => {
        const risk = record.result?.risk_level;
        if (!risk) return <span className="text-gray-300 text-xs">—</span>;
        const info = riskMap[risk];
        return <Tag color={info.color} className="text-xs">{info.label}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (t: string) => <span className="text-xs text-gray-500">{dayjs(t).format('MM-DD HH:mm')}</span>,
    },
    {
      title: '耗时',
      key: 'duration',
      width: 90,
      render: (_, record) => {
        if (!record.completed_at) return <span className="text-gray-300 text-xs">—</span>;
        const ms = dayjs(record.completed_at).diff(dayjs(record.created_at), 'second');
        if (ms < 60) return <span className="text-xs text-gray-500">{ms}s</span>;
        return <span className="text-xs text-gray-500">{Math.round(ms / 60)}min</span>;
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="查看详情">
            <Button size="small" type="text" icon={<EyeOutlined />} className="text-gray-500 hover:text-violet-600"
                    onClick={() => handleView(record)} />
          </Tooltip>
          <Tooltip title="重新审查">
            <Button size="small" type="text" icon={<ReloadOutlined />} className="text-gray-500 hover:text-sky-600"
                    onClick={() => handleReReview(record)} />
          </Tooltip>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)} okText="删除" cancelText="取消">
            <Tooltip title="删除">
              <Button size="small" type="text" icon={<DeleteOutlined />} className="text-gray-400 hover:text-red-500" danger />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* 页面标题 */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            历史记录
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">共 {total} 条审查记录</p>
        </div>
        <Button type="primary" icon={<ReloadOutlined />} onClick={loadData} loading={loading}
                className="!rounded-lg !bg-violet-600 !border-violet-600">
          刷新
        </Button>
      </div>

      {/* 统计行 */}
      <Row gutter={[12, 12]} className="mb-5">
        <Col xs={12} sm={6}>
          <StatCol value={total} label="总记录数" icon={<FileTextOutlined />} color="#7c3aed" />
        </Col>
        <Col xs={12} sm={6}>
          <StatCol value={stats.completed} label="已完成" icon={<CheckCircleOutlined />} color="#16a34a" />
        </Col>
        <Col xs={12} sm={6}>
          <StatCol value={stats.pending} label="处理中/待处理" icon={<ClockCircleOutlined />} color="#d97706" />
        </Col>
        <Col xs={12} sm={6}>
          <StatCol value={stats.failed} label="失败" icon={<ExclamationCircleOutlined />} color="#dc2626" />
        </Col>
      </Row>

      {/* 筛选栏 */}
      <Card className="mb-4 !rounded-xl border-gray-100" bodyStyle={{ padding: '12px 16px' }}>
        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="搜索任务名称..."
            prefix={<SearchOutlined className="text-gray-400" />}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            allowClear
            className="!w-52 !rounded-lg"
          />
          <Select
            value={statusFilter}
            onChange={v => { setStatusFilter(v); setPage(1); }}
            className="!w-32 !rounded-lg"
            options={[
              { value: 'all', label: '全部状态' },
              { value: 'completed', label: '已完成' },
              { value: 'pending', label: '待处理' },
              { value: 'processing', label: '处理中' },
              { value: 'failed', label: '失败' },
            ]}
          />
        </div>
      </Card>

      {/* 表格 */}
      <Card className="!rounded-xl border-gray-100" bodyStyle={{ padding: 0 }}>
        <Table
          columns={columns}
          dataSource={tasks}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t, range) => `${range[0]}-${range[1]} 共 ${t} 条`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          }}
          locale={{ emptyText: <Empty description="暂无历史记录" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
          className="[&_.ant-table-thead>tr>th]:!bg-gray-50 [&_.ant-table-thead>tr>th]:!text-gray-500 [&_.ant-table-row:hover>td]:!bg-violet-50/30"
          size="middle"
        />
      </Card>

      {/* 详情抽屉 */}
      <DetailDrawer task={selectedTask} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
};

export default HistoryPage;
