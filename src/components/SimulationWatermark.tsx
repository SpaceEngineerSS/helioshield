import { useEffect, useState } from 'react';

export function SimulationWatermark() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Slight delay to trigger CSS fade-in
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        padding: '8px 12px',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        color: 'var(--accent)',
        border: '1px solid var(--accent)',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: 'bold',
        letterSpacing: '1px',
        pointerEvents: 'none',
        zIndex: 9999,
        opacity: visible ? 0.8 : 0,
        transition: 'opacity 1s ease-in-out',
        textShadow: '0 0 5px var(--accent)',
      }}
    >
      HISTORICAL DATA - SIMULATION MODE
    </div>
  );
}
