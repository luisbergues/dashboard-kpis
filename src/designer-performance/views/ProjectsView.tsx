import React, { useState } from 'react';
import { useKpi } from '../context/KpiContext';
import { ProjectDetailsModal } from '../components/ProjectDetailsModal';
import type { Project, ProjectStatus } from '../types';

export const ProjectsView: React.FC = () => {
  const { projects } = useKpi();
  
  const [filterStatus, setFilterStatus] = useState<ProjectStatus | 'All'>('All');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const filteredProjects = projects.filter(p => 
    filterStatus === 'All' ? true : p.status === filterStatus
  );

  return (
    <div className="space-y-6 relative">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-100">Projects Directory</h2>
          <p className="text-gray-400 mt-1">View and filter all projects and their respective scores.</p>
        </div>

        {/* Filter/Sorter Label */}
        <div className="flex items-center space-x-2 bg-gray-800 p-1 rounded-lg border border-gray-700 shadow-sm flex-wrap">
          {(['All', 'To review', 'Approved', 'Rejected', 'Completed'] as const).map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                filterStatus === status 
                  ? 'bg-blue-600/20 text-blue-400' 
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </header>

      <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-900/50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">SO Number</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Project Name</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Designer</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Total Rooms</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Phase 1 Score</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Phase 2 Score</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700 bg-gray-800">
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">
                    No projects found for the selected filter.
                  </td>
                </tr>
              ) : (
                filteredProjects.map((project) => (
                  <tr 
                    key={project.id} 
                    onClick={() => setSelectedProject(project)}
                    className="hover:bg-gray-700/50 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-400 group-hover:text-blue-400">{project.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-200">{project.projectName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{project.designerName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{project.totalRooms}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{project.phase1Score ?? '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{project.phase2Score ?? '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        project.status === 'Completed' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                        project.status === 'Approved' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                        project.status === 'To review' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                        'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}>
                        {project.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ProjectDetailsModal 
        project={selectedProject} 
        onClose={() => setSelectedProject(null)} 
      />
    </div>
  );
};
