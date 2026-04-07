import React from 'react';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';

interface SparklineTrendProps {
  color: string;
  /** 迷你折线数据，默认演示数据 */
  data?: number[];
  /** 趋势：up | down */
  trend?: 'up' | 'down';
  trendLabel?: string;
}

export const SparklineTrend: React.FC<SparklineTrendProps> = ({
  color,
  data = [12, 14, 11, 16, 18, 15, 22],
  trend = 'up',
  trendLabel = '较上周',
}) => {
  const w = 72;
  const h = 28;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / Math.max(data.length - 1, 1)) * (w - 4) + 2;
      const y = h - 4 - ((v - min) / range) * (h - 8);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="flex items-end gap-2 mt-1">
      <svg width={w} height={h} className="shrink-0 opacity-90" aria-hidden>
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
      <span
        className="text-xs flex items-center gap-0.5 pb-0.5"
        style={{ color: trend === 'up' ? '#16a34a' : '#dc2626' }}
      >
        {trend === 'up' ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
        <span className="text-gray-500 font-normal">{trendLabel}</span>
      </span>
    </div>
  );
};
