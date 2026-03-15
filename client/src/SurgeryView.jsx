import React, { useEffect, useState } from 'react';

function SurgeryView({ socket, activePatient }) {
    const patient = activePatient;

    useEffect(() => {
        document.body.classList.add('surgery-mode');
        return () => document.body.classList.remove('surgery-mode');
    }, []);

    const [timer, setTimer] = useState(0);

    useEffect(() => {
        let interval = null;

        if (patient && patient.startTime) {
            const updateTimer = () => {
                const start = new Date(patient.startTime).getTime();
                setTimer(Math.max(0, Math.floor((Date.now() - start) / 1000)));
            };
            updateTimer();
            interval = setInterval(updateTimer, 1000);
        } else {
            setTimer(0);
        }

        return () => { if (interval) clearInterval(interval); };
    }, [patient]);

    const formatTime = (seconds) => {
        const hh = Math.floor(seconds / 3600);
        const mm = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const ss = (seconds % 60).toString().padStart(2, '0');
        return hh > 0 ? `${hh.toString().padStart(2, '0')}:${mm}:${ss}` : `${mm}:${ss}`;
    };

    const handleFinish = () => {
        if (window.confirm('¿Está seguro de finalizar la cirugía actual?')) {
            socket.emit('clear_patient');
        }
    };

    if (!patient) {
        return (
            <div className="waiting-screen">
                <div className="waiting-content">
                    <span className="waiting-icon">🏥</span>
                    <p>ESPERANDO DATOS…</p>
                    <small>Sistema de Monitoreo de Quirófano</small>
                </div>
            </div>
        );
    }

    const nombre = patient['NOMBRE Y APELLIDO'] || '-';
    const ojo    = patient['OJO']               || '-';
    const lio    = patient['LIO']               || '-';
    const edad   = patient['EDAD']              || '-';
    const cata   = patient['CATA']              || '-';
    const dil    = patient['DIL']               || '-';
    const os     = patient['OS']                || '-';
    const app    = patient['APP']               || '-';
    const nro    = patient['N°']                || '-';

    return (
        <div className="surgery-grid">
            {/* SECCIÓN SUPERIOR: nombre, ojo, lio */}
            <div className="section-large">
                <div className="main-name">{nombre}</div>
                <div className="sub-large-container">
                    <div className="data-item">
                        <span className="label">OJO</span>
                        <span className="sub-large highlight-ojo">{ojo}</span>
                    </div>
                    <div className="data-item">
                        <span className="label">LIO</span>
                        <span className="sub-large">{lio}</span>
                    </div>
                </div>
            </div>

            {/* SECCIÓN MEDIA: edad, cata, dil */}
            <div className="section-medium">
                <div className="data-item">
                    <span className="label">EDAD</span>
                    <span className="val-medium">{edad}</span>
                </div>
                <div className="data-item">
                    <span className="label">CATA</span>
                    <span className="val-medium">{cata}</span>
                </div>
                <div className="data-item">
                    <span className="label">DIL</span>
                    <span className="val-medium">{dil}</span>
                </div>
            </div>

            {/* SECCIÓN INFERIOR: obra social, antecedentes */}
            <div className="section-small">
                <div className="data-item">
                    <span className="label">OBRA SOCIAL</span>
                    <span className="val-small">
                        {os}
                        <span style={{ marginLeft: '15px', color: '#666' }}>N°: {nro}</span>
                    </span>
                </div>
                <div className="data-item">
                    <span className="label">ANTECEDENTES (APP)</span>
                    <span className="val-small">{app}</span>
                </div>
            </div>

            {/* FOOTER: botón finalizar + timer */}
            <div className="surgery-footer">
                <div className="footer-left">
                    <button className="finish-button" onClick={handleFinish}>FINALIZAR</button>
                </div>
                <div className="timer-container">
                    <div className="timer">{formatTime(timer)}</div>
                </div>
                <div /> {/* spacer para que el reloj global quede a la derecha */}
            </div>
        </div>
    );
}

export default SurgeryView;
