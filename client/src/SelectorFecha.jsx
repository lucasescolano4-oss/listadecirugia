import React from 'react';
import { fechaLarga, hoyISO, sumarDias } from './config';

function SelectorFecha({ fecha, setFecha, oscuro }) {
    const color = oscuro ? '#e2e8f0' : '#0f172a';
    const borde = oscuro ? '#475569' : '#cbd5e1';
    const btn = { background: 'none', border: `1px solid ${borde}`, color, borderRadius: '8px', padding: '4px 10px', cursor: 'pointer', fontWeight: 700 };
    const esHoy = fecha === hoyISO();
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <button style={btn} onClick={() => setFecha(sumarDias(fecha, -1))} title="Día anterior">‹</button>
            <input type="date" value={fecha} onChange={e => e.target.value && setFecha(e.target.value)}
                   style={{ ...btn, fontWeight: 600, colorScheme: oscuro ? 'dark' : 'light' }} />
            <button style={btn} onClick={() => setFecha(sumarDias(fecha, 1))} title="Día siguiente">›</button>
            {!esHoy && <button style={{ ...btn, borderColor: '#0ea5e9', color: '#0ea5e9' }} onClick={() => setFecha(hoyISO())}>HOY</button>}
            <span style={{ color: oscuro ? '#94a3b8' : '#475569', fontSize: '0.85rem', textTransform: 'capitalize' }}>
                {fechaLarga(fecha)}
            </span>
        </div>
    );
}

export default SelectorFecha;
