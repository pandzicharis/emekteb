import { ReactNode } from 'react';

interface EnhancedStatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray';
  progress?: number; // 0-100
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

export default function EnhancedStatCard({
  title,
  value,
  subtitle,
  icon,
  color = 'blue',
  progress,
  trend,
  trendValue,
}: EnhancedStatCardProps) {
  const colorClasses = {
    blue: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      icon: 'text-blue-600',
      text: 'text-blue-900',
      progress: 'bg-blue-500',
    },
    green: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      icon: 'text-green-600',
      text: 'text-green-900',
      progress: 'bg-green-500',
    },
    yellow: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      icon: 'text-yellow-600',
      text: 'text-yellow-900',
      progress: 'bg-yellow-500',
    },
    red: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      icon: 'text-red-600',
      text: 'text-red-900',
      progress: 'bg-red-500',
    },
    purple: {
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      icon: 'text-purple-600',
      text: 'text-purple-900',
      progress: 'bg-purple-500',
    },
    gray: {
      bg: 'bg-gray-50',
      border: 'border-gray-200',
      icon: 'text-gray-600',
      text: 'text-gray-900',
      progress: 'bg-gray-500',
    },
  };

  const colors = colorClasses[color];

  return (
    <div className={`bg-white rounded-lg p-6 border-2 ${colors.border} shadow-sm hover:shadow-md transition-shadow h-full flex flex-col`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {icon && <div className={`p-2 ${colors.bg} rounded-lg`}>{icon}</div>}
          <div>
            <h3 className="text-sm font-semibold text-gray-600">{title}</h3>
            <div className="flex items-baseline gap-2 mt-1">
              <p className={`text-2xl font-bold ${colors.text}`}>{value}</p>
              {trend && trendValue && (
                <div className={`flex items-center gap-1 text-xs ${trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600'}`}>
                  {trend === 'up' && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                  )}
                  {trend === 'down' && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  )}
                  <span>{trendValue}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {subtitle && <p className="text-xs text-gray-500 mb-2">{subtitle}</p>}
      {progress !== undefined && (
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`${colors.progress} h-2 rounded-full transition-all duration-300`}
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

