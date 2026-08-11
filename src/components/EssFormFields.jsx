import { X, Plus, Trash2 } from 'lucide-react';

export default function EssFormFields({
  t,
  pages,
  currentPageIndex,
  setCurrentPageIndex,
  addPage,
  removePage,
  headerData,
  handleHeaderChange,
  drawerOptions,
  handleOptionsChange,
  drawers,
  updateDrawer,
  removeDrawer,
  addDrawer,
  rods,
  updateRod,
  removeRod,
  addRod,
  miscCol1,
  setMiscCol1,
  miscCol2,
  setMiscCol2,
}) {
  return (
    <>
      <div className="pdf-tabs-container">
        <div className="pdf-tabs">
          {pages.map((p, index) => (
            <div
              key={index}
              className={`pdf-tab ${index === currentPageIndex ? 'active' : ''}`}
              onClick={() => setCurrentPageIndex(index)}
            >
              {t('myProjects.sheet')} {index + 1}
              {pages.length > 1 && (
                <span
                  className="tab-close"
                  onClick={(e) => { e.stopPropagation(); removePage(index); }}
                  title={t('myProjects.deleteSheet')}
                >
                  <X size={12} />
                </span>
              )}
            </div>
          ))}
          <button className="btn-add-tab" onClick={addPage} title={t('myProjects.addNewSheet')} aria-label={t('myProjects.addNewSheet')}>
            <Plus size={16} />
          </button>
        </div>
      </div>

      <div className="pdf-modal-body">
        <div className="form-section">
          <h3>{t('myProjects.headerSheet')} {currentPageIndex + 1}</h3>
          <div className="form-grid">
            <label>JOB NAME: <input type="text" name="jobName" value={headerData.jobName} onChange={handleHeaderChange} /></label>
            <label>COLOR: <input type="text" name="color" value={headerData.color} onChange={handleHeaderChange} /></label>
            <label>ROOM(S): <input type="text" name="rooms" value={headerData.rooms} onChange={handleHeaderChange} /></label>
            <label>DESIGNER: <input type="text" name="designer" value={headerData.designer} onChange={handleHeaderChange} /></label>
            <label>ENGINEER: <input type="text" name="engineer" value={headerData.engineer} onChange={handleHeaderChange} /></label>
          </div>
        </div>

        <div className="form-section">
          <h3>{t('myProjects.drawerOptions')}</h3>
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
                    <td><input name={`drawerFront-${i}`} value={d.front} onChange={e => updateDrawer(i, 'front', e.target.value)} /></td>
                    <td><input name={`drawerQty-${i}`} type="number" style={{width: '60px'}} value={d.qty} onChange={e => updateDrawer(i, 'qty', e.target.value)} /></td>
                    <td><input name={`drawerOpen-${i}`} value={d.open} onChange={e => updateDrawer(i, 'open', e.target.value)} /></td>
                    <td><input name={`drawerBox-${i}`} value={d.box} onChange={e => updateDrawer(i, 'box', e.target.value)} /></td>
                    <td><input name={`drawerRoom-${i}`} value={d.room} onChange={e => updateDrawer(i, 'room', e.target.value)} /></td>
                    <td><input name={`drawerHandles-${i}`} value={d.handles} onChange={e => updateDrawer(i, 'handles', e.target.value)} /></td>
                    <td><button className="btn-icon danger" onClick={() => removeDrawer(i)}><Trash2 size={16} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn-secondary btn-sm" onClick={addDrawer} style={{marginTop: '10px'}}><Plus size={14} /> {t('myProjects.addDrawerRow')}</button>
          </div>
        </div>

        <div className="form-section">
          <h3>{t('myProjects.rodsTitle')}</h3>
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
                    <td><input name={`rodRoom-${i}`} value={r.room} onChange={e => updateRod(i, 'room', e.target.value)} /></td>
                    <td><input name={`rodType-${i}`} value={r.type} onChange={e => updateRod(i, 'type', e.target.value)} /></td>
                    <td><input name={`rodQty-${i}`} type="number" style={{width: '60px'}} value={r.qty} onChange={e => updateRod(i, 'qty', e.target.value)} /></td>
                    <td><input name={`rodSize-${i}`} value={r.size} onChange={e => updateRod(i, 'size', e.target.value)} /></td>
                    <td><button className="btn-icon danger" onClick={() => removeRod(i)}><Trash2 size={16} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn-secondary btn-sm" onClick={addRod} style={{marginTop: '10px'}}><Plus size={14} /> {t('myProjects.addRod')}</button>
          </div>
        </div>

        <div className="form-section">
          <h3>{t('myProjects.miscNotesTitle')}</h3>
          <div className="misc-columns">
            <div style={{flex: 1}}>
              <label>{t('myProjects.leftColumn')}</label>
              <textarea name="miscCol1" value={miscCol1} onChange={e => setMiscCol1(e.target.value)} rows={6} style={{width:'100%', padding:'8px'}}></textarea>
            </div>
            <div style={{flex: 1}}>
              <label>{t('myProjects.rightColumn')}</label>
              <textarea name="miscCol2" value={miscCol2} onChange={e => setMiscCol2(e.target.value)} rows={6} style={{width:'100%', padding:'8px'}}></textarea>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
