import React from 'react';
import { LayoutDashboard, FileText, CheckSquare, FolderOpen } from 'lucide-react';
import clsx from 'clsx';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView }) => {
  const navItems = [
    { id: 'dashboard', label: 'Leaderboard', icon: LayoutDashboard },
    { id: 'projects', label: 'Projects Directory', icon: FolderOpen },
    { id: 'phase1', label: 'Phase 1: Intake', icon: FileText },
    { id: 'phase2', label: 'Phase 2: Closure', icon: CheckSquare },
  ];

  return (
    <div className="w-64 bg-gray-900 border-r border-gray-800 h-full flex flex-col">
      <div className="p-6 border-b border-gray-800">
        <h1 className="text-xl font-bold text-gray-100 leading-tight">
          Engineering KPI<br/><span className="text-blue-500 text-sm">Designer Performance</span>
        </h1>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={clsx(
                'w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                isActive 
                  ? 'bg-blue-600/20 text-blue-400' 
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              )}
            >
              <Icon className={clsx('w-5 h-5', isActive ? 'text-blue-500' : 'text-gray-500')} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-gray-800 text-xs text-gray-500 text-center">
        &copy; 2026 KPI Tracker v1.0
      </div>
    </div>
  );
};
