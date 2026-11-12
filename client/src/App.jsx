import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, NavLink } from 'react-router-dom';
import io from 'socket.io-client';
import ReceptionView from './ReceptionView';
import SurgeryView from './SurgeryView';
import Clock from './Clock';
import HistoryView from './HistoryView';
import RoomSelector, { QUIROFANOS } from './RoomSelector';

function getServerURL() {
    if (import.meta.env.VITE_SERVER_URL) return import.meta.env.VITE_SERVER_URL;
    try {
        const stored = localStorage.getItem('SERVER_IP');
        if (stored) return stored.startsWith('http') ? stored : `http://${stored}:3000`;
    } catch (e) { /* */ }
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:3000`;
}

const serverURL = getServerURL();
console.log('[Socket] Conectando a:', serverURL);

// Despierta a Render si estaba dormido (el primer pedido tras dormir tarda ~20-50s)
const pingServer = () => fetch(`${serverURL}/health`).catch(() => {});

const socket = io(serverURL, {
    // Nunca dejar de reintentar: si Render tarda en despertar, antes se rendía tras 10 intentos
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    transports: ['websocket', 'polling']
});

function Navigation({ quirofano, onChangeRoom }) {
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
        const newIP = prompt('IP del servidor (solo uso local):', current);
        if (newIP !== null && newIP !== current) {
            try {
                newIP.trim() === ''
                    ? localStorage.removeItem('SERVER_IP')
                    : localStorage.setItem('SERVER_IP', newIP.trim());
                window.location.reload();
            } catch (e) { alert('No se pudo guardar: ' + e.message); }
        }
    };

    return (
        <nav className="bottom-nav no-print">
            <div
                className={`connection-status ${connected ? 'online' : 'offline'}`}
                onClick={changeIP}
                title={connected ? 'Conectado' : 'Desconectado'}
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
            <button
                onClick={onChangeRoom}
                className="nav-item no-print"
                style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    borderLeft: `3px solid ${quirofano?.color || '#0ea5e9'}`,
                    paddingLeft: '8px'
                }}
            >
                <span className="nav-icon">⊞</span>
                <span className="nav-label" style={{ color: quirofano?.color, fontSize: '0.65rem' }}>
                    GENERAL
                </span>
            </button>
        </nav>
    );
}

function App() {
    const [quirofano, setQuirofano] = useState(() => {
        try {
            const saved = sessionStorage.getItem('quirofano_selected');
            if (saved) return JSON.parse(saved);
        } catch (e) { /* */ }
        return null;
    });

    const [patients,      setPatients]      = useState([]);
    const [activePatient, setActivePatient] = useState(null);
    const [history,       setHistory]       = useState([]);
    const [initError,     setInitError]     = useState(null);
    const [showOffline,   setShowOffline]   = useState(false);

    const handleSelectRoom = (q) => {
        try { sessionStorage.setItem('quirofano_selected', JSON.stringify(q)); } catch (e) { /* */ }
        setQuirofano(q);
        setPatients([]);
        setActivePatient(null);
        setHistory([]);
        socket.emit('join_room', q.id);
    };

    const handleChangeRoom = () => {
        try { sessionStorage.removeItem('quirofano_selected'); } catch (e) { /* */ }
        setQuirofano(null);
        setPatients([]);
        setActivePatient(null);
        setHistory([]);
    };

    // Ping cada 10 minutos para mantener Render despierto
    useEffect(() => {
        const interval = setInterval(pingServer, 10 * 60 * 1000);
        pingServer();
        return () => clearInterval(interval);
    }, []);

    // Aviso de "sin conexión" si se corta más de 3 segundos (evita parpadeos en cortes breves)
    useEffect(() => {
        let timer = null;
        const onDisconnect = () => { timer = setTimeout(() => setShowOffline(true), 3000); };
        const onConnect    = () => { clearTimeout(timer); setShowOffline(false); };
        socket.on('disconnect',    onDisconnect);
        socket.on('connect_error', onDisconnect);
        socket.on('connect',       onConnect);
        if (!socket.connected) onDisconnect();
        return () => {
            clearTimeout(timer);
            socket.off('disconnect',    onDisconnect);
            socket.off('connect_error', onDisconnect);
            socket.off('connect',       onConnect);
        };
    }, []);

    // Al volver a la app (celular desbloqueado, pestaña al frente, vuelve internet):
    // reconectar si hace falta y pedir el estado actual en vez de esperar al próximo cambio
    useEffect(() => {
        const resync = () => {
            if (document.visibilityState === 'hidden') return;
            pingServer();
            if (!socket.connected) {
                socket.connect(); // al conectar, los handlers de 'connect' se re-unen a la sala
                return;
            }
            if (quirofano) socket.emit('join_room', quirofano.id);
            else           socket.emit('watch_all');
        };
        document.addEventListener('visibilitychange', resync);
        window.addEventListener('online', resync);
        window.addEventListener('focus',  resync);
        return () => {
            document.removeEventListener('visibilitychange', resync);
            window.removeEventListener('online', resync);
            window.removeEventListener('focus',  resync);
        };
    }, [quirofano]);

    // Unirse a la sala al reconectar
    useEffect(() => {
        if (!quirofano) return;
        const handleConnect = () => socket.emit('join_room', quirofano.id);
        socket.on('connect', handleConnect);
        if (socket.connected) socket.emit('join_room', quirofano.id);
        return () => socket.off('connect', handleConnect);
    }, [quirofano]);

    // Escuchar eventos del servidor
    useEffect(() => {
        if (!quirofano) return;
        document.body.style.backgroundColor = '';
        try {
            const handlePatientsUpdate = (data) => setPatients(data || []);
            const handleActivePatient  = (data) => setActivePatient(data);
            const handleHistoryUpdate  = (data) => setHistory(data || []);
            socket.on('patients_update', handlePatientsUpdate);
            socket.on('update_patient',  handleActivePatient);
            socket.on('history_update',  handleHistoryUpdate);
            return () => {
                socket.off('patients_update', handlePatientsUpdate);
                socket.off('update_patient',  handleActivePatient);
                socket.off('history_update',  handleHistoryUpdate);
            };
        } catch (err) {
            setInitError(err.message);
        }
    }, [quirofano]);

    const offlineBanner = showOffline && (
        <div className="no-print" style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10000,
            background: '#dc2626', color: 'white', textAlign: 'center',
            padding: '8px 12px', fontWeight: 700, fontSize: '0.9rem'
        }}>
            ⚠️ Sin conexión con el servidor — reconectando… (si estaba dormido puede tardar hasta 1 minuto)
        </div>
    );

    if (!quirofano) {
        return (
            <>
                {offlineBanner}
                <RoomSelector socket={socket} onSelect={handleSelectRoom} />
            </>
        );
    }

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
                {offlineBanner}
                <div className="no-print" style={{
                    position: 'fixed', top: 0, left: 0,
                    background: quirofano.color, color: 'white',
                    padding: '3px 12px', fontSize: '0.75rem', fontWeight: '700',
                    borderBottomRightRadius: '8px', zIndex: 9998, letterSpacing: '0.05em'
                }}>
                    {quirofano.nombre.toUpperCase()}
                </div>
                <Clock />
                <main className="content">
                    <Routes>
                        <Route path="/"        element={<ReceptionView socket={socket} patients={patients} activePatient={activePatient} history={history} quirofano={quirofano} />} />
                        <Route path="/surgery" element={<SurgeryView   socket={socket} activePatient={activePatient} quirofano={quirofano} />} />
                        <Route path="/history" element={<HistoryView   socket={socket} history={history} />} />
                    </Routes>
                </main>
                <Navigation quirofano={quirofano} onChangeRoom={handleChangeRoom} />
            </div>
        </HashRouter>
    );
}

export default App;

