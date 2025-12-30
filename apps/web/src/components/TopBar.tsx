import { useLocation } from 'react-router-dom';
import NotificationsHeader from './NotificationsHeader';
import MessagesHeader from './MessagesHeader';

export default function TopBar() {
  const location = useLocation();

  // Don't show on login page
  if (location.pathname === '/login') return null;

  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-30 px-6 py-3">
      <div className="flex items-center justify-end gap-2">
        <MessagesHeader />
        <NotificationsHeader />
      </div>
    </div>
  );
}

