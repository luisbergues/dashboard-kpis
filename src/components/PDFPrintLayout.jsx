import React from 'react';
import './PDFPrintLayout.css';

export default function PDFPrintLayout({ headerData, drawerOptions, drawers, rods, miscCol1, miscCol2 }) {
  // Helper to render circled text if selected
  const OptionItem = ({ label, selected }) => (
    <span className={`option-item ${selected ? 'selected' : ''}`}>{label}</span>
  );

  return (
    <div className="pdf-print-container">
      {/* Header Table */}
      <table className="pdf-header-table">
        <tbody>
          <tr>
            <td className="pdf-logo-cell">
              <img src="/logo.png" alt="JL Closets Logo" style={{ maxWidth: '100%', maxHeight: '120px' }} />
            </td>
            <td className="pdf-job-info-cell">
              <div className="info-row">
                <span className="info-label">JOB NAME:</span> <span className="info-value">{headerData.jobName}</span>
              </div>
              <div className="info-row">
                <span className="info-label">COLOR:</span> <span className="info-value">{headerData.color}</span>
              </div>
              <div className="info-row">
                <span className="info-label">ROOM(S):</span> <span className="info-value">{headerData.rooms}</span>
              </div>
            </td>
            <td className="pdf-staff-info-cell">
              <div className="info-row">
                <span className="info-label">DESIGNER:</span> <span className="info-value">{headerData.designer}</span>
              </div>
              <div className="info-row">
                <span className="info-label">ENGINEER:</span> <span className="info-value">{headerData.engineer}</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Drawers Section */}
      <div className="pdf-section">
        <h2 className="section-title centered underline">DRAWERS</h2>
        
        {/* Options Table */}
        <table className="options-table">
          <tbody>
            <tr>
              <td className="option-cell">
                <div className="option-title">FRONTS</div>
                <div style={{ marginTop: '8px' }}>
                  <OptionItem label="SLAB" selected={drawerOptions.fronts === 'SLAB'} />
                </div>
                <div style={{ marginTop: '8px' }}>
                  <OptionItem label="THERMOFOIL" selected={drawerOptions.fronts === 'THERMOFOIL'} />
                </div>
              </td>
              <td className="option-cell">
                <div className="option-title">BOX</div>
                <div style={{ marginTop: '8px' }}>
                  <OptionItem label="PRFV" selected={drawerOptions.box === 'PRFV'} />
                </div>
                <div style={{ marginTop: '8px' }}>
                  <OptionItem label="DOVETAIL" selected={drawerOptions.box === 'DOVETAIL'} />
                </div>
              </td>
              <td className="option-cell">
                <div className="option-title">SLIDES</div>
                <div style={{ marginTop: '8px' }}>
                  <OptionItem label="SOFT CLOSE" selected={drawerOptions.slides === 'SOFT CLOSE'} />
                </div>
                <div style={{ marginTop: '8px' }}>
                  <OptionItem label="FULL EXTENSION" selected={drawerOptions.slides === 'FULL EXTENSION'} />
                </div>
              </td>
              <td className="option-cell handles-cell">
                <div className="option-title">HANDLES</div>
                <table style={{ width: '100%', border: 'none', marginTop: '8px' }}>
                  <tbody>
                    <tr>
                      <td style={{ border: 'none', padding: '2px', textAlign: 'left' }}>
                        <OptionItem label="STD. B. NICKEL" selected={drawerOptions.handles === 'STD. B. NICKEL'} />
                      </td>
                      <td style={{ border: 'none', padding: '2px', textAlign: 'left' }}>
                        <OptionItem label="NONE" selected={drawerOptions.handles === 'NONE'} />
                      </td>
                    </tr>
                    <tr>
                      <td style={{ border: 'none', padding: '2px', textAlign: 'left' }}>
                        <OptionItem label="STD. CHROME" selected={drawerOptions.handles === 'STD. CHROME'} />
                      </td>
                      <td style={{ border: 'none', padding: '2px', textAlign: 'left' }}>
                        <OptionItem label="CUSTOMER OWN" selected={drawerOptions.handles === 'CUSTOMER OWN'} />
                      </td>
                    </tr>
                    <tr>
                      <td style={{ border: 'none', padding: '2px', textAlign: 'left' }}>
                        <OptionItem label="STD. M. BLACK" selected={drawerOptions.handles === 'STD. M. BLACK'} />
                      </td>
                      <td style={{ border: 'none', padding: '2px', textAlign: 'left' }}>
                        <OptionItem label="SPECIAL" selected={drawerOptions.handles === 'SPECIAL'} />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        <table className="print-table">
          <thead>
            <tr>
              <th style={{width: '20%'}}>FRONT (H x W)</th>
              <th style={{width: '6%'}}>QTY.</th>
              <th style={{width: '10%'}}>OPEN.</th>
              <th style={{width: '34%'}}>BOX (W x D x H)</th>
              <th style={{width: '15%'}}>ROOM</th>
              <th style={{width: '15%'}}>SPECIAL HANDLES</th>
            </tr>
          </thead>
          <tbody>
            {drawers.map((d, i) => (
              <tr key={i}>
                <td>{d.front}</td>
                <td className="center">{d.qty}</td>
                <td className="center">{d.open}</td>
                <td>{d.box}</td>
                <td>{d.room}</td>
                <td>{d.handles}</td>
              </tr>
            ))}
            {/* Add a few empty rows to match the PDF style if there are few drawers */}
            {drawers.length < 5 && Array(5 - drawers.length).fill(0).map((_, i) => (
              <tr key={`empty-d-${i}`}>
                <td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bottom Table Layout */}
      <table className="pdf-bottom-table">
        <tbody>
          <tr>
            <td className="rods-cell">
              <table className="rods-table">
                <thead>
                  <tr>
                    <th>RODS</th>
                    <th style={{width: '15%'}}>QTY.</th>
                    <th style={{width: '20%'}}>SIZE</th>
                  </tr>
                </thead>
                <tbody>
                  {rods.map((r, i) => (
                    <tr key={i}>
                      <td className="room-cell">
                        <div style={{fontWeight: 'bold', fontSize: '11px'}}>{r.room}</div>
                        <div style={{fontSize: '11px'}}>{r.type}</div>
                      </td>
                      <td className="center">{r.qty}</td>
                      <td className="center">{r.size}</td>
                    </tr>
                  ))}
                  {rods.length < 10 && Array(10 - rods.length).fill(0).map((_, i) => (
                    <tr key={`empty-r-${i}`}>
                      <td>&nbsp;</td><td></td><td></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </td>
            <td className="misc-cell">
              <h2 className="section-title" style={{ paddingLeft: '10px', borderBottom: '2px solid black' }}>MISCELLANEOUS ITEMS / NOTES</h2>
              <div className="misc-content">
                <div className="misc-col">
                  <pre className="misc-col-pre">{miscCol1}</pre>
                </div>
                <div className="misc-col">
                  <pre className="misc-col-pre">{miscCol2}</pre>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
