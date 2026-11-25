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

    // Si Google rechazó o se canceló el ingreso, vuelve con ?error_description=…
    const [errorOAuth] = useState(() => new URLSearchParams(window.location.search).get('error_description'));

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            setSession(data.session);
            // getSession ya canjeó el ?code= de Google por la sesión: limpiar la dirección
            if (/[?&](code|error)=/.test(window.location.search)) {
                window.history.replaceState(null, '', window.location.pathname + window.location.hash);
            }
        });
        const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => setSession(s));
        return () => sub.subscription.unsubscribe();
    }, []);

    const userId = session?.user?.id;

    // Instituciones a las que tiene acceso y con qué rol
    useEffect(() => {
        if (!userId) return;
        (async () => {
            // Si un administrador invitó a este email, las invitaciones se convierten en permisos
            await supabase.rpc('qx_reclamar_invitaciones');
            const { data, error } = await supabase
                .from('qx_miembros')
                .select('rol, institucion:qx_instituciones(id, nombre, quirofanos, columnas_extra, nombres_quirofanos)')
                .eq('user_id', userId);
            const membresias = error ? [] : data
                .filter(m => m.institucion)
                .sort((a, b) => a.institucion.nombre.localeCompare(b.institucion.nombre));
            setPermisos({ userId, membresias, error: !!error });
        })();
    }, [userId]);

    const membresias = permisos.userId === userId ? permisos.membresias : null;
    const errorPerm  = permisos.userId === userId && permisos.error;

    const elegir = (id) => { guardar(localStorage, 'qx_institucion', id); setInstId(id); };

    if (session === undefined || (session && membresias === null)) {
        return <div style={{ minHeight: '100vh', background: '#0f172a' }} />;
    }
    if (!session) return <Login errorInicial={errorOAuth} />;
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
            miId={userId}
            puedeCambiarInstitucion={membresias.length > 1}
            onCambiarInstitucion={() => elegir(null)}
        />
    );
}

// ── Espacio de trabajo de una institución ───────────────────────────────────────
function Espacio({ institucion, rol, email, miId, puedeCambiarInstitucion, onCambiarInstitucion }) {
    const ui          = uiDe(institucion.id);
    const quirofanos  = useMemo(() => quirofanosDe(institucion), [institucion]);
    const puedeEditar = rol === 'admin' || rol === 'editor';
    const puedeOperar = puedeEditar || rol === 'operador';   // proyectar y finalizar
    const claveVista  = `qx_vista_${institucion.id}`;
    // Pantalla de inicio: quien edita arranca en la Lista del día; quien solo ve, en la Vista general
    const inicio      = puedeOperar ? 'lista' : 'general';

    // Fecha: hoy por defecto; si nadie la cambió a mano, pasa sola al día siguiente a medianoche
    const [fecha,  setFechaState] = useState(hoyISO);
    const [fijada, setFijada]     = useState(false);
    const setFecha = (f) => { setFechaState(f); setFijada(f !== hoyISO()); };
    useEffect(() => {
        if (fijada) return;
        const t = setInterval(() => { if (hoyISO() !== fecha) setFechaState(hoyISO()); }, 60 * 1000);
        return () => clearInterval(t);
    }, [fecha, fijada]);

    // Vista actual: 'lista', 'general' o el número de quirófano ('1', '2', …)
    const [vista, setVistaState] = useState(() => leer(sessionStorage, claveVista) || inicio);
    const setVista = (v) => { guardar(sessionStorage, claveVista, v); setVistaState(v); };
    const quirofano = quirofanos.find(q => String(q.numero) === vista) || null;
    // pantalla: '/' (ingreso del quirófano) o '/surgery' (pantalla del quirófano)
    const entrarQuirofano = (q, pantalla = '/') => {
        window.location.hash = '#' + pantalla;
        setVista(String(q.numero));
    };

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

    const menu = (oscuro, arriba = false) => (
        <MenuCuenta email={email} miId={miId} rol={rol} institucionObj={institucion} oscuro={oscuro} arriba={arriba}
                    puedeCambiarInstitucion={puedeCambiarInstitucion} onCambiarInstitucion={onCambiarInstitucion} />
    );

    const botonVista = (texto, destino, oscuro) => (
        <button onClick={() => setVista(destino)}
                style={{ padding: '8px 14px', fontWeight: 700, borderRadius: '8px', cursor: 'pointer',
                         background: 'none', border: `1px solid ${oscuro ? '#475569' : '#cbd5e1'}`,
                         color: oscuro ? '#e2e8f0' : '#0f172a' }}>
            {texto}
        </button>
    );

    if (vista === 'lista') {
        return (
            <>
                {avisoConexion}
                <ReceptionView
                    institucion={institucion} ui={ui} quirofano={null} quirofanos={quirofanos}
                    rows={ordenar(rows)} puedeEditar={puedeEditar} puedeOperar={puedeOperar} fecha={fecha} setFecha={setFecha}
                    recargar={recargar} onEntrarQuirofano={(q) => entrarQuirofano(q, '/surgery')}
                    encabezado={
                        <>
                            <h1 style={{ margin: 0 }}>📋 Lista del día — {institucion.nombre}</h1>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ color: conectado ? '#16a34a' : '#dc2626', fontWeight: 700, fontSize: '0.85rem' }}>
                                    {conectado ? '● En vivo' : '● Sin conexión'}
                                </span>
                                {botonVista('⊞ Vista general', 'general')}
                                {menu(false)}
                            </div>
                        </>
                    } />
            </>
        );
    }

    if (!quirofano) {
        return (
            <>
                {avisoConexion}
                <VistaGeneral institucion={institucion} ui={ui} quirofanos={quirofanos} rows={rows}
                              fecha={fecha} setFecha={setFecha} cargando={cargando} error={error}
                              conectado={conectado} onElegir={(q) => entrarQuirofano(q)} menu={menu(true)}
                              botonLista={botonVista('📋 Lista del día', 'lista', true)} />
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
                            <ReceptionView institucion={institucion} ui={ui} quirofano={quirofano} quirofanos={quirofanos}
                                           rows={delQuirofano} puedeEditar={puedeEditar} puedeOperar={puedeOperar}
                                           fecha={fecha} setFecha={setFecha} recargar={recargar} />
                        } />
                        <Route path="/surgery" element={
                            <SurgeryView institucion={institucion} ui={ui} quirofano={quirofano}
                                         activa={activa} puedeOperar={puedeOperar} recargar={recargar} />
                        } />
                        <Route path="/history" element={
                            <HistoryView ui={ui} rows={delQuirofano} fecha={fecha}
                                         puedeEditar={puedeEditar} recargar={recargar} />
                        } />
                    </Routes>
                </main>
                <Navegacion quirofano={quirofano} conectado={conectado}
                            onLista={() => setVista('lista')} onGeneral={() => setVista('general')}
                            menu={menu(false, true)} />
            </div>
        </HashRouter>
    );
}

function Navegacion({ quirofano, conectado, onLista, onGeneral, menu }) {
    const botonSalida = (onClick, icono, texto, borde) => (
        <button onClick={onClick} className="nav-item no-print"
                style={{ background: 'none', border: 'none', cursor: 'pointer',
                         ...(borde ? { borderLeft: `3px solid ${quirofano.color}`, paddingLeft: '8px' } : {}) }}>
            <span className="nav-icon">{icono}</span>
            <span className="nav-label" style={{ color: quirofano.color, fontSize: '0.65rem' }}>{texto}</span>
        </button>
    );

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
            {botonSalida(onLista,   '📋', 'LISTA',   true)}
            {botonSalida(onGeneral, '⊞',  'GENERAL', false)}
            <div style={{ display: 'flex', alignItems: 'center', paddingRight: '8px' }}>{menu}</div>
        </nav>
    );
}

export default App;
