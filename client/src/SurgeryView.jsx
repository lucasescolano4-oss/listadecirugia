import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { valor, label, duracion } from './config';

function SurgeryView({ institucion, ui, quirofano, activa, puedeOperar, recargar }) {
    useEffect(() => {
        document.body.classList.add('surgery-mode');
        return () => document.body.classList.remove('surgery-mode');
    }, []);

    // Mantener la pantalla encendida mientras esta vista está abierta (tablet del quirófano).
    // El navegador libera el bloqueo al ocultar la página, así que se vuelve a pedir al volver.
    useEffect(() => {
        if (!('wakeLock' in navigator)) return;
        let lock = null;
        let active = true;
        const requestLock = async () => {
            if (!active || document.visibilityState !== 'visible') return;
            try {
                const newLock = await navigator.wakeLock.request('screen');
                if (active) lock = newLock;
                else newLock.release().catch(() => {}); // se salió de la vista mientras se pedía
            } catch { /* no soportado o rechazado: se usa la configuración de la tablet */ }
        };
        requestLock();
        document.addEventListener('visibilitychange', requestLock);
        return () => {
            active = false;
            document.removeEventListener('visibilitychange', requestLock);
            if (lock) lock.release().catch(() => {});
        };
    }, []);

    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!activa?.inicio) return;
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, [activa?.inicio]);

    const handleFinish = async () => {
        if (!window.confirm('¿Está seguro de finalizar la cirugía actual?')) return;
        const { error } = await supabase.rpc('qx_finalizar', { p_institucion: institucion.id, p_quirofano: quirofano.numero });
        if (error) alert('No se pudo finalizar: ' + error.message + '\nRevisá la conexión y reintentá.');
        recargar();
    };

    if (!activa) {
        return (
            <div className="waiting-screen">
                <div className="waiting-content">
                    <span className="waiting-icon">🏥</span>
                    <p>ESPERANDO DATOS…</p>
                    <small>{institucion.nombre} · {quirofano.nombre}</small>
                </div>
            </div>
        );
    }

    const v = (col) => valor(activa, col) || '-';

    return (
        <div className="surgery-grid">
            {/* SECCIÓN SUPERIOR: nombre y datos principales */}
            <div className="section-large">
                <div className="main-name">{activa.nombre}</div>
                <div className="sub-large-container">
                    {ui.pantalla.grande.map((col, i) => (
                        <div className="data-item" key={col}>
                            <span className="label">{label(col)}</span>
                            <span className={`sub-large${i === 0 ? ' highlight-ojo' : ''}`}>{v(col)}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* SECCIÓN MEDIA */}
            <div className="section-medium">
                {ui.pantalla.media.map(col => (
                    <div className="data-item" key={col}>
                        <span className="label">{label(col)}</span>
                        <span className="val-medium">{v(col)}</span>
                    </div>
                ))}
            </div>

            {/* SECCIÓN INFERIOR */}
            <div className="section-small">
                {ui.pantalla.chica.map(col => (
                    <div className="data-item" key={col}>
                        <span className="label">{label(col)}</span>
                        <span className="val-small">{v(col)}</span>
                    </div>
                ))}
            </div>

            {/* FOOTER: botón finalizar + timer */}
            <div className="surgery-footer">
                <div className="footer-left">
                    {puedeOperar && <button className="finish-button" onClick={handleFinish}>FINALIZAR</button>}
                </div>
                <div className="timer-container">
                    <div className="timer">{duracion(activa.inicio, now)}</div>
                </div>
                <div /> {/* spacer para que el reloj global quede a la derecha */}
            </div>
        </div>
    );
}

export default SurgeryView;
