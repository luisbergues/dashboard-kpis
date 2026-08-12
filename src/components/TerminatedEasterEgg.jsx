import React, { useEffect } from 'react';
import './TerminatedEasterEgg.css';

// Fun, no-consequence overlay reused by three unrelated "termination" moments
// (typing K800 in the chatbot, deleting a note, revoking a user) — auto-closes
// so nobody has to remember to dismiss it, click-anywhere also closes it early.
const AUTO_CLOSE_MS = 3000;

export default function TerminatedEasterEgg({ onClose, src = '/k800-terminated.webp', alt = "You've been terminated - K-800" }) {
  useEffect(() => {
    const timer = setTimeout(onClose, AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="terminated-egg-overlay" onClick={onClose}>
      <img
        src={src}
        alt={alt}
        className="terminated-egg-img"
      />
    </div>
  );
}
