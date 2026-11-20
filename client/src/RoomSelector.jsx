import React, { useEffect, useState } from 'react';
import { valor, label, ordenar, duracion } from './config';
import SelectorFecha from './SelectorFecha';

function TarjetaQuirofano({ q, ui, rows, now, onElegir }) {
    const activa    = rows.find(r => r.estado === 'en_curso');
    const pendientes = ordenar(rows.filter(r => r.estado === 'pendiente'));
    const hechas    = rows.filter(r => r.estado === 'finalizada').length;

    return (
        <button className="overview-card" onClick={() => onElegir(q)} style={{ borderColor: q.color }}>
            <div className="overview-card-header" style={{ backgroundColor: q.color }}>
                <span>{q.nombre.toUpperCase()}</span>
                <span className="overview-badge">{activa ? '● EN CIRUGÍA' : 'LIBRE'}</span>
            </div>

            <div className="overview-card-body">
                {activa ? (
                    <>
                        <div className="overview-patient">{activa.nombre}</div>
                        <div className="overview-data">
                            {ui.resumen.map((col, i) => (
                                <span key={col}>{label(col)} <strong style={{ color: i === 0 ? '#fbbf24' : undefined }}>{valor(activa, col) || '-'}</strong></span>
                            ))}
                        </div>
                        <div className="overview-timer">{duracion(activa.inicio, now)}</div>
                    </>
                ) : (
                    <div className="overview-empty">Sin paciente en curso</div>
                )}
            </div>

            <div className="overview-card-footer">
                <div className="overview-next">
                    <span className="overview-next-label">PRÓXIMOS</span>
                    {pendientes.length === 0 ? (
                        <span className="overview-next-item" style={{ color: '#64748b' }}>—</span>
                    ) : pendientes.slice(0, 3).map(p => (
                        <span key={p.id} className="overview-next-item">
                            {p.hora && <strong>{p.hora.slice(0, 5)} </strong>}
                            {p.nombre}
                            {valor(p, ui.resumen[0]) && <em> · {valor(p, ui.resumen[0])}</em>}
                        </span>
                    ))}
                </div>
                <div className="overview-counts">
                    <span>⏳ {pendientes.length} pendientes</span>
                    <span>✅ {hechas} finalizados</span>
                    <span className="overview-enter" style={{ color: q.color }}>ENTRAR ›</span>
                </div>
            </div>
        </button>
    );
}

function VistaGeneral({ institucion, ui, quirofanos, rows, fecha, setFecha, cargando, error, conectado, onElegir, menu }) {
    const [now, setNow] = useState(() => Date.now());

    // Un solo reloj para los cronómetros de todas las salas
    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    const sinAsignar = rows.filter(r => !r.quirofano || r.quirofano > institucion.quirofanos);
    const columnas   = quirofanos.length <= 4 ? 2 : 3;

    return (
        <div className="overview-screen">
            <style>{OVERVIEW_CSS}</style>
            <header className="overview-header">
                <span>🏥 {institucion.nombre.toUpperCase()} — VISTA GENERAL</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className="overview-conn" style={{ color: conectado ? '#22c55e' : '#ef4444' }}>
                        {conectado ? '● En vivo' : '● Sin conexión'}
                    </span>
                    {menu}
                </div>
            </header>
            <SelectorFecha fecha={fecha} setFecha={setFecha} oscuro />

            {error && <div className="overview-alert">No se pudieron cargar las cirugías: {error}</div>}
            {!cargando && !error && rows.length === 0 && (
                <div className="overview-alert" style={{ background: '#1e293b', color: '#94a3b8' }}>
                    No hay cirugías cargadas para este día.
                </div>
            )}
            {sinAsignar.length > 0 && (
                <div className="overview-alert" style={{ background: '#78350f', color: '#fde68a' }}>
                    ⚠️ {sinAsignar.length} cirugía(s) sin quirófano asignado: {sinAsignar.map(r => r.nombre).join(', ')}
                </div>
            )}

            <div className="overview-grid" style={{
                gridTemplateColumns: `repeat(${columnas}, 1fr)`,
                gridTemplateRows: `repeat(${Math.ceil(quirofanos.length / columnas)}, 1fr)`
            }}>
                {quirofanos.map(q => (
                    <TarjetaQuirofano key={q.numero} q={q} ui={ui} now={now} onElegir={onElegir}
                                      rows={rows.filter(r => r.quirofano === q.numero)} />
                ))}
            </div>
        </div>
    );
}

const OVERVIEW_CSS = `
.overview-screen {
    height: 100vh; height: 100dvh;
    display: flex; flex-direction: column;
    background: #0f172a; color: #f1f5f9;
    padding: 12px; gap: 10px; box-sizing: border-box;
}
.overview-header {
    display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;
    font-weight: 800; letter-spacing: 0.05em; font-size: 1rem; padding: 0 4px;
}
.overview-conn { font-size: 0.8rem; font-weight: 600; }
.overview-alert { background: #7f1d1d; color: #fecaca; padding: 8px 12px; border-radius: 8px; font-size: 0.9rem; }
.overview-grid { flex: 1; min-height: 0; display: grid; gap: 12px; }
.overview-card {
    display: flex; flex-direction: column; min-height: 0; overflow: hidden;
    background: #1e293b; color: inherit; font: inherit; text-align: left;
    border: 2px solid; border-radius: 14px; padding: 0; cursor: pointer;
    transition: transform 0.12s, box-shadow 0.12s;
}
.overview-card:hover { transform: scale(1.01); box-shadow: 0 0 0 3px rgba(255,255,255,0.15); }
.overview-card-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 8px 14px; font-weight: 800; color: white; font-size: 1rem;
}
.overview-badge { font-size: 0.8rem; background: rgba(0,0,0,0.25); padding: 2px 10px; border-radius: 999px; }
.overview-card-body {
    flex: 1; min-height: 0; display: flex; flex-direction: column;
    justify-content: center; align-items: center; gap: 6px; padding: 10px 14px; text-align: center;
}
.overview-patient { font-size: clamp(1.2rem, 3vw, 2.4rem); font-weight: 800; line-height: 1.1; }
.overview-data { display: flex; gap: 24px; flex-wrap: wrap; justify-content: center; font-size: clamp(0.9rem, 1.6vw, 1.3rem); color: #cbd5e1; }
.overview-timer { font-size: clamp(1.4rem, 3.5vw, 2.8rem); font-weight: 800; font-variant-numeric: tabular-nums; color: #f1f5f9; }
.overview-empty { color: #64748b; font-size: clamp(1rem, 2vw, 1.4rem); }
.overview-card-footer { border-top: 1px solid #334155; padding: 8px 14px; font-size: 0.85rem; }
.overview-next { display: flex; flex-direction: column; gap: 2px; margin-bottom: 6px; }
.overview-next-label { font-size: 0.7rem; font-weight: 700; color: #94a3b8; letter-spacing: 0.08em; }
.overview-next-item { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #e2e8f0; }
.overview-next-item em { color: #94a3b8; font-style: normal; }
.overview-counts { display: flex; gap: 14px; align-items: center; color: #cbd5e1; flex-wrap: wrap; }
.overview-enter { margin-left: auto; font-weight: 800; }

@media (max-width: 700px) {
    .overview-screen { height: auto; min-height: 100vh; }
    .overview-grid { grid-template-columns: 1fr !important; grid-template-rows: none !important; }
    .overview-card { min-height: 260px; }
}
`;

export default VistaGeneral;
