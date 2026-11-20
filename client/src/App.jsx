import React, { useState, useEffect, useMemo } from 'react';
import { HashRouter, Routes, Route, NavLink } from 'react-router-dom';
import { supabase } from './supabase';
import { useCirugias } from './useCirugias';
import { uiDe, quirofanosDe, hoyISO, ordenar } from './config';
import { Login, ElegirInstitucion, SinAcceso, MenuCuenta } from './Acceso';
import ReceptionView from './ReceptionView';
import SurgeryView from './SurgeryView';
import HistoryView from './HistoryView';
import VistaGeneral from './RoomSelector';
import Clock from './Clock';

const leer    = (store, key) => { try { return store.getItem(key); } catch { return null; } };
const guardar = (store, key, val) => { try { val === null ? store.removeItem(key) : store.setItem(key, val); } catch { /* */ } };

// ── Sesión y permisos ───────────────────────────────────────────────────────────
function App() {
    const [session,  setSession]  = useState(undefined); // undefined = todavía no se sabe
    // Permisos guardados junto con el usuario al que pertenecen (al cambiar de cuenta no se mezclan)
    const [permisos, setPermisos] = useState({ userId: null, membresias: null, error: false });
    const [instId,   setInstId]   = useState(() => leer(localStorage, 'qx_institucion'));

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => setSession(data.session));
        const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => setSession(s));
        return () => sub.subscription.unsubscribe();
    }, []);

    const userId = session?.user?.id;

    // Instituciones a las que tiene acceso y con qué rol
    useEffect(() => {
        if (!userId) return;
        supabase
            .from('qx_miembros')
            .select('rol, institucion:qx_instituciones(id, nombre, quirofanos, columnas_extra)')
            .eq('user_id', userId)
            .then(({ data, error }) => {
                const membresias = error ? [] : data
                    .filter(m => m.institucion)
                    .sort((a, b) => a.institucion.nombre.localeCompare(b.institucion.nombre));
                setPermisos({ userId, membresias, error: !!error });
            });
    }, [userId]);

    const membresias = permisos.userId === userId ? permisos.membresias : null;
    const errorPerm  = permisos.userId === userId && permisos.error;

    const elegir = (id) => { guardar(localStorage, 'qx_institucion', id); setInstId(id); };

    if (session === undefined || (session && membresias === null)) {
        return <div style={{ minHeight: '100vh', background: '#0f172a' }} />;
    }
    if (!session) return <Login />;
    if (membresias.length === 0) return <SinAcceso email={session.user.email} error={errorPerm} />;

    // Con una sola institución entra directo; si tiene varias, elige
    const membresia = membresias.length === 1
        ? membresias[0]
        : membresias.find(m => m.institucion.id === instId);
    if (!membresia) return <ElegirInstitucion membresias={membresias} onElegir={elegir} />;

    return (
        <Espacio
            key={membresia.institucion.id}
            institucion={membresia.institucion}
            rol={membresia.rol}
            email={session.user.email}
            puedeCambiarInstitucion={membresias.length > 1}
            onCambiarInstitucion={() => elegir(null)}
        />
    );
}

// ── Espacio de trabajo de una institución ───────────────────────────────────────
function Espacio({ institucion, rol, email, puedeCambiarInstitucion, onCambiarInstitucion }) {
    const ui          = uiDe(institucion.id);
    const quirofanos  = useMemo(() => quirofanosDe(institucion), [institucion]);
    const puedeEditar = rol === 'admin' || rol === 'editor';
    const claveQ      = `qx_quirofano_${institucion.id}`;

    // Fecha: hoy por defecto; si nadie la cambió a mano, pasa sola al día siguiente a medianoche
    const [fecha,  setFechaState] = useState(hoyISO);
    const [fijada, setFijada]     = useState(false);
    const setFecha = (f) => { setFechaState(f); setFijada(f !== hoyISO()); };
    useEffect(() => {
        if (fijada) return;
        const t = setInterval(() => { if (hoyISO() !== fecha) setFechaState(hoyISO()); }, 60 * 1000);
        return () => clearInterval(t);
    }, [fecha, fijada]);

    const [numQ, setNumQ] = useState(() => Number(leer(sessionStorage, claveQ)) || null);
    const quirofano = quirofanos.find(q => q.numero === numQ) || null;
    const elegirQuirofano = (q) => { guardar(sessionStorage, claveQ, q ? String(q.numero) : null); setNumQ(q ? q.numero : null); };

    const { rows, cargando, error, conectado, recargar } = useCirugias(institucion.id, fecha);

    // Aviso de "sin conexión" si se corta más de 3 segundos (evita parpadeos)
    const [sinConexion, setSinConexion] = useState(false);
    useEffect(() => {
        if (conectado) return;
        const t = setTimeout(() => setSinConexion(true), 3000);
        return () => { clearTimeout(t); setSinConexion(false); };
    }, [conectado]);

    const avisoConexion = sinConexion && (
        <div className="no-print" style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10000,
            background: '#dc2626', color: 'white', textAlign: 'center',
            padding: '8px 12px', fontWeight: 700, fontSize: '0.9rem'
        }}>
            ⚠️ Sin conexión — reconectando… Lo que se ve puede no estar actualizado.
        </div>
    );

    const menu = (oscuro) => (
        <MenuCuenta email={email} rol={rol} institucion={institucion.nombre} oscuro={oscuro}
                    puedeCambiarInstitucion={puedeCambiarInstitucion} onCambiarInstitucion={onCambiarInstitucion} />
    );

    if (!quirofano) {
        return (
            <>
                {avisoConexion}
                <VistaGeneral institucion={institucion} ui={ui} quirofanos={quirofanos} rows={rows}
                              fecha={fecha} setFecha={setFecha} cargando={cargando} error={error}
                              conectado={conectado} onElegir={elegirQuirofano} menu={menu(true)} />
            </>
        );
    }

    const delQuirofano = ordenar(rows.filter(r => r.quirofano === quirofano.numero));
    const activa       = delQuirofano.find(r => r.estado === 'en_curso') || null;

    return (
        <HashRouter>
            <div className="app-container">
                {avisoConexion}
                <div className="no-print" style={{
                    position: 'fixed', top: 0, left: 0,
                    background: quirofano.color, color: 'white',
                    padding: '3px 12px', fontSize: '0.75rem', fontWeight: '700',
                    borderBottomRightRadius: '8px', zIndex: 9998, letterSpacing: '0.05em'
                }}>
                    {institucion.nombre.toUpperCase()} · {quirofano.nombre.toUpperCase()}
                </div>
                <Clock />
                <main className="content">
                    <Routes>
                        <Route path="/" element={
                            <ReceptionView institucion={institucion} ui={ui} quirofano={quirofano}
                                           rows={delQuirofano} activa={activa} puedeEditar={puedeEditar}
                                           fecha={fecha} setFecha={setFecha} recargar={recargar} />
                        } />
                        <Route path="/surgery" element={
                            <SurgeryView institucion={institucion} ui={ui} quirofano={quirofano}
                                         activa={activa} puedeEditar={puedeEditar} recargar={recargar} />
                        } />
                        <Route path="/history" element={
                            <HistoryView ui={ui} rows={delQuirofano} fecha={fecha}
                                         puedeEditar={puedeEditar} recargar={recargar} />
                        } />
                    </Routes>
                </main>
                <Navegacion quirofano={quirofano} conectado={conectado}
                            onGeneral={() => elegirQuirofano(null)} menu={menu(false)} />
            </div>
        </HashRouter>
    );
}

function Navegacion({ quirofano, conectado, onGeneral, menu }) {
    return (
        <nav className="bottom-nav no-print">
            <div className={`connection-status ${conectado ? 'online' : 'offline'}`}
                 title={conectado ? 'Conectado' : 'Sin conexión'} />
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
            <button onClick={onGeneral} className="nav-item no-print"
                    style={{ background: 'none', border: 'none', cursor: 'pointer',
                             borderLeft: `3px solid ${quirofano.color}`, paddingLeft: '8px' }}>
                <span className="nav-icon">⊞</span>
                <span className="nav-label" style={{ color: quirofano.color, fontSize: '0.65rem' }}>GENERAL</span>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', paddingRight: '8px' }}>{menu}</div>
        </nav>
    );
}

export default App;
