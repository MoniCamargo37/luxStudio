import React from 'react';
import { Link, useLocation } from 'react-router-dom';

interface MainLayoutProps {
  children?: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const location = useLocation();
  const isAdmin = location.pathname === '/admin';

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"/>
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">LUX Studio</h1>
                <p className="text-xs text-slate-500 -mt-0.5">Road Lighting Design</p>
              </div>
            </div>
            <nav className="flex items-center gap-4">
              {isAdmin ? (
                <Link to="/" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                  Studio
                </Link>
              ) : (
                <Link to="/admin" className="text-sm text-slate-500 hover:text-blue-600">
                  Admin
                </Link>
              )}
              <div className="h-6 w-px bg-slate-200"/>
              <span className="text-sm text-slate-500">CIE 140 / EN 13201</span>
              <div className="h-6 w-px bg-slate-200"/>
              <span className="text-xs text-slate-400">v0.1.0</span>
            </nav>
          </div>
        </div>
      </header>
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
};

export default MainLayout;
