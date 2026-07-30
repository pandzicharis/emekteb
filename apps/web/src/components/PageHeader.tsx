import { ReactNode } from 'react';
import NotificationsHeader from './NotificationsHeader';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  showNotifications?: boolean;
}

export default function PageHeader({ title, subtitle, actions, showNotifications = true }: PageHeaderProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="mt-2 text-gray-600">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-4">
          {actions}
          {showNotifications && <NotificationsHeader />}
        </div>
      </div>
    </div>
  );
}





