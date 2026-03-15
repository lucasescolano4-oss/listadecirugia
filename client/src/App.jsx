import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, NavLink } from 'react-router-dom';
import io from 'socket.io-client';
import ReceptionView from './ReceptionView';
import SurgeryView from './SurgeryView';
import Clock from './Clock';
import HistoryView from './HistoryView';

// ── Determinar URL del servidor ───────────────────────────────────────────────
// Prioridad:
// 1. Variable de entorno de Vite (configurada en Vercel)
// 2. IP guardada manualmente por el usuario
// 3. Mismo host en puerto 3000 (desarrollo local)
function getServerURL() {
    // 1. Variable de entorno definida al hacer build (Vercel)
    if (import.meta.env.VITE_SERVER_URL) {
        return import.meta.env.VITE_SERVER_URL;
    }

    // 2. IP guardada manualmente por el usuario (modo local/tablet)
    try {
        const stored = localStorage.getItem('SERVER_IP');
        if (stored) {
            return stored.startsWith('http') ? stored : `http://${stored}:3000`;
        }
    } catch (e) { /* localStorage no disponible */ }

    // 3. Fallback: mismo host en puerto 3000
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    return `${protocol}//${hostname}:3000`;
}

// ── Inicializar socket una sola vez ───────────────────────────────────────────
const serverURL = getServerURL();
console.log('[Socket] Conectando a:', serverURL);

const socket = io(serverURL, {
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    timeout: 15000,
    transports: ['websocket', 'polling']
});

// ── Componente de navegación ──────────────────────────────────────────────────
function Navigation() {
    const [connected, setConnected] = useState(socket.connected);

    useEffect(() => {
        const onConnect    = () => setConnected(true);
        const onDisconnect = () => setConnected(false);

        socket.on('connect',    onConnect);
        socket.on('disconnect', onDisconnect);

        return () => {
            socket.off('connect',    onConnect);
            socket.off('disconnect', onDisconnect);
        };
    }, []);

    const changeIP = () => {
        const current = localStorage.getItem('SERVER_IP') || '';
        const newIP = prompt('Ingrese la IP del servidor (solo para uso local):', current);
        if (newIP !== null && newIP !== current) {
            try {
                if (newIP.trim() === '') {
                    localStorage.removeItem('SERVER_IP');
                } else {
                    localStorage.setItem('SERVER_IP', newIP.trim());
                }
                window.location.reload();
            } catch (e) {
                alert('No se pudo guardar la IP: ' + e.message);
            }
        }
    };

    return (
        <nav className="bottom-nav no-print">
            <div
                className={`connection-status ${connected ? 'online' : 'offline'}`}
                onClick={changeIP}
                title={connected ? 'Conectado — click para cambiar IP' : 'Desconectado — click para cambiar IP'}
                style={{ cursor: 'pointer' }}
            />
            <NavLink to="/" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                <span className="nav-icon">📋</span>
                <span className="nav-label">INGRESO</span>
            </NavLink>
            <NavLink to="/surgery" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                <span className="nav-icon">🏥</span>
                <span className="nav-label">EN CIRUGÍA</span>
            </NavLink>
            <NavLink to="/history" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                <span className="nav-icon">✅</span>
                <span className="nav-label">FINALIZADO</span>
            </NavLink>
        </nav>
    );
}

// ── Componente principal ──────────────────────────────────────────────────────
function App() {
    const [patients,      setPatients]      = useState([]);
    const [activePatient, setActivePatient] = useState(null);
    const [history,       setHistory]       = useState([]);
    const [initError,     setInitError]     = useState(null);

    useEffect(() => {
        document.body.style.backgroundColor = '';

        try {
            const handlePatientsUpdate = (data) => setPatients(data || []);
            const handleActivePatient  = (data) => setActivePatient(data);
            const handleHistoryUpdate  = (data) => setHistory(data || []);
            const handleConnect        = () => socket.emit('request_patients');

            socket.on('patients_update', handlePatientsUpdate);
            socket.on('update_patient',  handleActivePatient);
            socket.on('history_update',  handleHistoryUpdate);
            socket.on('connect',         handleConnect);

            // Pedir datos si ya está conectado
            if (socket.connected) {
                socket.emit('request_patients');
            }

            return () => {
                socket.off('patients_update', handlePatientsUpdate);
                socket.off('update_patient',  handleActivePatient);
                socket.off('history_update',  handleHistoryUpdate);
                socket.off('connect',         handleConnect);
            };
        } catch (err) {
            setInitError(err.message);
        }
    }, []);

    if (initError) {
        return (
            <div style={{ padding: '20px', background: '#000', color: '#f00', height: '100vh' }}>
                <h2>Error de la App</h2>
                <p>{initError}</p>
                <button onClick={() => window.location.reload()}>Recargar</button>
            </div>
        );
    }

    return (
        <HashRouter>
            <div className="app-container">
                <Clock />
                <main className="content">
                    <Routes>
                        <Route path="/"        element={<ReceptionView socket={socket} patients={patients} activePatient={activePatient} history={history} />} />
                        <Route path="/surgery" element={<SurgeryView socket={socket} activePatient={activePatient} />} />
                        <Route path="/history" element={<HistoryView  socket={socket} history={history} />} />
                    </Routes>
                </main>
                <Navigation />
            </div>
        </HashRouter>
    );
}

export default App;
