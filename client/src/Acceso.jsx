import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';
import Usuarios from './Usuarios';

const pantalla = {
    minHeight: '100vh', display: 'flex', flexDirection: 'column',
    justifyContent: 'center', alignItems: 'center', gap: '1.5rem',
    backgroundColor: '#0f172a', color: '#f1f5f9', padding: '1.5rem', boxSizing: 'border-box'
};

const tarjeta = {
    width: '100%', maxWidth: '380px', backgroundColor: '#1e293b',
    border: '1px solid #334155', borderRadius: '16px', padding: '1.75rem', boxSizing: 'border-box'
};

const input = {
    width: '100%', padding: '12px', fontSize: '16px', borderRadius: '8px',
    border: '1px solid #475569', backgroundColor: '#0f172a', color: '#f1f5f9', boxSizing: 'border-box'
};

const boton = {
    width: '100%', padding: '12px', fontSize: '1rem', fontWeight: 700, border: 'none',
    borderRadius: '8px', backgroundColor: '#0ea5e9', color: 'white', cursor: 'pointer'
};

function Titulo({ subtitulo }) {
    return (
        <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem' }}>🏥</div>
            <h1 style={{ margin: '0.25rem 0 0', fontSize: '1.6rem', fontWeight: 800, letterSpacing: '0.05em' }}>
                PROGRAMACIÓN DE QUIRÓFANO
            </h1>
            {subtitulo && <p style={{ color: '#94a3b8', margin: '0.5rem 0 0' }}>{subtitulo}</p>}
        </div>
    );
}

// ── Inicio de sesión ────────────────────────────────────────────────────────────
function LogoGoogle() {
    return (
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/>
        </svg>
    );
}

export function Login({ errorInicial }) {
    const [email,    setEmail]    = useState('');
    const [password, setPassword] = useState('');
    const [error,    setError]    = useState(errorInicial ? 'No se pudo ingresar con Google: ' + errorInicial : '');
    const [enviando, setEnviando] = useState(false);

    const conGoogle = async () => {
        setError('');
        const { error: err } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            // Vuelve a esta misma app; prompt=select_account deja elegir la cuenta de Google
            options: { redirectTo: window.location.origin + '/', queryParams: { prompt: 'select_account' } }
        });
        if (err) setError('No se pudo iniciar con Google: ' + err.message);
    };

    const entrar = async (e) => {
        e.preventDefault();
        setError('');
        setEnviando(true);
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        setEnviando(false);
        if (err) {
            setError(err.message === 'Invalid login credentials'
                ? 'Email o contraseña incorrectos.'
                : 'No se pudo iniciar sesión. Revisá la conexión y reintentá.');
        }
    };

    return (
        <div style={pantalla}>
            <Titulo subtitulo="Ingresá con tu cuenta" />
            <form onSubmit={entrar} style={{ ...tarjeta, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button type="button" onClick={conGoogle}
                        style={{ ...boton, backgroundColor: 'white', color: '#1f2937', display: 'flex',
                                 alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    <LogoGoogle /> Entrar con Google
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#64748b', fontSize: '0.8rem' }}>
                    <span style={{ flex: 1, height: '1px', background: '#334155' }} />
                    o con email y contraseña
                    <span style={{ flex: 1, height: '1px', background: '#334155' }} />
                </div>
                <label style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                    Email
                    <input type="email" autoComplete="username" required value={email}
                           onChange={e => setEmail(e.target.value)} style={{ ...input, marginTop: '4px' }} />
                </label>
                <label style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                    Contraseña
                    <input type="password" autoComplete="current-password" required value={password}
                           onChange={e => setPassword(e.target.value)} style={{ ...input, marginTop: '4px' }} />
                </label>
                {error && <div style={{ color: '#fca5a5', fontSize: '0.9rem' }}>{error}</div>}
                <button type="submit" disabled={enviando} style={{ ...boton, opacity: enviando ? 0.6 : 1 }}>
                    {enviando ? 'Ingresando…' : 'INGRESAR'}
                </button>
                <p style={{ color: '#64748b', fontSize: '0.8rem', margin: '4px 0 0', textAlign: 'center' }}>
                    Para usar el sistema, un administrador tiene que habilitar tu email.
                </p>
            </form>
        </div>
    );
}

// ── Elegir institución (Privado / HZE) ──────────────────────────────────────────
const ROL_TEXTO = { admin: 'Administrador', editor: 'Puede cargar y modificar', operador: 'Proyecta y finaliza', lector: 'Solo lectura' };

export function ElegirInstitucion({ membresias, onElegir }) {
    return (
        <div style={pantalla}>
            <Titulo subtitulo="Elegí dónde vas a trabajar" />
            <div style={{ display: 'grid', gap: '1rem', width: '100%', maxWidth: '420px' }}>
                {membresias.map(m => (
                    <button key={m.institucion.id} onClick={() => onElegir(m.institucion.id)}
                            style={{ ...tarjeta, maxWidth: 'none', cursor: 'pointer', color: 'inherit', textAlign: 'left',
                                     display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>
                            <span style={{ display: 'block', fontSize: '1.4rem', fontWeight: 800 }}>{m.institucion.nombre}</span>
                            <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                                {m.institucion.quirofanos} quirófanos · {ROL_TEXTO[m.rol]}
                            </span>
                        </span>
                        <span style={{ fontSize: '1.5rem', color: '#0ea5e9' }}>›</span>
                    </button>
                ))}
            </div>
            <BotonSalir />
        </div>
    );
}

// ── Cuenta sin permisos asignados ───────────────────────────────────────────────
export function SinAcceso({ email, error }) {
    const [mensaje,   setMensaje]   = useState('');
    const [pedida,    setPedida]    = useState(null);   // fecha de la solicitud, si ya la hizo
    const [enviando,  setEnviando]  = useState(false);
    const [errorPedido, setErrorPedido] = useState('');

    useEffect(() => {
        supabase.rpc('qx_mi_solicitud').then(({ data }) => setPedida(data || null));
    }, []);

    const pedir = async (e) => {
        e.preventDefault();
        setEnviando(true);
        setErrorPedido('');
        const { error: err } = await supabase.rpc('qx_solicitar_acceso', { p_mensaje: mensaje });
        setEnviando(false);
        if (err) setErrorPedido('No se pudo enviar: ' + err.message);
        else setPedida(new Date().toISOString());
    };

    return (
        <div style={pantalla}>
            <Titulo />
            <div style={{ ...tarjeta, textAlign: 'center' }}>
                {error ? (
                    <p>No se pudieron cargar tus permisos. Revisá la conexión y recargá la página.</p>
                ) : pedida ? (
                    <>
                        <p style={{ marginTop: 0 }}>✓ Pediste acceso con <strong>{email}</strong>.</p>
                        <p style={{ color: '#94a3b8' }}>Cuando un administrador lo apruebe, vas a poder entrar.</p>
                        <button onClick={() => window.location.reload()} style={boton}>YA ME HABILITARON — ENTRAR</button>
                    </>
                ) : (
                    <form onSubmit={pedir} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <p style={{ margin: 0 }}>Tu cuenta <strong>{email}</strong> todavía no tiene acceso.</p>
                        <p style={{ color: '#94a3b8', margin: 0 }}>Podés pedírselo al administrador:</p>
                        <textarea value={mensaje} onChange={e => setMensaje(e.target.value)} maxLength={300} rows={3}
                                  placeholder="Ej.: Soy instrumentadora del HZE, quirófano 2"
                                  style={{ ...input, resize: 'vertical' }} />
                        {errorPedido && <div style={{ color: '#fca5a5' }}>{errorPedido}</div>}
                        <button type="submit" disabled={enviando} style={boton}>{enviando ? 'Enviando…' : 'SOLICITAR ACCESO'}</button>
                    </form>
                )}
            </div>
            <BotonSalir />
        </div>
    );
}

export function BotonSalir() {
    return (
        <button onClick={() => supabase.auth.signOut()}
                style={{ background: 'none', border: '1px solid #475569', color: '#cbd5e1',
                         padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>
            Cerrar sesión
        </button>
    );
}

// ── Cambiar contraseña ──────────────────────────────────────────────────────────
export function CambiarPassword({ onCerrar }) {
    const [nueva,    setNueva]    = useState('');
    const [repetir,  setRepetir]  = useState('');
    const [error,    setError]    = useState('');
    const [listo,    setListo]    = useState(false);
    const [enviando, setEnviando] = useState(false);

    const guardar = async (e) => {
        e.preventDefault();
        setError('');
        if (nueva.length < 8)   return setError('Tiene que tener al menos 8 caracteres.');
        if (nueva !== repetir)  return setError('Las dos contraseñas no coinciden.');
        setEnviando(true);
        const { error: err } = await supabase.auth.updateUser({ password: nueva });
        setEnviando(false);
        if (err) setError('No se pudo cambiar: ' + err.message);
        else setListo(true);
    };

    return (
        <div className="modal-overlay" onClick={onCerrar}>
            <form className="modal-content" onClick={e => e.stopPropagation()} onSubmit={guardar}
                  style={{ maxWidth: '380px', width: '95%', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h2 style={{ margin: 0, textAlign: 'center' }}>Cambiar contraseña</h2>
                {listo ? (
                    <>
                        <p style={{ textAlign: 'center' }}>✓ Contraseña actualizada.</p>
                        <button type="button" onClick={onCerrar} style={boton}>CERRAR</button>
                    </>
                ) : (
                    <>
                        <input type="password" autoComplete="new-password" placeholder="Nueva contraseña"
                               value={nueva} onChange={e => setNueva(e.target.value)} style={{ padding: '10px', fontSize: '16px' }} />
                        <input type="password" autoComplete="new-password" placeholder="Repetir contraseña"
                               value={repetir} onChange={e => setRepetir(e.target.value)} style={{ padding: '10px', fontSize: '16px' }} />
                        {error && <div style={{ color: '#dc2626' }}>{error}</div>}
                        <button type="submit" disabled={enviando} style={boton}>{enviando ? 'Guardando…' : 'GUARDAR'}</button>
                        <button type="button" className="btn-cancel" onClick={onCerrar}
                                style={{ padding: '10px', borderRadius: '8px', cursor: 'pointer' }}>CANCELAR</button>
                    </>
                )}
            </form>
        </div>
    );
}

// ── Menú de cuenta (email, cambiar contraseña, institución, salir) ──────────────
export function MenuCuenta({ email, miId, rol, institucionObj, puedeCambiarInstitucion, onCambiarInstitucion, oscuro, arriba }) {
    const [abierto,  setAbierto]  = useState(false);
    const [password, setPassword] = useState(false);
    const [usuarios, setUsuarios] = useState(false);
    const [pedidos,  setPedidos]  = useState(0);   // solicitudes de acceso pendientes (solo admin)
    const institucion = institucionObj.nombre;
    const esAdmin = rol === 'admin';

    // Cada minuto revisa si alguien pidió acceso (y al cerrar el panel de usuarios)
    useEffect(() => {
        if (!esAdmin || usuarios) return;
        const contar = () => supabase.rpc('qx_solicitudes_pendientes')
            .then(({ data }) => setPedidos(data ? data.length : 0));
        contar();
        const t = setInterval(contar, 60 * 1000);
        return () => clearInterval(t);
    }, [esAdmin, usuarios]);

    const globo = (n) => n > 0 && (
        <span style={{ background: '#dc2626', color: 'white', borderRadius: '999px', padding: '0 7px',
                       fontSize: '0.75rem', fontWeight: 800, marginLeft: '6px' }}>{n}</span>
    );

    const item = {
        display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none',
        border: 'none', borderTop: '1px solid #e2e8f0', cursor: 'pointer', fontSize: '0.95rem', color: '#0f172a'
    };

    return (
        <div style={{ position: 'relative' }}>
            <button onClick={() => setAbierto(a => !a)} title="Cuenta"
                    style={{ background: 'none', border: `1px solid ${oscuro ? '#475569' : '#cbd5e1'}`, borderRadius: '999px',
                             padding: '4px 12px', cursor: 'pointer', color: oscuro ? '#e2e8f0' : '#0f172a', fontWeight: 600 }}>
                👤 {institucion}{globo(pedidos)}
            </button>
            {abierto && (
                <>
                    <div onClick={() => setAbierto(false)} style={{ position: 'fixed', inset: 0, zIndex: 10002 }} />
                    <div style={{ position: 'absolute', right: 0, bottom: arriba ? '110%' : 'auto', top: arriba ? 'auto' : '110%',
                                  zIndex: 10003, background: 'white', borderRadius: '10px', minWidth: '240px',
                                  boxShadow: '0 10px 30px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
                        <div style={{ padding: '10px 14px', color: '#475569', fontSize: '0.85rem' }}>
                            <div style={{ fontWeight: 700, color: '#0f172a', wordBreak: 'break-all' }}>{email}</div>
                            {institucion} · {ROL_TEXTO[rol]}
                        </div>
                        {puedeCambiarInstitucion && (
                            <button style={item} onClick={() => { setAbierto(false); onCambiarInstitucion(); }}>🔁 Cambiar institución</button>
                        )}
                        {esAdmin && (
                            <button style={item} onClick={() => { setAbierto(false); setUsuarios(true); }}>
                                👥 Usuarios e invitaciones{globo(pedidos)}
                            </button>
                        )}
                        <button style={item} onClick={() => { setAbierto(false); setPassword(true); }}>🔑 Cambiar contraseña</button>
                        <button style={{ ...item, color: '#dc2626' }} onClick={() => supabase.auth.signOut()}>⏻ Cerrar sesión</button>
                    </div>
                </>
            )}
            {password && <CambiarPassword onCerrar={() => setPassword(false)} />}
            {usuarios && <Usuarios institucion={institucionObj} miId={miId} onCerrar={() => setUsuarios(false)} />}
        </div>
    );
}
