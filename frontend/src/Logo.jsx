import React from 'react';

export default function Logo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="eyeGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#7c3aed" />
        </radialGradient>
        <radialGradient id="pupilGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#c4b5fd" />
          <stop offset="100%" stopColor="#7c3aed" />
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Outer ring */}
      <circle cx="16" cy="16" r="15" stroke="#7c3aed" strokeWidth="1" strokeOpacity="0.4" fill="none" />

      {/* Eye shape */}
      <path
        d="M4 16 C8 8, 24 8, 28 16 C24 24, 8 24, 4 16Z"
        fill="url(#eyeGrad)"
        fillOpacity="0.15"
        stroke="url(#eyeGrad)"
        strokeWidth="1.5"
        filter="url(#glow)"
      />

      {/* Iris */}
      <circle cx="16" cy="16" r="5.5" fill="url(#pupilGrad)" fillOpacity="0.25" stroke="#a78bfa" strokeWidth="1" />

      {/* Pupil */}
      <circle cx="16" cy="16" r="2.5" fill="url(#pupilGrad)" />

      {/* Scan lines */}
      <line x1="16" y1="2" x2="16" y2="6" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.6" />
      <line x1="16" y1="26" x2="16" y2="30" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.6" />
      <line x1="2" y1="16" x2="6" y2="16" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.6" />
      <line x1="26" y1="16" x2="30" y2="16" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.6" />

      {/* Tick marks */}
      <line x1="4.7" y1="4.7" x2="6.8" y2="6.8" stroke="#7c3aed" strokeWidth="1" strokeOpacity="0.35" />
      <line x1="25.2" y1="25.2" x2="27.3" y2="27.3" stroke="#7c3aed" strokeWidth="1" strokeOpacity="0.35" />
      <line x1="27.3" y1="4.7" x2="25.2" y2="6.8" stroke="#7c3aed" strokeWidth="1" strokeOpacity="0.35" />
      <line x1="4.7" y1="27.3" x2="6.8" y2="25.2" stroke="#7c3aed" strokeWidth="1" strokeOpacity="0.35" />
    </svg>
  );
}
