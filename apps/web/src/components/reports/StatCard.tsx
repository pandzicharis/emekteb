import { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray';
  progress?: number; // 0-100 for progress bar
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

const colorClasses = {
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-900',
    icon: 'text-blue-600',
    progress: 'bg-blue-600',
  },
  green: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-900',
    icon: 'text-green-600',
    progress: 'bg-green-600',
  },
  yellow: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    text: 'text-yellow-900',
    icon: 'text-yellow-600',
    progress: 'bg-yellow-600',
  },
  red: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-900',
    icon: 'text-red-600',
    progress: 'bg-red-600',
  },
  purple: {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-900',
    icon: 'text-purple-600',
    progress: 'bg-purple-600',
  },
  gray: {
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    text: 'text-gray-900',
    icon: 'text-gray-600',
    progress: 'bg-gray-600',
  },
};

export default function StatCard({
  title,
  value,
  subtitle,
  icon,
  color = 'blue',
  progress,
  trend,
  trendValue,
}: StatCardProps) {
  const colors = colorClasses[color];

  return (
    <div className={`bg-white rounded-xl p-6 border-2 ${colors.border} shadow-lg hover:shadow-xl transition-shadow`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <div className="flex items-baseline gap-2">
            <h3 className={`text-3xl font-bold ${colors.text}`}>{value}</h3>
            {subtitle && <span className="text-sm text-gray-500">{subtitle}</span>}
          </div>
        </div>
        {icon && (
          <div className={`p-3 ${colors.bg} rounded-lg`}>
            <div className={colors.icon}>{icon}</div>
          </div>
        )}
      </div>

      {progress !== undefined && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-600">Progres</span>
            <span className={`text-xs font-bold ${colors.text}`}>{progress.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full ${colors.progress} transition-all duration-500`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>
      )}

      {trend && trendValue && (
        <div className="mt-3 flex items-center gap-1">
          {trend === 'up' && (
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          )}
          {trend === 'down' && (
            <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
            </svg>
          )}
          <span className={`text-xs font-medium ${trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600'}`}>
            {trendValue}
          </span>
        </div>
      )}
    </div>
  );
}

