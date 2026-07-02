import React from 'react';
import { X } from 'lucide-react';
import type { Project } from '../types';

interface ModalProps {
  project: Project | null;
  onClose: () => void;
}

export const ProjectDetailsModal: React.FC<ModalProps> = ({ project, onClose }) => {
  if (!project) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-start p-6 border-b border-gray-700 bg-gray-800">
          <div>
            <h2 className="text-2xl font-bold text-gray-100">{project.projectName}</h2>
            <p className="text-gray-400 mt-1">SO Number: {project.id} | Designer: {project.designerName}</p>
            <div className="flex gap-4 mt-2 text-sm text-gray-500">
              <span>Registered: {new Date(project.createdAt).toLocaleDateString()}</span>
              {project.approvedAt && (
                <span className="text-blue-400 font-medium">Approved: {new Date(project.approvedAt).toLocaleDateString()}</span>
              )}
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-300 hover:bg-gray-700 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-8 bg-gray-900">
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
              <span className="block text-xs text-gray-400 uppercase font-semibold">Status</span>
              <span className={`block mt-1 font-bold ${
                project.status === 'Completed' ? 'text-green-400' :
                project.status === 'Approved' ? 'text-blue-400' :
                project.status === 'To review' ? 'text-yellow-400' :
                'text-red-400'
              }`}>{project.status}</span>
            </div>
            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
              <span className="block text-xs text-gray-400 uppercase font-semibold">Total Rooms</span>
              <span className="block mt-1 font-bold text-gray-100">{project.totalRooms}</span>
            </div>
            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
              <span className="block text-xs text-gray-400 uppercase font-semibold">Phase 1 (ICE)</span>
              <span className="block mt-1 font-bold text-gray-100">{project.phase1Score ?? 'N/A'}</span>
            </div>
            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
              <span className="block text-xs text-gray-400 uppercase font-semibold">Phase 2 (IFR)</span>
              <span className="block mt-1 font-bold text-gray-100">{project.phase2Score ?? 'N/A'}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Phase 1 Summary */}
            <section className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-100 border-b border-gray-700 pb-2">Phase 1 Summary</h3>
              
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-300">Checklist</h4>
                <ul className="text-sm text-gray-400 space-y-2 bg-gray-800 p-3 rounded-lg border border-gray-700">
                  {([
                    { key: 'kcdFile', label: 'KCD File' },
                    { key: 'jlContract', label: 'JL Contract' },
                    { key: 'quoteComplete', label: 'Quote Complete' },
                    { key: 'drawingsSigned', label: 'Drawings Signed' },
                  ] as { key: keyof typeof project.checklist; label: string }[]).map(item => (
                    <li key={item.key} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        {project.checklist[item.key] !== false ? '✅' : '❌'}
                        {item.label}
                      </span>
                      {project.checklist[item.key] !== false && (
                        <span className="text-xs text-blue-400 bg-blue-900/20 border border-blue-800/30 px-2 py-0.5 rounded whitespace-nowrap">
                          {new Date(project.checklist[item.key] as number).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      )}
                    </li>
                  ))}
                  {project.checklist.finalMeasurementsApplies !== false && (
                    <li className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        {project.checklist.finalMeasurementsDelivered !== false ? '✅' : '❌'}
                        Final Measurements Delivered
                      </span>
                      {project.checklist.finalMeasurementsDelivered !== false && (
                        <span className="text-xs text-blue-400 bg-blue-900/20 border border-blue-800/30 px-2 py-0.5 rounded whitespace-nowrap">
                          {new Date(project.checklist.finalMeasurementsDelivered as number).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      )}
                    </li>
                  )}
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-300">Technical Complexity</h4>
                <ul className="text-sm text-gray-400 space-y-1 bg-gray-800 p-3 rounded-lg border border-gray-700">
                  <li>Colors Defined (+2): {project.complexity.colorsDefined ? '✅' : '❌'}</li>
                  <li>Thermofoil/Elements (+1): {project.complexity.thermofoilDoors ? '✅' : '❌'}</li>
                  <li>Custom Bore Holes (+4): {project.complexity.customBoreHoles ? '✅' : '❌'}</li>
                  <li>Routing Required (+2): {project.complexity.routingRequired ? '✅' : '❌'}</li>
                  <li>Custom Panels (+1): {project.complexity.customPanels ? '✅' : '❌'}</li>
                </ul>
              </div>
            </section>

            {/* Phase 2 Summary */}
            <section className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-100 border-b border-gray-700 pb-2">Phase 2 Summary</h3>
              
              <div className="bg-blue-900/20 border border-blue-800/30 p-4 rounded-lg flex justify-between items-center">
                <span className="text-blue-300 font-medium">Index of Complexity (ICP)</span>
                <span className="text-xl font-bold text-blue-400">{project.icp}</span>
              </div>

              {project.phase2Data ? (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-300">Friction Metrics</h4>
                  <ul className="text-sm text-gray-400 space-y-1 bg-gray-800 p-3 rounded-lg border border-gray-700">
                    <li>Total Red Flags: <span className="font-bold text-red-400">{project.phase2Data.totalRedFlags}</span></li>
                    <li>Red Flags &gt; 4 Days: <span className="font-bold text-red-400">{project.phase2Data.redFlagsOver4Days}</span></li>
                  </ul>
                </div>
              ) : (
                <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg text-center text-sm text-gray-500 italic">
                  Project has not completed Phase 2 yet.
                </div>
              )}
            </section>

          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 bg-gray-800 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm font-medium rounded-lg transition-colors border border-gray-600"
          >
            Close Details
          </button>
        </div>

      </div>
    </div>
  );
};
