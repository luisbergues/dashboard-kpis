import React from 'react';
import { useKpi } from '../context/KpiContext';
import { Badge } from '../components/Badge';

export const DashboardView: React.FC = () => {
  const { designers, projects } = useKpi();

  const totalProjects = projects.length;
  const completedProjects = projects.filter(p => p.status === 'Completed').length;
  
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-gray-100">Leaderboard</h2>
        <p className="text-gray-400 mt-1">Overview of designer performance and KPIs.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-sm">
          <h3 className="text-sm font-medium text-gray-400">Total Projects</h3>
          <p className="text-3xl font-bold text-gray-100 mt-2">{totalProjects}</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-sm">
          <h3 className="text-sm font-medium text-gray-400">Completed Projects</h3>
          <p className="text-3xl font-bold text-gray-100 mt-2">{completedProjects}</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-sm">
          <h3 className="text-sm font-medium text-gray-400">Active Designers</h3>
          <p className="text-3xl font-bold text-gray-100 mt-2">{designers.length}</p>
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-900/50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Designer Name</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Completed Projects</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Avg P1 Score (ICE)</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Avg P2 Score (IFR)</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Global KPI</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Performance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700 bg-gray-800">
              {designers.map((designer) => (
                <tr key={designer.name} className="hover:bg-gray-700/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-200">{designer.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{designer.totalProjects}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{designer.avgPhase1Score}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{designer.avgPhase2Score}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-100">{designer.globalKpi}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {designer.totalProjects > 0 ? (
                      <Badge score={designer.globalKpi} />
                    ) : (
                      <span className="text-xs text-gray-500 italic">No data</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
