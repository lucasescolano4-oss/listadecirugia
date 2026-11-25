import React, { useEffect, useRef, useState } from 'react';
import { fechaLarga, hoyISO, sumarDias } from './config';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio',
               'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS  = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

function fechaCorta(fechaIso) {
    const [y, m, d] = fechaIso.split('-').map(Number);
    const dia = new Date(y, m - 1, d).toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '');
    return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

// Calendario chico de un mes; semana de lunes a domingo
function Calendario({ fecha, onElegir }) {
    const [y0, m0] = fecha.split('-').map(Number);
    const [mes, setMes] = useState({ y: y0, m: m0 - 1 });
    const hoy = hoyISO();

    const primerDia   = (new Date(mes.y, mes.m, 1).getDay() + 6) % 7;   // 0 = lunes
    const diasDelMes  = new Date(mes.y, mes.m + 1, 0).getDate();
    const celdas = [...Array(primerDia).fill(null), ...Array.from({ length: diasDelMes }, (_, i) => i + 1)];

    const mover = (n) => setMes(({ y, m }) => {
        const f = new Date(y, m + n, 1);
        return { y: f.getFullYear(), m: f.getMonth() };
    });

    const flecha = { background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', padding: '2px 10px', color: '#0f172a' };

    return (
        <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 10010,
            background: 'white', color: '#0f172a', borderRadius: '14px', padding: '12px',
            boxShadow: '0 12px 30px rgba(15, 23, 42, 0.25)', border: '1px solid #e2e8f0', width: '280px'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <button type="button" style={flecha} onClick={() => mover(-1)} title="Mes anterior">‹</button>
                <strong>{MESES[mes.m]} {mes.y}</strong>
                <button type="button" style={flecha} onClick={() => mover(1)} title="Mes siguiente">›</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', textAlign: 'center' }}>
                {DIAS.map((d, i) => (
                    <span key={i} style={{ fontSize: '0.75rem', fontWeight: 700, color: i >= 5 ? '#94a3b8' : '#64748b', padding: '4px 0' }}>{d}</span>
                ))}
                {celdas.map((dia, i) => {
                    if (!dia) return <span key={`v${i}`} />;
                    const valor  = iso(mes.y, mes.m, dia);
                    const elegido = valor === fecha;
                    const esHoy   = valor === hoy;
                    const finde   = i % 7 >= 5;
                    return (
                        <button key={valor} type="button" onClick={() => onElegir(valor)}
                                style={{
                                    height: '34px', borderRadius: '999px', cursor: 'pointer', fontSize: '0.9rem',
                                    fontWeight: elegido || esHoy ? 800 : 500,
                                    border: esHoy && !elegido ? '2px solid #0ea5e9' : '2px solid transparent',
                                    background: elegido ? '#0ea5e9' : 'transparent',
                                    color: elegido ? 'white' : (finde ? '#94a3b8' : '#0f172a')
                                }}
                                onMouseEnter={e => { if (!elegido) e.currentTarget.style.background = '#e0f2fe'; }}
                                onMouseLeave={e => { if (!elegido) e.currentTarget.style.background = 'transparent'; }}>
                            {dia}
                        </button>
                    );
                })}
            </div>
            <button type="button" onClick={() => onElegir(hoy)}
                    style={{ marginTop: '8px', width: '100%', padding: '6px', borderRadius: '8px', cursor: 'pointer',
                             border: '1px solid #0ea5e9', background: 'white', color: '#0ea5e9', fontWeight: 700 }}>
                Ir a hoy
            </button>
        </div>
    );
}

function SelectorFecha({ fecha, setFecha, oscuro }) {
    const [abierto, setAbierto] = useState(false);
    const caja = useRef(null);

    // Cerrar al tocar afuera o con Esc
    useEffect(() => {
        if (!abierto) return;
        const afuera = (e) => { if (caja.current && !caja.current.contains(e.target)) setAbierto(false); };
        const esc    = (e) => { if (e.key === 'Escape') setAbierto(false); };
        document.addEventListener('mousedown', afuera);
        document.addEventListener('touchstart', afuera);
        document.addEventListener('keydown', esc);
        return () => {
            document.removeEventListener('mousedown', afuera);
            document.removeEventListener('touchstart', afuera);
            document.removeEventListener('keydown', esc);
        };
    }, [abierto]);

    const color = oscuro ? '#e2e8f0' : '#0f172a';
    const borde = oscuro ? '#475569' : '#cbd5e1';
    const btn = { background: 'none', border: `1px solid ${borde}`, color, borderRadius: '8px', padding: '4px 10px', cursor: 'pointer', fontWeight: 700 };
    const esHoy = fecha === hoyISO();

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <button style={btn} onClick={() => setFecha(sumarDias(fecha, -1))} title="Día anterior">‹</button>
            <div ref={caja} style={{ position: 'relative' }}>
                <button style={{ ...btn, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px',
                                 borderColor: abierto ? '#0ea5e9' : borde }}
                        onClick={() => setAbierto(a => !a)} title="Elegir fecha en el calendario">
                    📅 {fechaCorta(fecha)} <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>▼</span>
                </button>
                {abierto && (
                    <Calendario key={fecha} fecha={fecha} onElegir={(f) => { setFecha(f); setAbierto(false); }} />
                )}
            </div>
            <button style={btn} onClick={() => setFecha(sumarDias(fecha, 1))} title="Día siguiente">›</button>
            {!esHoy && <button style={{ ...btn, borderColor: '#0ea5e9', color: '#0ea5e9' }} onClick={() => setFecha(hoyISO())}>HOY</button>}
            <span style={{ color: oscuro ? '#94a3b8' : '#475569', fontSize: '0.85rem', textTransform: 'capitalize' }}>
                {fechaLarga(fecha)}
            </span>
        </div>
    );
}

export default SelectorFecha;
