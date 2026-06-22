import React, { useState, useRef } from 'react';
import { X, Plus, Trash2, Printer } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import PDFPrintLayout from './PDFPrintLayout';
import './PDFGeneratorModal.css';

const DEFAULT_DRAWERS = [
  { front: '6 1/8" x 23 5/8"', qty: 2, open: '23 1/8"', box: '22 1/8" W x 15 3/4" D x 4" H', room: 'Her Master', handles: '' },
  { front: '7 3/8" x 23 5/8"', qty: 6, open: '23 1/8"', box: '22 1/8" W x 15 3/4" D x 6" H', room: 'Her Master', handles: '' },
  { front: '9 7/8" x 23 5/8"', qty: 2, open: '23 1/8"', box: '22 1/8" W x 15 3/4" D x 8" H', room: 'Her Master', handles: '' },
];

const DEFAULT_RODS = [
  { room: 'Her Master', type: 'Oval Chrome rod', qty: 5, size: '29 3/8"' },
  { room: 'Her Master', type: 'Oval Chrome rod', qty: 1, size: '24"' }
];

export default function PDFGeneratorModal({ project, onClose }) {
  // --- Header State ---
  const [headerData, setHeaderData] = useState({
    jobName: `${project.so} - ${project.name.split(':')[0].trim()}`,
    color: 'White Classic 300',
    rooms: 'Her Master, His Master',
    designer: project.designer || 'Russell',
    engineer: project.eng || 'JS'
  });

  // --- Drawers State ---
  const [drawerOptions, setDrawerOptions] = useState({
    fronts: 'THERMOFOIL',
    box: 'DOVETAIL',
    slides: 'SOFT CLOSE',
    handles: 'STD. CHROME'
  });

  const [drawers, setDrawers] = useState([...DEFAULT_DRAWERS]);

  const addDrawer = () => setDrawers([...drawers, { front: '', qty: 1, open: '', box: '', room: '', handles: '' }]);
  const removeDrawer = (index) => setDrawers(drawers.filter((_, i) => i !== index));
  const updateDrawer = (index, field, value) => {
    const newDrawers = [...drawers];
    newDrawers[index][field] = value;
    setDrawers(newDrawers);
  };

  // --- Rods State ---
  const [rods, setRods] = useState([...DEFAULT_RODS]);
  const addRod = () => setRods([...rods, { room: '', type: 'Oval Chrome rod', qty: 1, size: '' }]);
  const removeRod = (index) => setRods(rods.filter((_, i) => i !== index));
  const updateRod = (index, field, value) => {
    const newRods = [...rods];
    newRods[index][field] = value;
    setRods(newRods);
  };

  // --- Miscellaneous State ---
  const [miscCol1, setMiscCol1] = useState('HER MASTER\n• Edge-band exposed top edges Right panel #4 + filler #5');
  const [miscCol2, setMiscCol2] = useState('');

  // --- Print Logic ---
  const printRef = useRef();
  
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `ESS_SO_${project.so}`,
    removeAfterPrint: true,
  });

  const handleHeaderChange = (e) => {
    setHeaderData({ ...headerData, [e.target.name]: e.target.value });
  };

  const handleOptionsChange = (e) => {
    setDrawerOptions({ ...drawerOptions, [e.target.name]: e.target.value });
  };

  return (
    <div className="pdf-modal-overlay animate-fade-in">
      <div className="pdf-modal-content">
        <div className="pdf-modal-header">
          <h2>Completar ESS - Proyecto {project.so}</h2>
          <div className="pdf-modal-actions">
            <button className="btn-primary btn-sm" onClick={handlePrint}>
              <Printer size={16} /> Imprimir / Guardar PDF
            </button>
            <button className="btn-icon" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="pdf-modal-body">
          <div className="form-section">
            <h3>Cabecera (Header)</h3>
            <div className="form-grid">
              <label>JOB NAME: <input type="text" name="jobName" value={headerData.jobName} onChange={handleHeaderChange} /></label>
              <label>COLOR: <input type="text" name="color" value={headerData.color} onChange={handleHeaderChange} /></label>
              <label>ROOM(S): <input type="text" name="rooms" value={headerData.rooms} onChange={handleHeaderChange} /></label>
              <label>DESIGNER: <input type="text" name="designer" value={headerData.designer} onChange={handleHeaderChange} /></label>
              <label>ENGINEER: <input type="text" name="engineer" value={headerData.engineer} onChange={handleHeaderChange} /></label>
            </div>
          </div>

          <div className="form-section">
            <h3>Opciones de Cajoneras (Drawers)</h3>
            <div className="form-grid">
              <label>FRONTS: 
                <select name="fronts" value={drawerOptions.fronts} onChange={handleOptionsChange}>
                  <option value="SLAB">SLAB</option>
                  <option value="THERMOFOIL">THERMOFOIL</option>
                </select>
              </label>
              <label>BOX: 
                <select name="box" value={drawerOptions.box} onChange={handleOptionsChange}>
                  <option value="PRFV">PRFV</option>
                  <option value="DOVETAIL">DOVETAIL</option>
                </select>
              </label>
              <label>SLIDES: 
                <select name="slides" value={drawerOptions.slides} onChange={handleOptionsChange}>
                  <option value="SOFT CLOSE">SOFT CLOSE</option>
                  <option value="FULL EXTENSION">FULL EXTENSION</option>
                </select>
              </label>
              <label>HANDLES: 
                <select name="handles" value={drawerOptions.handles} onChange={handleOptionsChange}>
                  <option value="STD. B. NICKEL">STD. B. NICKEL</option>
                  <option value="STD. CHROME">STD. CHROME</option>
                  <option value="STD. M. BLACK">STD. M. BLACK</option>
                  <option value="NONE">NONE</option>
                  <option value="CUSTOMER OWN">CUSTOMER OWN</option>
                  <option value="SPECIAL">SPECIAL</option>
                </select>
              </label>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>FRONT (H x W)</th><th>QTY</th><th>OPEN.</th><th>BOX (W x D x H)</th><th>ROOM</th><th>SPECIAL HANDLES</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {drawers.map((d, i) => (
                    <tr key={i}>
                      <td><input value={d.front} onChange={e => updateDrawer(i, 'front', e.target.value)} /></td>
                      <td><input type="number" style={{width: '60px'}} value={d.qty} onChange={e => updateDrawer(i, 'qty', e.target.value)} /></td>
                      <td><input value={d.open} onChange={e => updateDrawer(i, 'open', e.target.value)} /></td>
                      <td><input value={d.box} onChange={e => updateDrawer(i, 'box', e.target.value)} /></td>
                      <td><input value={d.room} onChange={e => updateDrawer(i, 'room', e.target.value)} /></td>
                      <td><input value={d.handles} onChange={e => updateDrawer(i, 'handles', e.target.value)} /></td>
                      <td><button className="btn-icon danger" onClick={() => removeDrawer(i)}><Trash2 size={16} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="btn-secondary btn-sm" onClick={addDrawer} style={{marginTop: '10px'}}><Plus size={14} /> Añadir Fila Cajón</button>
            </div>
          </div>

          <div className="form-section">
            <h3>Barrales (Rods)</h3>
            <div className="table-container" style={{maxWidth: '500px'}}>
              <table>
                <thead>
                  <tr>
                    <th>ROOM</th><th>TYPE</th><th>QTY</th><th>SIZE</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {rods.map((r, i) => (
                    <tr key={i}>
                      <td><input value={r.room} onChange={e => updateRod(i, 'room', e.target.value)} /></td>
                      <td><input value={r.type} onChange={e => updateRod(i, 'type', e.target.value)} /></td>
                      <td><input type="number" style={{width: '60px'}} value={r.qty} onChange={e => updateRod(i, 'qty', e.target.value)} /></td>
                      <td><input value={r.size} onChange={e => updateRod(i, 'size', e.target.value)} /></td>
                      <td><button className="btn-icon danger" onClick={() => removeRod(i)}><Trash2 size={16} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="btn-secondary btn-sm" onClick={addRod} style={{marginTop: '10px'}}><Plus size={14} /> Añadir Barral</button>
            </div>
          </div>

          <div className="form-section">
            <h3>Misceláneas / Notas (2 Columnas)</h3>
            <div className="misc-columns">
              <div style={{flex: 1}}>
                <label>Columna Izquierda</label>
                <textarea value={miscCol1} onChange={e => setMiscCol1(e.target.value)} rows={6} style={{width:'100%', padding:'8px'}}></textarea>
              </div>
              <div style={{flex: 1}}>
                <label>Columna Derecha</label>
                <textarea value={miscCol2} onChange={e => setMiscCol2(e.target.value)} rows={6} style={{width:'100%', padding:'8px'}}></textarea>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden print layout component. We only render it for the react-to-print library to capture */}
      <div style={{ display: 'none' }}>
        <div ref={printRef}>
          <PDFPrintLayout 
            headerData={headerData}
            drawerOptions={drawerOptions}
            drawers={drawers}
            rods={rods}
            miscCol1={miscCol1}
            miscCol2={miscCol2}
          />
        </div>
      </div>
    </div>
  );
}
