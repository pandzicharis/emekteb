import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface MenuItem {
  path: string;
  name: string;
  icon: React.ReactNode;
}

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const getMenuItems = (uloga: string): MenuItem[] => {
  const baseItems: MenuItem[] = [
    {
      path: '/',
      name: 'Dashboard',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
  ];

  // Za MUALLIM, vraćamo samo Dashboard
  if (uloga === 'MUALLIM') {
    return baseItems;
  }

  if (uloga === 'ADMIN') {
    baseItems.push({
      path: '/import',
      name: 'Import',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      ),
    });
  }

  baseItems.push({
    path: '/setup-nastavna-godina',
    name: 'Setup nastavne godine',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  });

  return baseItems;
};

export default function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const menuItems = getMenuItems(user?.uloga || '');

  return (
    <>
      {/* Overlay za mobile */}
      <div
        className={`fixed inset-0 bg-gray-600 z-20 lg:hidden transition-opacity duration-300 ease-in-out ${
          isOpen ? 'opacity-75 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onToggle}
        style={{ willChange: 'opacity' }}
      />

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full bg-gray-900 text-white z-30 transition-all duration-300 ease-in-out flex flex-col ${
          isOpen ? 'w-64' : 'w-20'
        }`}
        style={{ 
          willChange: 'width',
          transform: 'translateZ(0)', // Force GPU acceleration
        }}
      >
        {/* Header */}
        <div className={`flex items-center h-16 px-4 border-b border-gray-800 transition-all duration-300 ease-in-out ${
          isOpen ? 'justify-between' : 'justify-center'
        }`}>
          <div
            className={`transition-all duration-300 ease-in-out ${
              isOpen
                ? 'opacity-100 max-w-full ml-0'
                : 'opacity-0 max-w-0 overflow-hidden ml-0'
            }`}
            style={{ willChange: 'opacity, max-width' }}
          >
            <h1 className="text-xl font-bold text-white whitespace-nowrap">
              E-Mekteb
            </h1>
            <p className="text-xs text-gray-400 mt-0.5 whitespace-nowrap">
              Džemat Grbavica 2
            </p>
          </div>
          <button
            onClick={onToggle}
            className="p-2 rounded-md hover:bg-gray-800 transition-colors flex-shrink-0"
            aria-label="Toggle sidebar"
          >
            <svg
              className="w-6 h-6 transition-transform duration-300 ease-in-out"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Menu Items */}
        <nav className="mt-8 flex-1 overflow-y-auto">
          <ul className="space-y-2 px-2">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex items-center rounded-lg transition-colors ${
                      isOpen ? 'gap-3 px-4' : 'justify-center px-0'
                    } py-3 ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }`}
                    title={!isOpen ? item.name : undefined}
                  >
                    <span className="flex-shrink-0 flex items-center justify-center">{item.icon}</span>
                    <span
                      className={`font-medium whitespace-nowrap transition-all ease-in-out ${
                        isOpen
                          ? 'opacity-100 max-w-full duration-300 delay-100'
                          : 'opacity-0 max-w-0 overflow-hidden duration-300'
                      }`}
                      style={{ willChange: 'opacity, max-width' }}
                    >
                      {item.name}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User Info & Logout */}
        <div className={`border-t border-gray-800 transition-all duration-300 ease-in-out ${isOpen ? 'p-4' : 'px-2 py-3'}`}>
          {user && (
            <div className={`flex items-center rounded-lg transition-colors ${
              isOpen ? 'justify-between gap-3' : 'justify-center px-0'
            }`}>
              {/* Avatar sa inicijalima */}
              <div className={`flex items-center transition-all ease-in-out ${
                isOpen ? 'gap-3 flex-1 min-w-0' : 'justify-center'
              }`}>
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-sm transition-transform duration-300 ease-in-out">
                  {user.uloga === 'ADMIN'
                    ? 'A'
                    : user.ime && user.prezime
                    ? `${user.ime.charAt(0).toUpperCase()}${user.prezime.charAt(0).toUpperCase()}`
                    : user.email?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className={`min-w-0 flex-1 transition-all ease-in-out ${
                  isOpen
                    ? 'opacity-100 max-w-full duration-300 delay-100'
                    : 'opacity-0 max-w-0 overflow-hidden duration-300'
                }`}>
                  <div className="text-sm text-gray-300 font-medium truncate">
                    {user.ime && user.prezime
                      ? `${user.ime} ${user.prezime}`
                      : user.email}
                  </div>
                  <div className="text-xs text-gray-500 capitalize">
                    {user.uloga.toLowerCase()}
                  </div>
                </div>
              </div>
              
              {/* Logout button - samo ikonica */}
              <button
                onClick={logout}
                className={`flex-shrink-0 p-2 rounded-lg transition-all ease-in-out text-gray-300 hover:bg-gray-800 hover:text-white ${
                  isOpen
                    ? 'opacity-100 scale-100 duration-300 delay-100'
                    : 'opacity-0 scale-0 w-0 p-0 duration-300'
                }`}
                title="Odjavi se"
                aria-label="Odjavi se"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

