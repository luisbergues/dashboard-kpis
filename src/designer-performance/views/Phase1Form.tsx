import React, { useState, useEffect } from 'react';
import { useKpi } from '../context/KpiContext';
import { calculatePhase1ScoreAndStatus, calculateTechnicalPoints } from '../utils/scoreCalculator';
import toast from 'react-hot-toast';
import type { Project, ProjectStatus } from '../types';

// Checklist uses timestamp (number) when checked, false when not
type ChecklistState = {
  kcdFile: number | false;
  jlContract: number | false;
  quoteComplete: number | false;
  drawingsSigned: number | false;
  finalMeasurementsApplies: number | false;
  finalMeasurementsDelivered: number | false;
};

const emptyChecklist: ChecklistState = {
  kcdFile: false,
  jlContract: false,
  quoteComplete: false,
  drawingsSigned: false,
  finalMeasurementsApplies: false,
  finalMeasurementsDelivered: false,
};

const emptyComplexity = {
  colorsDefined: false,
  thermofoilDoors: false,
  customBoreHoles: false,
  routingRequired: false,
  customPanels: false,
};

export const Phase1Form: React.FC = () => {
  const { designers, projects, addProject, updateProject } = useKpi();

  const [mode, setMode] = useState<'New' | 'Update'>('New');
  const [soNumber, setSoNumber] = useState('');
  const [projectName, setProjectName] = useState('');
  const [designerName, setDesignerName] = useState('');
  const [totalRooms, setTotalRooms] = useState<number | ''>('');
  const [checklist, setChecklist] = useState<ChecklistState>(emptyChecklist);
  const [complexity, setComplexity] = useState(emptyComplexity);

  const updatableProjects = projects.filter(p => p.status === 'Rejected' || p.status === 'To review');

  // Pre-fill when selecting a project in Update mode
  useEffect(() => {
    if (mode === 'Update' && soNumber) {
      const existing = projects.find(p => p.id === soNumber && (p.status === 'Rejected' || p.status === 'To review'));
      if (existing) {
        setProjectName(existing.projectName);
        setDesignerName(existing.designerName);
        setTotalRooms(existing.totalRooms);
        setChecklist(existing.checklist);
        setComplexity(existing.complexity);
      }
    }
  }, [mode, soNumber, projects]);

  // Reset form when switching to New mode
  useEffect(() => {
    if (mode === 'New') resetForm();
  }, [mode]);

  const resetForm = () => {
    setSoNumber('');
    setProjectName('');
    setDesignerName('');
    setTotalRooms('');
    setChecklist(emptyChecklist);
    setComplexity(emptyComplexity);
  };

  // Toggle a checklist item: if currently unchecked → stamp Date.now(), if checked → clear to false
  const handleChecklistToggle = (field: keyof ChecklistState) => {
    setChecklist(prev => ({
      ...prev,
      [field]: prev[field] === false ? Date.now() : false,
    }));
  };

  const handleComplexityChange = (field: keyof typeof complexity) => {
    setComplexity(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSubmit = (e: React.FormEvent, forceReviewStatus: boolean = false) => {
    e.preventDefault();

    if (!soNumber || !projectName || !designerName || totalRooms === '') {
      toast.error('Please fill in all basic project details (including SO Number).');
      return;
    }

    if (mode === 'New' && projects.some(p => p.id === soNumber)) {
      toast.error('A project with this SO Number already exists.');
      return;
    }

    let finalStatus: ProjectStatus;
    let score: number | null;

    if (forceReviewStatus) {
      finalStatus = 'To review';
      score = null;
    } else {
      const result = calculatePhase1ScoreAndStatus(checklist);
      finalStatus = result.status;
      score = result.score;
    }

    const technicalPoints = calculateTechnicalPoints(complexity);
    const icp = Number(totalRooms) + technicalPoints;
    const now = Date.now();
    const approvedAt = finalStatus === 'Approved' ? now : null;

    if (mode === 'New') {
      const newProject: Project = {
        id: soNumber,
        createdAt: now,
        approvedAt,
        projectName,
        designerName,
        status: finalStatus,
        totalRooms: Number(totalRooms),
        icp,
        phase1Score: score,
        phase2Score: null,
        checklist,
        complexity,
      };
      addProject(newProject);
      if (finalStatus === 'To review') toast.success('Project saved for later review.');
      else if (finalStatus === 'Approved') toast.success('Project Registered & Approved!');
      else toast.success('Project Registered but Rejected (Missing Docs)');
      resetForm();
    } else {
      const existing = projects.find(p => p.id === soNumber);
      if (!existing) return;

      const updatedProject: Project = {
        ...existing,
        projectName,
        designerName,
        status: finalStatus,
        totalRooms: Number(totalRooms),
        icp,
        phase1Score: score,
        checklist,
        complexity,
        approvedAt: finalStatus === 'Approved' ? now : existing.approvedAt,
      };
      updateProject(updatedProject);
      if (finalStatus === 'Approved') {
        toast.success('Project Updated & Approved!');
        resetForm();
        setMode('New');
      } else if (finalStatus === 'To review') {
        toast.success('Project saved as "To review".');
      } else {
        toast.success('Project updated – still Rejected.');
      }
    }
  };

  const formatDate = (ts: number | false) =>
    ts ? new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-gray-100">Phase 1: Project Intake</h2>
        <p className="text-gray-400 mt-1">Register a new project or update documentation for a rejected one.</p>
      </header>

      {/* Mode Selector */}
      <div className="flex bg-gray-800 rounded-lg border border-gray-700 p-1 shadow-sm w-fit">
        <button
          onClick={() => setMode('New')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            mode === 'New' ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
          }`}
        >
          Register New Project
        </button>
        <button
          onClick={() => setMode('Update')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            mode === 'Update' ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
          }`}
        >
          Update Project
        </button>
      </div>

      <form className="space-y-8 bg-gray-800 p-8 rounded-xl border border-gray-700 shadow-xl">

        {/* Basic Info */}
        <section className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-100 border-b border-gray-700 pb-2">Basic Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mode === 'Update' ? (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-1">Select Project (SO Number)</label>
                <select
                  value={soNumber}
                  onChange={e => setSoNumber(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-100 outline-none"
                >
                  <option value="">Select a project...</option>
                  {updatableProjects.map(p => (
                    <option key={p.id} value={p.id}>{p.id} – {p.projectName} ({p.status})</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">SO Number</label>
                <input
                  type="text"
                  value={soNumber}
                  onChange={e => setSoNumber(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-100 outline-none"
                  placeholder="e.g., SO-12345"
                />
              </div>
            )}

            <div className={mode === 'Update' ? 'opacity-60 pointer-events-none' : ''}>
              <label className="block text-sm font-medium text-gray-300 mb-1">Project Name</label>
              <input
                type="text"
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                readOnly={mode === 'Update'}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-100 outline-none"
                placeholder="e.g., Smith Residence"
              />
            </div>

            <div className={mode === 'Update' ? 'opacity-60 pointer-events-none' : ''}>
              <label className="block text-sm font-medium text-gray-300 mb-1">Designer</label>
              <select
                value={designerName}
                onChange={e => setDesignerName(e.target.value)}
                disabled={mode === 'Update'}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-100 outline-none"
              >
                <option value="">Select a designer...</option>
                {designers.map(d => (
                  <option key={d.name} value={d.name}>{d.name}</option>
                ))}
              </select>
            </div>

            <div className={mode === 'Update' ? 'opacity-60 pointer-events-none' : ''}>
              <label className="block text-sm font-medium text-gray-300 mb-1">Total Rooms</label>
              <input
                type="number"
                min="1"
                value={totalRooms}
                onChange={e => setTotalRooms(e.target.value === '' ? '' : Number(e.target.value))}
                readOnly={mode === 'Update'}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-100 outline-none"
              />
            </div>
          </div>
        </section>

        {/* Go/No-Go Checklist */}
        <section className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-100 border-b border-gray-700 pb-2">Strict Go/No-Go Checklist</h3>
          <p className="text-sm text-gray-400">Check each item when the documentation is received. The date will be recorded automatically.</p>

          <div className="space-y-3">
            {([
              { id: 'kcdFile', label: 'KCD file (complete & latest)' },
              { id: 'jlContract', label: 'JL Contract (complete & signed)' },
              { id: 'quoteComplete', label: 'Quote (complete by room)' },
              { id: 'drawingsSigned', label: 'Drawings (signed by client)' },
              { id: 'finalMeasurementsApplies', label: 'Does "Final Measurements" apply here?' },
            ] as { id: keyof ChecklistState; label: string }[]).map(item => (
              <div key={item.id} className="flex items-center justify-between group">
                <label className="flex items-center space-x-3 cursor-pointer w-fit">
                  <input
                    type="checkbox"
                    checked={checklist[item.id] !== false}
                    onChange={() => handleChecklistToggle(item.id)}
                    className="w-5 h-5 text-blue-500 bg-gray-900 border-gray-600 rounded focus:ring-blue-500 focus:ring-offset-gray-800"
                  />
                  <span className="text-gray-300 group-hover:text-gray-100 transition-colors">{item.label}</span>
                </label>
                {checklist[item.id] !== false && (
                  <span className="text-xs text-blue-400 bg-blue-900/20 border border-blue-800/30 px-2 py-1 rounded-md ml-4 whitespace-nowrap">
                    ✓ {formatDate(checklist[item.id])}
                  </span>
                )}
              </div>
            ))}

            {checklist.finalMeasurementsApplies !== false && (
              <div className="flex items-center justify-between ml-8 p-3 bg-blue-900/20 rounded-lg border border-blue-800/30">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checklist.finalMeasurementsDelivered !== false}
                    onChange={() => handleChecklistToggle('finalMeasurementsDelivered')}
                    className="w-5 h-5 text-blue-500 bg-gray-900 border-gray-600 rounded focus:ring-blue-500 focus:ring-offset-gray-800"
                  />
                  <span className="text-blue-400 font-medium">Final Measurements delivered?</span>
                </label>
                {checklist.finalMeasurementsDelivered !== false && (
                  <span className="text-xs text-blue-400 bg-blue-900/30 border border-blue-800/30 px-2 py-1 rounded-md ml-4 whitespace-nowrap">
                    ✓ {formatDate(checklist.finalMeasurementsDelivered)}
                  </span>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Technical Complexity */}
        <section className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-100 border-b border-gray-700 pb-2">Technical Complexity</h3>
          <p className="text-sm text-gray-400">These items add points to the Index of Complexity (ICP) for Phase 2.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {([
              { id: 'colorsDefined', label: 'Colors per room defined? (+2)' },
              { id: 'thermofoilDoors', label: 'Thermofoil / Elements doors? (+1)' },
              { id: 'customBoreHoles', label: 'Custom bore holes? (+4)' },
              { id: 'routingRequired', label: 'Routing required? (+2)' },
              { id: 'customPanels', label: 'Custom panels? (+1)' },
            ] as { id: keyof typeof complexity; label: string }[]).map(item => (
              <label key={item.id} className="flex items-center space-x-3 cursor-pointer group w-fit">
                <input
                  type="checkbox"
                  checked={complexity[item.id]}
                  onChange={() => handleComplexityChange(item.id)}
                  className="w-5 h-5 text-indigo-500 bg-gray-900 border-gray-600 rounded focus:ring-indigo-500 focus:ring-offset-gray-800"
                />
                <span className="text-gray-300 group-hover:text-gray-100 transition-colors">{item.label}</span>
              </label>
            ))}
          </div>
        </section>

        <div className="pt-6 border-t border-gray-700 flex flex-col sm:flex-row gap-4">
          <button
            type="button"
            onClick={(e) => handleSubmit(e, true)}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-200 font-medium py-3 px-4 rounded-lg transition-colors border border-gray-600"
          >
            Save for Later Review
          </button>
          <button
            type="button"
            onClick={(e) => handleSubmit(e, false)}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors focus:ring-4 focus:ring-blue-900"
          >
            {mode === 'New' ? 'Submit Project Intake' : 'Save Updates & Validate'}
          </button>
        </div>
      </form>
    </div>
  );
};
