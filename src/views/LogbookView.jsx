import React, { useEffect, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import { loadLogbookData, saveLogbookData } from '../utils/logbookData';
import './LogbookView.css';

const emptyRoom = () => ({
  rName: '',
  rBack: 'Yes', rBackNote: '',
  rEb: 'Yes', rEbNote: '',
  rMoldTop: false, rMoldBot: false, rMoldNote: '',
  rThermo: 'No', rThermoNote: '',
  rBore: 'No', rBoreNote: '',
  rVl: 'No', rVlQ: '',
  rHl: 'No', rHlQ: '',
  tfl: [],
  doors: [],
  drawers: [],
  notes: []
});

const emptyProjectInfo = () => ({
  so: '', date: '', name: '', engineer: '',
  client: ['', '', '', ''],
  designer: ['', '', '']
});

const normalizeRooms = (rooms) => (
  Array.isArray(rooms) && rooms.length > 0
    ? rooms.map(room => ({
        ...emptyRoom(),
        ...room,
        tfl: Array.isArray(room?.tfl) ? room.tfl : [],
        doors: Array.isArray(room?.doors) ? room.doors : [],
        drawers: Array.isArray(room?.drawers) ? room.drawers : [],
        notes: Array.isArray(room?.notes) ? room.notes : []
      }))
    : [emptyRoom()]
);

export default function LogbookView({ so: propSo }) {
  const so = propSo || new URLSearchParams(window.location.search).get('logbook');

  const [projectInfo, setProjectInfo] = useState(emptyProjectInfo());
  const [rooms, setRooms] = useState([emptyRoom()]);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved data
  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      if (!so) { setIsLoading(false); return; }
      const data = await loadLogbookData(so);
      if (isMounted && data) {
        setProjectInfo({
          ...emptyProjectInfo(),
          ...data.projectInfo,
          so: data.projectInfo?.so || so,
          client: Array.isArray(data.projectInfo?.client) ? data.projectInfo.client : ['', '', '', ''],
          designer: Array.isArray(data.projectInfo?.designer) ? data.projectInfo.designer : ['', '', '']
        });
        setRooms(normalizeRooms(data.rooms));
      } else if (isMounted) {
        setProjectInfo(p => ({ ...p, so: so || '', date: new Date().toISOString().slice(0, 10) }));
      }
      if (isMounted) setIsLoading(false);
    };
    fetchData();
    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [so]);

  // Auto-save (debounced)
  useEffect(() => {
    if (isLoading || !so) return;
    const handler = setTimeout(() => {
      saveLogbookData(so, { projectInfo, rooms });
    }, 1000);
    return () => clearTimeout(handler);
  }, [projectInfo, rooms, isLoading, so]);

  // --- Project info field helpers ---
  const setField = (key, value) => setProjectInfo(p => ({ ...p, [key]: value }));
  const setClientField = (idx, value) => setProjectInfo(p => {
    const client = [...p.client]; client[idx] = value; return { ...p, client };
  });
  const setDesignerField = (idx, value) => setProjectInfo(p => {
    const designer = [...p.designer]; designer[idx] = value; return { ...p, designer };
  });

  // --- Room helpers ---
  const addRoom = () => setRooms(r => [...r, emptyRoom()]);
  const removeRoom = (idx) => setRooms(r => r.filter((_, i) => i !== idx));
  const updateRoom = (idx, patch) => setRooms(r => r.map((room, i) => i === idx ? { ...room, ...patch } : room));

  const addListRow = (roomIdx, listKey, row) => setRooms(r => r.map((room, i) =>
    i === roomIdx ? { ...room, [listKey]: [...room[listKey], row] } : room
  ));
  const updateListRow = (roomIdx, listKey, rowIdx, patch) => setRooms(r => r.map((room, i) => {
    if (i !== roomIdx) return room;
    const list = room[listKey].map((row, ri) => ri === rowIdx ? { ...row, ...patch } : row);
    return { ...room, [listKey]: list };
  }));
  const removeListRow = (roomIdx, listKey, rowIdx) => setRooms(r => r.map((room, i) => {
    if (i !== roomIdx) return room;
    return { ...room, [listKey]: room[listKey].filter((_, ri) => ri !== rowIdx) };
  }));

  // --- Save / Load JSON (kept from original HTML) ---
  const saveOrderJSON = () => {
    const data = { projectInfo, rooms };
    const fileName = `DesignProject_SO${projectInfo.so || 'New'}.json`;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
  };

  const fileInputRef = useRef(null);
  const loadOrderJSON = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        setProjectInfo({
          ...emptyProjectInfo(),
          ...data.projectInfo,
          client: Array.isArray(data.projectInfo?.client) ? data.projectInfo.client : ['', '', '', ''],
          designer: Array.isArray(data.projectInfo?.designer) ? data.projectInfo.designer : ['', '', '']
        });
        setRooms(normalizeRooms(data.rooms));
      } catch (err) {
        alert('Invalid file format.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // --- PDF generation (ported from original HTML, same layout/logic) ---
  const downloadPDF = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });

    let y = 50;
    const ml = 50, mr = 50, pageW = 612, colW = pageW - ml - mr;

    function checkPage(needed = 40) {
      if (y + needed > 740) { doc.addPage(); y = 50; }
    }

    function printText(label, value, x, isBold = false) {
      if (!value) return;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(100);
      doc.text(label + ':', x, y);
      const valX = x + doc.getStringUnitWidth(label + ':') * 8 + 5;
      doc.setFont('helvetica', isBold ? 'bold' : 'normal'); doc.setFontSize(9); doc.setTextColor(0);
      doc.text(String(value), valX, y);
    }

    doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
    doc.text(projectInfo.name || 'Untitled Project', ml, y);
    y += 18;
    printText('SO #', projectInfo.so, ml, true);
    printText('Date', projectInfo.date, ml + 150);
    printText('Engineer', projectInfo.engineer, ml + 300);
    y += 20;

    doc.setDrawColor(200); doc.line(ml, y, pageW - mr, y); y += 15;
    printText('Client', projectInfo.client[0], ml);
    printText('Designer', projectInfo.designer[0], ml + colW / 2); y += 12;
    printText('Address', projectInfo.client[1], ml);
    printText('Phone', projectInfo.designer[1], ml + colW / 2); y += 12;
    printText('Phone', projectInfo.client[2], ml);
    printText('Email', projectInfo.designer[2], ml + colW / 2); y += 12;
    printText('Email', projectInfo.client[3], ml);
    y += 20;

    rooms.forEach((r, idx) => {
      checkPage(100);
      doc.setFillColor(240, 240, 238);
      doc.rect(ml, y, colW, 20, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(0);
      doc.text(`ROOM ${idx + 1}: ${r.rName || 'Unnammed Room'}`, ml + 10, y + 14);
      y += 35;

      const drawTable = (title, rows, widths) => {
        if (!rows || rows.length === 0) return;
        checkPage(50);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(80);
        doc.text(title, ml, y); y += 12;
        doc.setDrawColor(200); doc.line(ml, y - 8, pageW - mr, y - 8);

        rows.forEach((row) => {
          checkPage(15);
          doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(0);
          row.forEach((cell, cIdx) => {
            const xOffset = cIdx === 0 ? ml : ml + widths.slice(0, cIdx).reduce((a, b) => a + b, 0);
            doc.text(String(cell || '-'), xOffset, y);
          });
          y += 14;
        });
        y += 10;
      };

      drawTable('TFL COLORS', r.tfl.map(t => [t.name, t.size, t.where]), [150, 100, 200]);

      printText('Backing', `${r.rBack} ${r.rBackNote ? '(' + r.rBackNote + ')' : ''}`, ml); y += 14;
      printText('EB', `${r.rEb}  ${r.rEbNote ? '(' + r.rEbNote + ')' : ''}`, ml); y += 14;

      let moldStr = [];
      if (r.rMoldTop) moldStr.push('Top');
      if (r.rMoldBot) moldStr.push('Bottom');
      printText('Molding', `${moldStr.join(' & ') || 'None'} ${r.rMoldNote ? '(' + r.rMoldNote + ')' : ''}`, ml); y += 14;

      printText('Thermofoil', `${r.rThermo} ${r.rThermoNote ? '(' + r.rThermoNote + ')' : ''}`, ml); y += 14;
      printText('Special Boreholes', `${r.rBore} ${r.rBoreNote ? '(' + r.rBoreNote + ')' : ''}`, ml); y += 14;
      printText('Lights', `Vert: ${r.rVl} (${r.rVlQ || 0})  |  Horiz: ${r.rHl} (${r.rHlQ || 0})`, ml); y += 25;

      drawTable('DOORS', r.doors.map(d => [d.qty, d.desc]), [40, 400]);
      drawTable('DRAWERS', r.drawers.map(d => [d.qty, d.desc]), [40, 400]);

      if (r.notes && r.notes.length > 0) {
        checkPage(40);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(80);
        doc.text('NOTES', ml, y); y += 12;
        doc.setFont('helvetica', 'normal'); doc.setTextColor(0);
        r.notes.forEach(noteRow => {
          checkPage(15);
          doc.text(`• ${noteRow.text}`, ml, y); y += 14;
        });
        y += 10;
      }
      y += 15;
    });

    const safeName = `SO${projectInfo.so || 'Draft'}_${(projectInfo.name || 'Project').replace(/\s+/g, '_')}`;
    doc.save(`${safeName}.pdf`);
  };

  if (isLoading) {
    return <div className="lb-loading">Loading logbook...</div>;
  }

  if (!so) {
    return <div className="lb-loading">Missing project SO number.</div>;
  }

  return (
    <div className="lb-root">
      <header className="lb-header">
        <h1>Design Project Order</h1>
        <div className="lb-header-actions">
          <span className="lb-autosave">Auto-save active</span>
          <button className="lb-btn-secondary" onClick={() => fileInputRef.current?.click()}>Upload Job</button>
          <button className="lb-btn-secondary" onClick={saveOrderJSON}>Save Job</button>
          <button className="lb-btn-pdf" onClick={downloadPDF} disabled={!pdfLibLoaded}>Create PDF</button>
          <input ref={fileInputRef} type="file" accept=".json,application/json" hidden onChange={loadOrderJSON} />
        </div>
      </header>

      <main className="lb-main">
        <div className="lb-section">
          <div className="lb-section-header"><h2>Project Information</h2></div>
          <div className="lb-grid-row"><div className="lb-field"><label>SO # (Sales Order)</label><input type="number" min="1" step="1" value={projectInfo.so} onChange={e => setField('so', e.target.value)} /></div></div>
          <div className="lb-grid-row"><div className="lb-field"><label>Date</label><input type="date" value={projectInfo.date} onChange={e => setField('date', e.target.value)} /></div></div>
          <div className="lb-grid-row"><div className="lb-field"><label>Project Name</label><input type="text" value={projectInfo.name} onChange={e => setField('name', e.target.value)} /></div></div>
          <div className="lb-grid-row"><div className="lb-field"><label>Engineer in Charge</label><input type="text" value={projectInfo.engineer} onChange={e => setField('engineer', e.target.value)} /></div></div>
          <div className="lb-grid-row"><div className="lb-field"><label>Client's Name</label><input type="text" value={projectInfo.client[0]} onChange={e => setClientField(0, e.target.value)} /></div></div>
          <div className="lb-grid-row"><div className="lb-field"><label>Client's Address</label><input type="text" value={projectInfo.client[1]} onChange={e => setClientField(1, e.target.value)} /></div></div>
          <div className="lb-grid-row"><div className="lb-field"><label>Client's Phone Number</label><input type="tel" value={projectInfo.client[2]} onChange={e => setClientField(2, e.target.value)} /></div></div>
          <div className="lb-grid-row"><div className="lb-field"><label>Client's Email</label><input type="email" value={projectInfo.client[3]} onChange={e => setClientField(3, e.target.value)} /></div></div>
          <div className="lb-grid-row"><div className="lb-field"><label>Designer's Name</label><input type="text" value={projectInfo.designer[0]} onChange={e => setDesignerField(0, e.target.value)} /></div></div>
          <div className="lb-grid-row"><div className="lb-field"><label>Designer's Phone Number</label><input type="tel" value={projectInfo.designer[1]} onChange={e => setDesignerField(1, e.target.value)} /></div></div>
          <div className="lb-grid-row"><div className="lb-field"><label>Designer's Email</label><input type="email" value={projectInfo.designer[2]} onChange={e => setDesignerField(2, e.target.value)} /></div></div>
        </div>

        <div className="lb-rooms-container">
          {rooms.map((room, roomIdx) => (
            <div className="lb-section lb-room-block" key={roomIdx}>
              <div className="lb-section-header">
                <h2>Room {roomIdx + 1}</h2>
                {rooms.length > 1 && (
                  <button className="lb-row-del" title="Remove Room" onClick={() => removeRoom(roomIdx)}>&times;</button>
                )}
              </div>

              <div className="lb-grid-row"><div className="lb-field"><label>Room Name</label><input type="text" placeholder="Ej: Master Kitchen" value={room.rName} onChange={e => updateRoom(roomIdx, { rName: e.target.value })} /></div></div>

              <div className="lb-subsection">
                <div className="lb-subsection-title">TFL Colors</div>
                <div className="lb-list-container">
                  {room.tfl.map((row, rowIdx) => (
                    <div className="lb-dynamic-row" key={rowIdx}>
                      <div className="lb-field"><label>Name</label><input type="text" placeholder="Color name..." value={row.name || ''} onChange={e => updateListRow(roomIdx, 'tfl', rowIdx, { name: e.target.value })} /></div>
                      <div className="lb-field lb-small"><label>Sheet Size</label><input type="text" placeholder="Size..." value={row.size || ''} onChange={e => updateListRow(roomIdx, 'tfl', rowIdx, { size: e.target.value })} /></div>
                      <div className="lb-field"><label>Where</label><input type="text" placeholder="Where used..." value={row.where || ''} onChange={e => updateListRow(roomIdx, 'tfl', rowIdx, { where: e.target.value })} /></div>
                      <button className="lb-row-del" onClick={() => removeListRow(roomIdx, 'tfl', rowIdx)}>&times;</button>
                    </div>
                  ))}
                </div>
                <button className="lb-btn-add-row" onClick={() => addListRow(roomIdx, 'tfl', { name: '', size: '', where: '' })}>+ Add TFL Color</button>
              </div>

              <div className="lb-grid-row">
                <div className="lb-field lb-small">
                  <label>Backing</label>
                  <select value={room.rBack} onChange={e => updateRoom(roomIdx, { rBack: e.target.value })}>
                    <option>Yes</option><option>No</option><option>Partial</option>
                  </select>
                </div>
                <div className="lb-field lb-large"><label>Backing Notes</label><input type="text" placeholder="Add observations here..." value={room.rBackNote} onChange={e => updateRoom(roomIdx, { rBackNote: e.target.value })} /></div>
              </div>

              <div className="lb-grid-row">
                <div className="lb-field lb-small">
                  <label>EB</label>
                  <select value={room.rEb} onChange={e => updateRoom(roomIdx, { rEb: e.target.value })}>
                    <option>Yes</option><option>No</option><option>Matching</option>
                  </select>
                </div>
                <div className="lb-field lb-large"><label>EB Notes</label><input type="text" placeholder="Add observations here..." value={room.rEbNote} onChange={e => updateRoom(roomIdx, { rEbNote: e.target.value })} /></div>
              </div>

              <div className="lb-grid-row">
                <div className="lb-field lb-small">
                  <label>Molding</label>
                  <div className="lb-checkbox-group">
                    <label><input type="checkbox" checked={room.rMoldTop} onChange={e => updateRoom(roomIdx, { rMoldTop: e.target.checked })} /> Top</label>
                    <label><input type="checkbox" checked={room.rMoldBot} onChange={e => updateRoom(roomIdx, { rMoldBot: e.target.checked })} /> Bottom</label>
                  </div>
                </div>
                <div className="lb-field lb-large"><label>Molding Notes</label><input type="text" placeholder="Add observations here..." value={room.rMoldNote} onChange={e => updateRoom(roomIdx, { rMoldNote: e.target.value })} /></div>
              </div>

              <div className="lb-grid-row">
                <div className="lb-field lb-small">
                  <label>Thermofoil</label>
                  <select value={room.rThermo} onChange={e => updateRoom(roomIdx, { rThermo: e.target.value })}>
                    <option>No</option><option>Yes</option>
                  </select>
                </div>
                <div className="lb-field lb-large"><label>Thermofoil Notes</label><input type="text" placeholder="Add observations here..." value={room.rThermoNote} onChange={e => updateRoom(roomIdx, { rThermoNote: e.target.value })} /></div>
              </div>

              <div className="lb-grid-row">
                <div className="lb-field lb-small">
                  <label>Special Boreholes</label>
                  <select value={room.rBore} onChange={e => updateRoom(roomIdx, { rBore: e.target.value })}>
                    <option>No</option><option>Yes</option>
                  </select>
                </div>
                <div className="lb-field lb-large"><label>Boreholes Notes</label><input type="text" placeholder="Add observations here..." value={room.rBoreNote} onChange={e => updateRoom(roomIdx, { rBoreNote: e.target.value })} /></div>
              </div>

              <div className="lb-grid-row">
                <div className="lb-field lb-small">
                  <label>Vertical Lights</label>
                  <select value={room.rVl} onChange={e => updateRoom(roomIdx, { rVl: e.target.value })}>
                    <option>No</option><option>Yes</option>
                  </select>
                </div>
                <div className="lb-field lb-xs"><label>Qty</label><input type="number" min="0" placeholder="0" value={room.rVlQ} onChange={e => updateRoom(roomIdx, { rVlQ: e.target.value })} /></div>
                <div className="lb-field lb-small" style={{ marginLeft: '20px' }}>
                  <label>Horizontal Lights</label>
                  <select value={room.rHl} onChange={e => updateRoom(roomIdx, { rHl: e.target.value })}>
                    <option>No</option><option>Yes</option>
                  </select>
                </div>
                <div className="lb-field lb-xs"><label>Qty</label><input type="number" min="0" placeholder="0" value={room.rHlQ} onChange={e => updateRoom(roomIdx, { rHlQ: e.target.value })} /></div>
              </div>

              <div className="lb-subsection">
                <div className="lb-subsection-title">Doors</div>
                <div className="lb-list-container">
                  {room.doors.map((row, rowIdx) => (
                    <div className="lb-dynamic-row" key={rowIdx}>
                      <div className="lb-field lb-xs"><label>Qty</label><input type="number" min="1" style={{ fontWeight: 'bold' }} value={row.qty || ''} onChange={e => updateListRow(roomIdx, 'doors', rowIdx, { qty: e.target.value })} /></div>
                      <div className="lb-field lb-large"><label>Description</label><input type="text" placeholder="Describe..." value={row.desc || ''} onChange={e => updateListRow(roomIdx, 'doors', rowIdx, { desc: e.target.value })} /></div>
                      <button className="lb-row-del" onClick={() => removeListRow(roomIdx, 'doors', rowIdx)}>&times;</button>
                    </div>
                  ))}
                </div>
                <button className="lb-btn-add-row" onClick={() => addListRow(roomIdx, 'doors', { qty: '', desc: '' })}>+ Add Door</button>
              </div>

              <div className="lb-subsection">
                <div className="lb-subsection-title">Drawers</div>
                <div className="lb-list-container">
                  {room.drawers.map((row, rowIdx) => (
                    <div className="lb-dynamic-row" key={rowIdx}>
                      <div className="lb-field lb-xs"><label>Qty</label><input type="number" min="1" style={{ fontWeight: 'bold' }} value={row.qty || ''} onChange={e => updateListRow(roomIdx, 'drawers', rowIdx, { qty: e.target.value })} /></div>
                      <div className="lb-field lb-large"><label>Description</label><input type="text" placeholder="Describe..." value={row.desc || ''} onChange={e => updateListRow(roomIdx, 'drawers', rowIdx, { desc: e.target.value })} /></div>
                      <button className="lb-row-del" onClick={() => removeListRow(roomIdx, 'drawers', rowIdx)}>&times;</button>
                    </div>
                  ))}
                </div>
                <button className="lb-btn-add-row" onClick={() => addListRow(roomIdx, 'drawers', { qty: '', desc: '' })}>+ Add Drawer</button>
              </div>

              <div className="lb-subsection">
                <div className="lb-subsection-title">Additional Notes</div>
                <div className="lb-list-container">
                  {room.notes.map((row, rowIdx) => (
                    <div className="lb-dynamic-row" key={rowIdx}>
                      <div className="lb-field lb-large"><input type="text" placeholder="Type note here..." value={row.text || ''} onChange={e => updateListRow(roomIdx, 'notes', rowIdx, { text: e.target.value })} /></div>
                      <button className="lb-row-del" onClick={() => removeListRow(roomIdx, 'notes', rowIdx)}>&times;</button>
                    </div>
                  ))}
                </div>
                <button className="lb-btn-add-row" onClick={() => addListRow(roomIdx, 'notes', { text: '' })}>+ Add Note</button>
              </div>
            </div>
          ))}
        </div>

        <button className="lb-btn-add-room" onClick={addRoom}>
          <span style={{ fontSize: '18px', fontWeight: 'normal' }}>+</span> Add New Room
        </button>
      </main>
    </div>
  );
}
