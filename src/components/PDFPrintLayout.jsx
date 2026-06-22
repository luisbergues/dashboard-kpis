import React from 'react';
import './PDFPrintLayout.css';

export default function PDFPrintLayout({ headerData, drawerOptions, drawers, rods, miscCol1, miscCol2 }) {
  // Helper to render circled text if selected
  const OptionItem = ({ label, selected }) => (
    <span className={`option-item ${selected ? 'selected' : ''}`}>{label}</span>
  );

  return (
    <div className="pdf-print-container">
      {/* Header */}
      <div className="pdf-header">
        <div className="pdf-logo">
          {/* We use text as placeholder for the logo, styled similarly to the gold script */}
          <h1 className="logo-text">JL CLOSETS</h1>
          <p className="logo-subtext">Est. 1991</p>
        </div>
        <div className="pdf-job-info">
          <div className="info-row">
            <span className="info-label">JOB NAME:</span> <span className="info-value">{headerData.jobName}</span>
          </div>
          <div className="info-row">
            <span className="info-label">COLOR:</span> <span className="info-value">{headerData.color}</span>
          </div>
          <div className="info-row">
            <span className="info-label">ROOM(S):</span> <span className="info-value">{headerData.rooms}</span>
          </div>
        </div>
        <div className="pdf-staff-info">
          <div className="info-row">
            <span className="info-label">DESIGNER:</span> <span className="info-value">{headerData.designer}</span>
          </div>
          <div className="info-row">
            <span className="info-label">ENGINEER:</span> <span className="info-value">{headerData.engineer}</span>
          </div>
        </div>
      </div>

      {/* Drawers Section */}
      <div className="pdf-section">
        <h2 className="section-title centered underline">DRAWERS</h2>
        
        <div className="options-grid">
          <div className="option-col">
            <div className="option-title">FRONTS</div>
            <OptionItem label="SLAB" selected={drawerOptions.fronts === 'SLAB'} />
            <OptionItem label="THERMOFOIL" selected={drawerOptions.fronts === 'THERMOFOIL'} />
          </div>
          <div className="option-col">
            <div className="option-title">BOX</div>
            <OptionItem label="PRFV" selected={drawerOptions.box === 'PRFV'} />
            <OptionItem label="DOVETAIL" selected={drawerOptions.box === 'DOVETAIL'} />
          </div>
          <div className="option-col">
            <div className="option-title">SLIDES</div>
            <br/>
            <OptionItem label="SOFT CLOSE" selected={drawerOptions.slides === 'SOFT CLOSE'} />
            <OptionItem label="FULL EXTENSION" selected={drawerOptions.slides === 'FULL EXTENSION'} />
          </div>
          <div className="option-col handles-col">
            <div className="option-title">HANDLES</div>
            <div className="handles-grid">
              <OptionItem label="STD. B. NICKEL" selected={drawerOptions.handles === 'STD. B. NICKEL'} />
              <OptionItem label="NONE" selected={drawerOptions.handles === 'NONE'} />
              <OptionItem label="STD. CHROME" selected={drawerOptions.handles === 'STD. CHROME'} />
              <OptionItem label="CUSTOMER OWN" selected={drawerOptions.handles === 'CUSTOMER OWN'} />
              <OptionItem label="STD. M. BLACK" selected={drawerOptions.handles === 'STD. M. BLACK'} />
              <OptionItem label="SPECIAL" selected={drawerOptions.handles === 'SPECIAL'} />
            </div>
          </div>
        </div>

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

      {/* Rods and Misc Section */}
      <div className="pdf-bottom-grid">
        <div className="rods-section">
          <table className="print-table rods-table">
            <thead>
              <tr>
                <th colSpan="2" className="title-cell"><h2 className="section-title">RODS</h2></th>
                <th>QTY.</th>
                <th>SIZE</th>
              </tr>
            </thead>
            <tbody>
              {rods.map((r, i) => (
                <tr key={i}>
                  <td colSpan="2" className="room-cell">
                    <strong>{r.room}</strong><br/>
                    {r.type}
                  </td>
                  <td className="center">{r.qty}</td>
                  <td className="center">{r.size}</td>
                </tr>
              ))}
              {/* Fill empty rods */}
              {rods.length < 8 && Array(8 - rods.length).fill(0).map((_, i) => (
                <tr key={`empty-r-${i}`}>
                  <td colSpan="2">&nbsp;</td><td></td><td></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="misc-section">
          <h2 className="section-title">MISCELLANEOUS ITEMS / NOTES</h2>
          <div className="misc-content">
            <div className="misc-col">
              <pre>{miscCol1}</pre>
            </div>
            <div className="misc-col">
              <pre>{miscCol2}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
