import React from 'react';
import { List, Tag } from 'antd';
import {
  ThunderboltOutlined,
  FileSearchOutlined,
  DatabaseOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';

export interface ActivityItem {
  id: string;
  time: string;
  title: string;
  type: 'vector' | 'review' | 'upload' | 'system';
}

const typeIcon = (t: ActivityItem['type']) => {
  switch (t) {
    case 'vector':
      return <DatabaseOutlined className="text-violet-500" />;
    case 'review':
      return <FileSearchOutlined className="text-sky-500" />;
    case 'upload':
      return <ThunderboltOutlined className="text-amber-500" />;
    default:
      return <CheckCircleOutlined className="text-emerald-500" />;
  }
};

const typeTag = (t: ActivityItem['type']) => {
  const map: Record<ActivityItem['type'], { c: string; l: string }> = {
    vector: { c: 'purple', l: '向量化' },
    review: { c: 'blue', l: '审查' },
    upload: { c: 'gold', l: '入库' },
    system: { c: 'green', l: '系统' },
  };
  const x = map[t];
  return <Tag color={x.c}>{x.l}</Tag>;
};

export const ActivityFeed: React.FC<{ items?: ActivityItem[] }> = ({ items = [] }) => {
  if (!items || items.length === 0) {
    return (
      <div
        className="rounded-xl border border-gray-200/80 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden"
        style={{ boxShadow: '0 2px 14px rgba(15, 23, 42, 0.06)' }}
      >
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-slate-50/80 to-white">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="font-semibold text-gray-800">最近处理动态</span>
          </div>
          <Tag color="processing">AI 管线活跃</Tag>
        </div>
        <div className="px-5 py-8 text-center text-sm text-gray-400">
          暂无处理动态
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border border-gray-200/80 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden"
      style={{ boxShadow: '0 2px 14px rgba(15, 23, 42, 0.06)' }}
    >
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-slate-50/80 to-white">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="font-semibold text-gray-800">最近处理动态</span>
        </div>
        <Tag color="processing">AI 管线活跃</Tag>
      </div>
      <List
        className="pg-activity-list"
        dataSource={items}
        renderItem={(item) => (
          <List.Item className="!px-5 !py-3 hover:bg-slate-50/60 transition-colors">
            <div className="flex gap-3 w-full items-start">
              <div className="mt-0.5 text-lg opacity-90">{typeIcon(item.type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-0.5">
                  <span className="text-xs text-gray-400 font-mono">{item.time}</span>
                  {typeTag(item.type)}
                </div>
                <div className="text-sm text-gray-700 leading-snug">{item.title}</div>
              </div>
            </div>
          </List.Item>
        )}
      />
    </div>
  );
};
