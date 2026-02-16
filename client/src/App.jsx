import React, { useState, useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, NavLink } from 'react-router-dom';
import io from 'socket.io-client';
import ReceptionView from './ReceptionView';
import SurgeryView from './SurgeryView';

import Clock from './Clock';

import HistoryView from './HistoryView';

const isNative = window.location.protocol === 'file:' || window.location.protocol.includes('capacitor');
const isMobile = window.Capacitor?.isNative || isNative;
const DEFAULT_PC_IP = '192.168.1.37';

function getStoredIP() {
  try {
    return localStorage.getItem('SERVER_IP');
  } catch (e) {
    return null;
  }
}

function getInitialURL() {
  try {
    // 1. Check for manual override in localStorage first (for both Web and Mobile)
    const stored = getStoredIP();
    if (stored) {
      // If stored doesn't have protocol, assume http (unless on https, then we have a problem, but let's try)
      return stored.startsWith('http') ? stored : `http://${stored}:3000`;
    }

    // 2. If environment variable is set (build time)
    if (import.meta.env.VITE_SERVER_URL) {
      return import.meta.env.VITE_SERVER_URL;
    }

    // 3. If standard web (localhost), try to use the same hostname
    const hostname = window.location.hostname;
    // Allow http for localhost
    if (!isMobile && (hostname === 'localhost' || hostname === '127.0.0.1')) {
      return `http://${hostname}:3000`;
    }

    // 4. HTTPS Safety Check
    if (window.location.protocol === 'https:') {
      console.warn("HTTPS detected but no VITE_SERVER_URL found. WebSocket might fail.");
      // Return null to allow App to ask user, instead of crashing on Mixed Content
      return null;
    }

    // 5. Default fallback for HTTP/Native
    return `http://${DEFAULT_PC_IP}:3000`;
  } catch (e) {
    return `http://${DEFAULT_PC_IP}:3000`;
  }
}

// Global socket reference to avoid re-creations, but initialized lazily or safely
let socket = null;

function initSocket() {
  if (socket) return socket;

  try {
    const url = getInitialURL();
    console.log("Initializing socket to:", url);

    if (!url) {
      console.warn("No socket URL determined. Waiting for user input.");
      // Valid dummy socket that is disconnected
      socket = {
        on: () => { },
        off: () => { },
        emit: () => { },
        connect: () => { },
        connected: false
      };
      return socket;
    }

    socket = io(url, {
      reconnectionAttempts: 5,
      timeout: 10000,
      transports: ['websocket', 'polling']
    });
  } catch (e) {
    console.error("Error inicializando socket:", e);
    // Dummy socket to prevent crashes
    socket = { on: () => { }, off: () => { }, emit: () => { }, connected: false };
  }
  return socket;
}

// Initialize immediately but safely
socket = initSocket();

function Navigation() {
  const [connected, setConnected] = useState(socket.connected);

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  const changeIP = () => {
    const currentIP = getStoredIP() || DEFAULT_PC_IP;
    const newIP = prompt("Ingrese la IP del Servidor (PC):", currentIP);
    if (newIP && newIP !== currentIP) {
      try {
        localStorage.setItem('SERVER_IP', newIP);
        window.location.reload();
      } catch (e) {
        alert("No se pudo guardar la IP: " + e.message);
      }
    }
  };

  return (
    <nav className="bottom-nav no-print">
      <div
        className={`connection-status ${connected ? 'online' : 'offline'}`}
        onClick={changeIP}
        style={{ cursor: 'pointer' }}
      ></div>
      <NavLink to="/" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
        <span className="nav-icon">📋</span>
        <span className="nav-label">INGRESO</span>
      </NavLink>
      <NavLink to="/surgery" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
        <span className="nav-icon">🏥</span>
        <span className="nav-label">EN CIRUGÍA</span>
      </NavLink>
      <NavLink to="/history" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
        <span className="nav-icon">✅</span>
        <span className="nav-label">FINALIZADO</span>
      </NavLink>
    </nav>
  );
}

function App() {
  const [patients, setPatients] = useState([]);
  const [activePatient, setActivePatient] = useState(null);
  const [history, setHistory] = useState([]);
  const [initError, setInitError] = useState(null);

  useEffect(() => {
    // Clear initial loading styles
    document.body.style.backgroundColor = '';

    try {
      const handlePatientsUpdate = (data) => {
        setPatients(data || []);
      };

      const handleActivePatientUpdate = (data) => {
        setActivePatient(data);
      };

      const handleHistoryUpdate = (data) => {
        setHistory(data || []);
      };

      socket.on('patients_update', handlePatientsUpdate);
      socket.on('update_patient', handleActivePatientUpdate);
      socket.on('history_update', handleHistoryUpdate);

      if (socket.connected) {
        socket.emit('request_patients');
      }

      socket.on('connect', () => {
        socket.emit('request_patients');
      });

      return () => {
        socket.off('patients_update', handlePatientsUpdate);
        socket.off('update_patient', handleActivePatientUpdate);
        socket.off('history_update', handleHistoryUpdate);
        socket.off('connect');
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
            <Route path="/" element={<ReceptionView socket={socket} patients={patients} activePatient={activePatient} history={history} />} />
            <Route path="/surgery" element={<SurgeryView socket={socket} activePatient={activePatient} />} />
            <Route path="/history" element={<HistoryView socket={socket} history={history} />} />
          </Routes>
        </main>
        <Navigation />
      </div>
    </HashRouter>
  );
}

export default App;
