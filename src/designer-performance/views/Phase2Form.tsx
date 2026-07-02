import React, { useState } from 'react';
import { useKpi } from '../context/KpiContext';
import { calculatePhase2Score } from '../utils/scoreCalculator';
import toast from 'react-hot-toast';

export const Phase2Form: React.FC = () => {
  const { projects, updateProject } = useKpi();
  
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [totalRedFlags, setTotalRedFlags] = useState<number | ''>('');
  const [redFlagsOver4Days, setRedFlagsOver4Days] = useState<number | ''>('');

  const approvedProjects = projects.filter(p => p.status === 'Approved');
  const selectedProject = projects.find(p => p.id === selectedProjectId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProject) {
      toast.error('Please select an approved project.');
      return;
    }

    if (totalRedFlags === '' || redFlagsOver4Days === '') {
      toast.error('Please fill in all red flag fields.');
      return;
    }

    if (Number(redFlagsOver4Days) > Number(totalRedFlags)) {
      toast.error('Red flags > 4 days cannot exceed total red flags.');
      return;
    }

    const phase2Score = calculatePhase2Score(Number(totalRedFlags), Number(redFlagsOver4Days), selectedProject.icp);

    const updatedProject = {
      ...selectedProject,
      status: 'Completed' as const,
      phase2Score,
      phase2Data: {
        totalRedFlags: Number(totalRedFlags),
        redFlagsOver4Days: Number(redFlagsOver4Days)
      }
    };

    updateProject(updatedProject);
    toast.success(`Project Closed! Phase 2 Score (IFR): ${phase2Score}`);

    setSelectedProjectId('');
    setTotalRedFlags('');
    setRedFlagsOver4Days('');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-gray-100">Phase 2: Project Closure</h2>
        <p className="text-gray-400 mt-1">Calculate the Friction & Response Index (IFR) for approved projects.</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-8 bg-gray-800 p-8 rounded-xl border border-gray-700 shadow-xl">
        
        <section className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-100 border-b border-gray-700 pb-2">Select Project</h3>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Approved Project</label>
            <select 
              value={selectedProjectId}
              onChange={e => setSelectedProjectId(e.target.value)}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-100"
            >
              <option value="">Select a project...</option>
              {approvedProjects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.id} — {p.projectName} ({p.designerName})
                </option>
              ))}
            </select>
          </div>

          {selectedProject && (
            <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700 mt-4">
              <h4 className="text-sm font-medium text-gray-400 mb-2">Project Metrics</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-xs text-gray-500">Total Rooms</span>
                  <span className="block text-lg font-semibold text-gray-100">{selectedProject.totalRooms}</span>
                </div>
                <div>
                  <span className="block text-xs text-gray-500">Index of Complexity (ICP)</span>
                  <span className="block text-lg font-semibold text-blue-400">{selectedProject.icp}</span>
                </div>
              </div>
            </div>
          )}
        </section>

        {selectedProject && (
          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-100 border-b border-gray-700 pb-2">Friction Metrics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Total Red Flags</label>
                <input 
                  type="number" 
                  min="0"
                  value={totalRedFlags}
                  onChange={e => setTotalRedFlags(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-100 outline-none transition-shadow"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Red Flags &gt; 4 days</label>
                <input 
                  type="number" 
                  min="0"
                  value={redFlagsOver4Days}
                  onChange={e => setRedFlagsOver4Days(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-100 outline-none transition-shadow"
                />
              </div>
            </div>
          </section>
        )}

        <div className="pt-4 border-t border-gray-700">
          <button 
            type="submit"
            disabled={!selectedProject}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors focus:ring-4 focus:ring-blue-900"
          >
            Calculate Phase 2 & Close Project
          </button>
        </div>
      </form>
    </div>
  );
};
