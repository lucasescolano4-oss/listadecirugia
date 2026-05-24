import React, { useState, useEffect, useRef } from 'react';
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

const socket = io(serverURL, {
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    timeout: 15000,
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
                <span className="nav-icon">🔬</span>
                <span className="nav-label" style={{ color: quirofano?.color, fontSize: '0.65rem' }}>
                    {quirofano?.nombre?.replace('Quirófano ', 'Q') || 'Q?'}
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

    const justJoined = useRef(false);

    const patientsKey = (roomId) => `surgery_patients_${roomId}`;

    const handleSelectRoom = (q) => {
        try { sessionStorage.setItem('quirofano_selected', JSON.stringify(q)); } catch (e) { /* */ }
        setQuirofano(q);
        setPatients([]);
        setActivePatient(null);
        setHistory([]);
        justJoined.current = true;
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
        const ping = () => fetch(`${serverURL}/health`).catch(() => {});
        ping();
        const interval = setInterval(ping, 10 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    // Unirse a la sala al reconectar
    useEffect(() => {
        if (!quirofano) return;
        const handleConnect = () => {
            justJoined.current = true;
            socket.emit('join_room', quirofano.id);
        };
        socket.on('connect', handleConnect);
        if (socket.connected) {
            justJoined.current = true;
            socket.emit('join_room', quirofano.id);
        }
        return () => socket.off('connect', handleConnect);
    }, [quirofano]);

    // Escuchar eventos del servidor
    useEffect(() => {
        if (!quirofano) return;
        document.body.style.backgroundColor = '';
        try {
            const handlePatientsUpdate = (data) => {
                const list = data || [];
                // Si el servidor devolvió lista vacía justo después de unirse a la sala,
                // puede ser que Render reinició y perdió data.json → restaurar desde localStorage
                if (justJoined.current && list.length === 0) {
                    justJoined.current = false;
                    try {
                        const backup = localStorage.getItem(patientsKey(quirofano.id));
                        if (backup) {
                            const restored = JSON.parse(backup);
                            if (restored.length > 0) {
                                socket.emit('upload_patients', restored);
                                return; // upload_patients disparará otro patients_update con los datos
                            }
                        }
                    } catch (e) { /* */ }
                }
                justJoined.current = false;
                setPatients(list);
                // Guardar en localStorage como backup ante reinicios del servidor
                if (list.length > 0) {
                    try { localStorage.setItem(patientsKey(quirofano.id), JSON.stringify(list)); } catch (e) { /* */ }
                }
            };
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

    if (!quirofano) return <RoomSelector onSelect={handleSelectRoom} />;

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

