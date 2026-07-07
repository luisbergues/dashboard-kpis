import React from 'react';
import './IPPrintLayout.css';

export default function IPPrintLayout({ data }) {
  const {
    clientName = '',
    clientAddress = '',
    clientPhone = '',
    designerPhone = '',
    collectPayment = '',
    observations = ''
  } = data || {};

  return (
    <div className="ip-print-container">
      {/* Title */}
      <div className="ip-title-block">
        <h1 className="ip-main-title">INSTALLER</h1>
        <h1 className="ip-main-title">PACKET</h1>
      </div>

      {/* Main Grid Table */}
      <table className="ip-info-table">
        <tbody>
          <tr>
            <td className="ip-label-cell" style={{ width: '35%' }}>Client’s Name:</td>
            <td className="ip-value-cell">{clientName}</td>
          </tr>
          <tr>
            <td className="ip-label-cell">Client’s Address:</td>
            <td className="ip-value-cell ip-address-cell">{clientAddress}</td>
          </tr>
          <tr>
            <td className="ip-label-cell">Client’s Phone Number:</td>
            <td className="ip-value-cell">{clientPhone}</td>
          </tr>
          <tr>
            <td className="ip-label-cell">Designer’s Phone numb.</td>
            <td className="ip-value-cell">{designerPhone}</td>
          </tr>
          <tr>
            <td className="ip-label-cell">Collect Payment:</td>
            <td className="ip-value-cell">{collectPayment}</td>
          </tr>
          <tr>
            <td className="ip-label-cell" style={{ verticalAlign: 'top' }}>Observations:</td>
            <td className="ip-value-cell ip-observations-cell">
              <pre className="ip-observations-pre">
                {observations.split('\n').map((line, i) => (
                  <React.Fragment key={i}>
                    <span className={/^\s*\d+\s*ROOM/i.test(line) ? 'ip-observations-heading' : undefined}>
                      {line}
                    </span>
                    {i < observations.split('\n').length - 1 && '\n'}
                  </React.Fragment>
                ))}
              </pre>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
