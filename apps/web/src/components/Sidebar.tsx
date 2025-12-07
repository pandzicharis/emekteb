import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface MenuItem {
  path: string;
  name: string;
  icon: React.ReactNode;
}

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const menuItems: MenuItem[] = [
  {
    path: '/',
    name: 'Dashboard',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    path: '/import',
    name: 'Import',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
    ),
  },
];

export default function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const location = useLocation();

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
        className={`fixed top-0 left-0 h-full bg-gray-900 text-white z-30 transition-all duration-300 ease-in-out overflow-hidden ${
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
          <h1
            className={`text-xl font-bold text-white whitespace-nowrap transition-all duration-300 ease-in-out ${
              isOpen
                ? 'opacity-100 max-w-full ml-0'
                : 'opacity-0 max-w-0 overflow-hidden ml-0'
            }`}
            style={{ willChange: 'opacity, max-width' }}
          >
            E-Mekteb
          </h1>
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
        <nav className="mt-8">
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
                          : 'opacity-0 max-w-0 overflow-hidden duration-500'
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
      </aside>
    </>
  );
}

