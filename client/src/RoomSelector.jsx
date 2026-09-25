import React, { useEffect, useState } from 'react';

const QUIROFANOS = [
    { id: 'q1', nombre: 'Quirófano 1', color: '#0ea5e9' },
    { id: 'q2', nombre: 'Quirófano 2', color: '#8b5cf6' },
    { id: 'q3', nombre: 'Quirófano 3', color: '#10b981' },
    { id: 'q4', nombre: 'Quirófano 4', color: '#f59e0b' },
];

function formatElapsed(startTime, now) {
    if (!startTime) return '';
    const secs = Math.max(0, Math.floor((now - new Date(startTime).getTime()) / 1000));
    const hh = Math.floor(secs / 3600);
    const mm = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
    const ss = (secs % 60).toString().padStart(2, '0');
    return hh > 0 ? `${hh.toString().padStart(2, '0')}:${mm}:${ss}` : `${mm}:${ss}`;
}

function RoomCard({ q, data, now, onSelect }) {
    const active  = data?.currentPatient;
    const next    = data?.next || [];
    const pending = data?.pendingCount || 0;
    const done    = data?.doneCount || 0;

    return (
        <button className="overview-card" onClick={() => onSelect(q)} style={{ borderColor: q.color }}>
            <div className="overview-card-header" style={{ backgroundColor: q.color }}>
                <span>{q.nombre.toUpperCase()}</span>
                <span className="overview-badge">{active ? '● EN CIRUGÍA' : 'LIBRE'}</span>
            </div>

            <div className="overview-card-body">
                {active ? (
                    <>
                        <div className="overview-patient">{active['NOMBRE Y APELLIDO'] || '-'}</div>
                        <div className="overview-data">
                            <span>OJO <strong style={{ color: '#fbbf24' }}>{active['OJO'] || '-'}</strong></span>
                            <span>LIO <strong>{active['LIO'] || '-'}</strong></span>
                        </div>
                        <div className="overview-timer">{formatElapsed(active.startTime, now)}</div>
                    </>
                ) : (
                    <div className="overview-empty">Sin paciente en curso</div>
                )}
            </div>

            <div className="overview-card-footer">
                <div className="overview-next">
                    <span className="overview-next-label">PRÓXIMOS</span>
                    {next.length === 0 ? (
                        <span className="overview-next-item" style={{ color: '#64748b' }}>—</span>
                    ) : next.map((p, i) => (
                        <span key={i} className="overview-next-item">
                            {p['HORA'] && <strong>{p['HORA']} </strong>}
                            {p['NOMBRE Y APELLIDO']}
                            {p['OJO'] && <em> · {p['OJO']}</em>}
                        </span>
                    ))}
                </div>
                <div className="overview-counts">
                    <span>⏳ {pending} pendientes</span>
                    <span>✅ {done} finalizados</span>
                    <span className="overview-enter" style={{ color: q.color }}>ENTRAR ›</span>
                </div>
            </div>
        </button>
    );
}

function RoomSelector({ socket, onSelect }) {
    const [overview,  setOverview]  = useState({});
    const [connected, setConnected] = useState(socket?.connected ?? false);
    const [now,       setNow]       = useState(Date.now());

    // Suscribirse al resumen de todos los quirófanos (y re-suscribirse al reconectar)
    useEffect(() => {
        if (!socket) return;
        const watch        = () => { setConnected(true); socket.emit('watch_all'); };
        const onDisconnect = () => setConnected(false);
        socket.on('rooms_overview', setOverview);
        socket.on('connect',        watch);
        socket.on('disconnect',     onDisconnect);
        if (socket.connected) watch();
        return () => {
            socket.off('rooms_overview', setOverview);
            socket.off('connect',        watch);
            socket.off('disconnect',     onDisconnect);
        };
    }, [socket]);

    // Un solo reloj para los cronómetros de las 4 salas
    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="overview-screen">
            <style>{OVERVIEW_CSS}</style>
            <header className="overview-header">
                <span>🏥 SISTEMA DE CIRUGÍA — VISTA GENERAL</span>
                <span className="overview-conn" style={{ color: connected ? '#22c55e' : '#ef4444' }}>
                    {connected ? '● Conectado' : '● Sin conexión'}
                </span>
            </header>
            <div className="overview-grid">
                {QUIROFANOS.map(q => (
                    <RoomCard key={q.id} q={q} data={overview[q.id]} now={now} onSelect={onSelect} />
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
    padding: 12px; gap: 12px; box-sizing: border-box;
}
.overview-header {
    display: flex; justify-content: space-between; align-items: center;
    font-weight: 800; letter-spacing: 0.05em; font-size: 1rem; padding: 0 4px;
}
.overview-conn { font-size: 0.8rem; font-weight: 600; }
.overview-grid {
    flex: 1; min-height: 0;
    display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 12px;
}
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
.overview-data { display: flex; gap: 24px; font-size: clamp(0.9rem, 1.6vw, 1.3rem); color: #cbd5e1; }
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
    .overview-grid { grid-template-columns: 1fr; grid-template-rows: none; }
    .overview-card { min-height: 260px; }
}
`;

export { QUIROFANOS };
export default RoomSelector;
