import React, { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { loadLogbookData, saveLogbookData } from '../utils/logbookData';
import { db, ref, get, isConfigured } from '../utils/firebase';
import { useDesignerContacts } from '../utils/useDesignerContacts';
import { useLanguage } from '../utils/LanguageContext';
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
  const { contacts } = useDesignerContacts();
  const { t } = useLanguage();
  const lf = (key) => t(`myProjects.logbookForm.${key}`);

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

  // Auto-fill Designer's Name/Phone/Email from the project's assigned
  // designer (Firebase `project_designers/{so}`) when those fields are
  // still blank — never overwrites values the user already typed/loaded.
  useEffect(() => {
    if (isLoading || !so || !isConfigured || !db) return;
    const hasDesignerInfo = projectInfo.designer.some(v => v && v.trim());
    if (hasDesignerInfo) return;

    let isMounted = true;
    get(ref(db, `project_designers/${so}`)).then(snapshot => {
      if (!isMounted) return;
      const designerName = snapshot.val();
      if (!designerName) return;
      const contact = contacts.find(c => c.name === designerName || (c.aliases || []).includes(designerName));
      setProjectInfo(p => {
        if (p.designer.some(v => v && v.trim())) return p; // filled in meanwhile
        return { ...p, designer: [designerName, contact?.phone || '', contact?.email || ''] };
      });
    }).catch(error => {
      console.error('Failed to auto-fill designer info:', error);
    });
    return () => { isMounted = false; };
  }, [isLoading, so, contacts]);

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
    return <div className="lb-loading">{lf('loading')}</div>;
  }

  if (!so) {
    return <div className="lb-loading">{lf('missingSo')}</div>;
  }

  return (
    <div className="lb-root">
      <div className="lb-window">
      <header className="lb-header">
        <h1>{lf('title')}</h1>
        <div className="lb-header-actions">
          <span className="lb-autosave">{t('myProjects.autoSaveActive')}</span>
          <a href={window.location.origin} className="lb-btn-secondary lb-btn-link">
            <ExternalLink size={14} /> {lf('openDashboard')}
          </a>
          <button className="lb-btn-pdf" onClick={downloadPDF}>{lf('createPdf')}</button>
        </div>
      </header>

      <main className="lb-main">
        <div className="lb-section">
          <div className="lb-section-header"><h2>{lf('projectInformation')}</h2></div>
          <div className="lb-grid-row"><div className="lb-field"><label>{lf('soNumber')}</label><input type="number" min="1" step="1" value={projectInfo.so} onChange={e => setField('so', e.target.value)} /></div></div>
          <div className="lb-grid-row"><div className="lb-field"><label>{lf('date')}</label><input type="date" value={projectInfo.date} onChange={e => setField('date', e.target.value)} /></div></div>
          <div className="lb-grid-row"><div className="lb-field"><label>{lf('projectName')}</label><input type="text" value={projectInfo.name} onChange={e => setField('name', e.target.value)} /></div></div>
          <div className="lb-grid-row"><div className="lb-field"><label>{lf('engineerInCharge')}</label><input type="text" value={projectInfo.engineer} onChange={e => setField('engineer', e.target.value)} /></div></div>
          <div className="lb-grid-row"><div className="lb-field"><label>{lf('clientName')}</label><input type="text" value={projectInfo.client[0]} onChange={e => setClientField(0, e.target.value)} /></div></div>
          <div className="lb-grid-row"><div className="lb-field"><label>{lf('clientAddress')}</label><input type="text" value={projectInfo.client[1]} onChange={e => setClientField(1, e.target.value)} /></div></div>
          <div className="lb-grid-row"><div className="lb-field"><label>{lf('clientPhone')}</label><input type="tel" value={projectInfo.client[2]} onChange={e => setClientField(2, e.target.value)} /></div></div>
          <div className="lb-grid-row"><div className="lb-field"><label>{lf('clientEmail')}</label><input type="email" value={projectInfo.client[3]} onChange={e => setClientField(3, e.target.value)} /></div></div>
          <div className="lb-grid-row"><div className="lb-field"><label>{lf('designerName')}</label><input type="text" value={projectInfo.designer[0]} onChange={e => setDesignerField(0, e.target.value)} /></div></div>
          <div className="lb-grid-row"><div className="lb-field"><label>{lf('designerPhone')}</label><input type="tel" value={projectInfo.designer[1]} onChange={e => setDesignerField(1, e.target.value)} /></div></div>
          <div className="lb-grid-row"><div className="lb-field"><label>{lf('designerEmail')}</label><input type="email" value={projectInfo.designer[2]} onChange={e => setDesignerField(2, e.target.value)} /></div></div>
        </div>

        <div className="lb-rooms-container">
          {rooms.map((room, roomIdx) => (
            <div className="lb-section lb-room-block" key={roomIdx}>
              <div className="lb-section-header">
                <h2>{lf('room')} {roomIdx + 1}</h2>
                {rooms.length > 1 && (
                  <button className="lb-row-del" title={lf('removeRoom')} onClick={() => removeRoom(roomIdx)}>&times;</button>
                )}
              </div>

              <div className="lb-grid-row"><div className="lb-field"><label>{lf('roomName')}</label><input type="text" placeholder={lf('roomNamePlaceholder')} value={room.rName} onChange={e => updateRoom(roomIdx, { rName: e.target.value })} /></div></div>

              <div className="lb-subsection">
                <div className="lb-subsection-title">{lf('tflColors')}</div>
                <div className="lb-list-container">
                  {room.tfl.map((row, rowIdx) => (
                    <div className="lb-dynamic-row" key={rowIdx}>
                      <div className="lb-field"><label>{lf('name')}</label><input type="text" placeholder={lf('colorNamePlaceholder')} value={row.name || ''} onChange={e => updateListRow(roomIdx, 'tfl', rowIdx, { name: e.target.value })} /></div>
                      <div className="lb-field lb-small"><label>{lf('sheetSize')}</label><input type="text" placeholder={lf('sizePlaceholder')} value={row.size || ''} onChange={e => updateListRow(roomIdx, 'tfl', rowIdx, { size: e.target.value })} /></div>
                      <div className="lb-field"><label>{lf('where')}</label><input type="text" placeholder={lf('wherePlaceholder')} value={row.where || ''} onChange={e => updateListRow(roomIdx, 'tfl', rowIdx, { where: e.target.value })} /></div>
                      <button className="lb-row-del" onClick={() => removeListRow(roomIdx, 'tfl', rowIdx)}>&times;</button>
                    </div>
                  ))}
                </div>
                <button className="lb-btn-add-row" onClick={() => addListRow(roomIdx, 'tfl', { name: '', size: '', where: '' })}>{lf('addTflColor')}</button>
              </div>

              <div className="lb-grid-row">
                <div className="lb-field lb-small">
                  <label>{lf('backing')}</label>
                  <select value={room.rBack} onChange={e => updateRoom(roomIdx, { rBack: e.target.value })}>
                    <option value="Yes">{lf('yes')}</option><option value="No">{lf('no')}</option><option value="Partial">{lf('partial')}</option>
                  </select>
                </div>
                <div className="lb-field lb-large"><label>{lf('backingNotes')}</label><input type="text" placeholder={lf('observationsPlaceholder')} value={room.rBackNote} onChange={e => updateRoom(roomIdx, { rBackNote: e.target.value })} /></div>
              </div>

              <div className="lb-grid-row">
                <div className="lb-field lb-small">
                  <label>{lf('eb')}</label>
                  <select value={room.rEb} onChange={e => updateRoom(roomIdx, { rEb: e.target.value })}>
                    <option value="Yes">{lf('yes')}</option><option value="No">{lf('no')}</option><option value="Matching">{lf('matching')}</option>
                  </select>
                </div>
                <div className="lb-field lb-large"><label>{lf('ebNotes')}</label><input type="text" placeholder={lf('observationsPlaceholder')} value={room.rEbNote} onChange={e => updateRoom(roomIdx, { rEbNote: e.target.value })} /></div>
              </div>

              <div className="lb-grid-row">
                <div className="lb-field lb-small">
                  <label>{lf('molding')}</label>
                  <div className="lb-checkbox-group">
                    <label><input type="checkbox" checked={room.rMoldTop} onChange={e => updateRoom(roomIdx, { rMoldTop: e.target.checked })} /> {lf('top')}</label>
                    <label><input type="checkbox" checked={room.rMoldBot} onChange={e => updateRoom(roomIdx, { rMoldBot: e.target.checked })} /> {lf('bottom')}</label>
                  </div>
                </div>
                <div className="lb-field lb-large"><label>{lf('moldingNotes')}</label><input type="text" placeholder={lf('observationsPlaceholder')} value={room.rMoldNote} onChange={e => updateRoom(roomIdx, { rMoldNote: e.target.value })} /></div>
              </div>

              <div className="lb-grid-row">
                <div className="lb-field lb-small">
                  <label>{lf('thermofoil')}</label>
                  <select value={room.rThermo} onChange={e => updateRoom(roomIdx, { rThermo: e.target.value })}>
                    <option value="No">{lf('no')}</option><option value="Yes">{lf('yes')}</option>
                  </select>
                </div>
                <div className="lb-field lb-large"><label>{lf('thermofoilNotes')}</label><input type="text" placeholder={lf('observationsPlaceholder')} value={room.rThermoNote} onChange={e => updateRoom(roomIdx, { rThermoNote: e.target.value })} /></div>
              </div>

              <div className="lb-grid-row">
                <div className="lb-field lb-small">
                  <label>{lf('specialBoreholes')}</label>
                  <select value={room.rBore} onChange={e => updateRoom(roomIdx, { rBore: e.target.value })}>
                    <option value="No">{lf('no')}</option><option value="Yes">{lf('yes')}</option>
                  </select>
                </div>
                <div className="lb-field lb-large"><label>{lf('boreholesNotes')}</label><input type="text" placeholder={lf('observationsPlaceholder')} value={room.rBoreNote} onChange={e => updateRoom(roomIdx, { rBoreNote: e.target.value })} /></div>
              </div>

              <div className="lb-grid-row">
                <div className="lb-field lb-small">
                  <label>{lf('verticalLights')}</label>
                  <select value={room.rVl} onChange={e => updateRoom(roomIdx, { rVl: e.target.value })}>
                    <option value="No">{lf('no')}</option><option value="Yes">{lf('yes')}</option>
                  </select>
                </div>
                <div className="lb-field lb-xs"><label>{lf('qty')}</label><input type="number" min="0" placeholder="0" value={room.rVlQ} onChange={e => updateRoom(roomIdx, { rVlQ: e.target.value })} /></div>
                <div className="lb-field lb-small" style={{ marginLeft: '20px' }}>
                  <label>{lf('horizontalLights')}</label>
                  <select value={room.rHl} onChange={e => updateRoom(roomIdx, { rHl: e.target.value })}>
                    <option value="No">{lf('no')}</option><option value="Yes">{lf('yes')}</option>
                  </select>
                </div>
                <div className="lb-field lb-xs"><label>{lf('qty')}</label><input type="number" min="0" placeholder="0" value={room.rHlQ} onChange={e => updateRoom(roomIdx, { rHlQ: e.target.value })} /></div>
              </div>

              <div className="lb-subsection">
                <div className="lb-subsection-title">{lf('doors')}</div>
                <div className="lb-list-container">
                  {room.doors.map((row, rowIdx) => (
                    <div className="lb-dynamic-row" key={rowIdx}>
                      <div className="lb-field lb-xs"><label>{lf('qty')}</label><input type="number" min="1" style={{ fontWeight: 'bold' }} value={row.qty || ''} onChange={e => updateListRow(roomIdx, 'doors', rowIdx, { qty: e.target.value })} /></div>
                      <div className="lb-field lb-large"><label>{lf('description')}</label><input type="text" placeholder={lf('describePlaceholder')} value={row.desc || ''} onChange={e => updateListRow(roomIdx, 'doors', rowIdx, { desc: e.target.value })} /></div>
                      <button className="lb-row-del" onClick={() => removeListRow(roomIdx, 'doors', rowIdx)}>&times;</button>
                    </div>
                  ))}
                </div>
                <button className="lb-btn-add-row" onClick={() => addListRow(roomIdx, 'doors', { qty: '', desc: '' })}>{lf('addDoor')}</button>
              </div>

              <div className="lb-subsection">
                <div className="lb-subsection-title">{lf('drawers')}</div>
                <div className="lb-list-container">
                  {room.drawers.map((row, rowIdx) => (
                    <div className="lb-dynamic-row" key={rowIdx}>
                      <div className="lb-field lb-xs"><label>{lf('qty')}</label><input type="number" min="1" style={{ fontWeight: 'bold' }} value={row.qty || ''} onChange={e => updateListRow(roomIdx, 'drawers', rowIdx, { qty: e.target.value })} /></div>
                      <div className="lb-field lb-large"><label>{lf('description')}</label><input type="text" placeholder={lf('describePlaceholder')} value={row.desc || ''} onChange={e => updateListRow(roomIdx, 'drawers', rowIdx, { desc: e.target.value })} /></div>
                      <button className="lb-row-del" onClick={() => removeListRow(roomIdx, 'drawers', rowIdx)}>&times;</button>
                    </div>
                  ))}
                </div>
                <button className="lb-btn-add-row" onClick={() => addListRow(roomIdx, 'drawers', { qty: '', desc: '' })}>{lf('addDrawer')}</button>
              </div>

              <div className="lb-subsection">
                <div className="lb-subsection-title">{lf('additionalNotes')}</div>
                <div className="lb-list-container">
                  {room.notes.map((row, rowIdx) => (
                    <div className="lb-dynamic-row" key={rowIdx}>
                      <div className="lb-field lb-large"><input type="text" placeholder={lf('notePlaceholder')} value={row.text || ''} onChange={e => updateListRow(roomIdx, 'notes', rowIdx, { text: e.target.value })} /></div>
                      <button className="lb-row-del" onClick={() => removeListRow(roomIdx, 'notes', rowIdx)}>&times;</button>
                    </div>
                  ))}
                </div>
                <button className="lb-btn-add-row" onClick={() => addListRow(roomIdx, 'notes', { text: '' })}>{lf('addNote')}</button>
              </div>
            </div>
          ))}
        </div>

        <button className="lb-btn-add-room" onClick={addRoom}>
          <span style={{ fontSize: '18px', fontWeight: 'normal' }}>+</span> {lf('addNewRoom')}
        </button>
      </main>
      </div>
    </div>
  );
}
