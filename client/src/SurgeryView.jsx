import React, { useEffect, useState } from 'react';

function SurgeryView({ socket, activePatient }) {
    const patient = activePatient;

    useEffect(() => {
        // Activar modo cirugía en el body
        document.body.classList.add('surgery-mode');

        return () => {
            document.body.classList.remove('surgery-mode');
        };
    }, []);

    const [timer, setTimer] = useState(0);
    const [isActive, setIsActive] = useState(false);

    useEffect(() => {
        let interval = null;

        const updateTimer = () => {
            if (patient && patient.startTime) {
                const start = new Date(patient.startTime).getTime();
                const now = new Date().getTime();
                setTimer(Math.max(0, Math.floor((now - start) / 1000)));
            } else {
                setTimer(0);
            }
        };

        if (patient) {
            updateTimer();
            setIsActive(true);
            interval = setInterval(updateTimer, 1000);
        } else {
            setIsActive(false);
            setTimer(0);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [patient]);

    const formatTime = (seconds) => {
        const hh = Math.floor(seconds / 3600);
        const mm = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const ss = (seconds % 60).toString().padStart(2, '0');
        return hh > 0 ? `${hh.toString().padStart(2, '0')}:${mm}:${ss}` : `${mm}:${ss}`;
    };

    const handleFinish = () => {
        if (window.confirm("¿Está seguro de finalizar la cirugía actual?")) {
            socket.emit('clear_patient');
        }
    };

    if (!patient) {
        return (
            <div className="waiting-screen">
                <div className="waiting-content">
                    <span className="waiting-icon">🏥</span>
                    <p>ESPERANDO DATOS...</p>
                    <small>Sistema de Monitoreo de Quirófano</small>
                </div>
            </div>
        );
    }

    // Desestructuración segura
    const nombre = patient['NOMBRE Y APELLIDO'] || '-';
    const ojo = patient['OJO'] || '-';
    const lio = patient['LIO'] || '-';
    const edad = patient['EDAD'] || '-';
    const cata = patient['CATA'] || '-';
    const dil = patient['DIL'] || '-';
    const os = patient['OS'] || '-';
    const app = patient['APP'] || '-';

    return (
        <div className="surgery-grid">
            {/* SECCIÓN SUPERIOR: GRANDE */}
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

            {/* SECCIÓN MEDIA: MEDIANO */}
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

            {/* SECCIÓN INFERIOR: PEQUEÑO */}
            <div className="section-small">
                <div className="data-item">
                    <span className="label">OBRA SOCIAL</span>
                    <span className="val-small">{os}</span>
                </div>
                <div className="data-item">
                    <span className="label">ANTECEDENTES (APP)</span>
                    <span className="val-small">{app}</span>
                </div>
            </div>

            {/* FOOTER: BOTÓNIZQUIERDA, TIMER CENTRO */}
            <div className="surgery-footer">
                <div className="footer-left">
                    <button className="finish-button" onClick={handleFinish}>FINALIZAR</button>
                </div>

                <div className="timer-container">
                    <div className="timer">{formatTime(timer)}</div>
                </div>

                <div className="footer-right-spacer">
                    {/* El reloj global se posicionará aquí vía CSS */}
                </div>
            </div>
        </div>
    );
}

export default SurgeryView;
