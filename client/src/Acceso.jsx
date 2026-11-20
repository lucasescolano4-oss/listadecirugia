import React, { useState } from 'react';
import { supabase } from './supabase';

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
export function Login() {
    const [email,    setEmail]    = useState('');
    const [password, setPassword] = useState('');
    const [error,    setError]    = useState('');
    const [enviando, setEnviando] = useState(false);

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
                    Las cuentas las crea el administrador del sistema.
                </p>
            </form>
        </div>
    );
}

// ── Elegir institución (Privado / HZE) ──────────────────────────────────────────
const ROL_TEXTO = { admin: 'Administrador', editor: 'Puede cargar y modificar', lector: 'Solo lectura' };

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
    return (
        <div style={pantalla}>
            <Titulo />
            <div style={{ ...tarjeta, textAlign: 'center' }}>
                {error ? (
                    <p>No se pudieron cargar tus permisos. Revisá la conexión y recargá la página.</p>
                ) : (
                    <>
                        <p style={{ marginTop: 0 }}>Tu cuenta <strong>{email}</strong> todavía no tiene acceso a ninguna institución.</p>
                        <p style={{ color: '#94a3b8', marginBottom: 0 }}>Pedile al administrador que te habilite.</p>
                    </>
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
export function MenuCuenta({ email, rol, institucion, puedeCambiarInstitucion, onCambiarInstitucion, oscuro }) {
    const [abierto,  setAbierto]  = useState(false);
    const [password, setPassword] = useState(false);

    const item = {
        display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none',
        border: 'none', borderTop: '1px solid #e2e8f0', cursor: 'pointer', fontSize: '0.95rem', color: '#0f172a'
    };

    return (
        <div style={{ position: 'relative' }}>
            <button onClick={() => setAbierto(a => !a)} title="Cuenta"
                    style={{ background: 'none', border: `1px solid ${oscuro ? '#475569' : '#cbd5e1'}`, borderRadius: '999px',
                             padding: '4px 12px', cursor: 'pointer', color: oscuro ? '#e2e8f0' : '#0f172a', fontWeight: 600 }}>
                👤 {institucion}
            </button>
            {abierto && (
                <>
                    <div onClick={() => setAbierto(false)} style={{ position: 'fixed', inset: 0, zIndex: 10002 }} />
                    <div style={{ position: 'absolute', right: 0, bottom: oscuro ? 'auto' : '110%', top: oscuro ? '110%' : 'auto',
                                  zIndex: 10003, background: 'white', borderRadius: '10px', minWidth: '240px',
                                  boxShadow: '0 10px 30px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
                        <div style={{ padding: '10px 14px', color: '#475569', fontSize: '0.85rem' }}>
                            <div style={{ fontWeight: 700, color: '#0f172a', wordBreak: 'break-all' }}>{email}</div>
                            {institucion} · {ROL_TEXTO[rol]}
                        </div>
                        {puedeCambiarInstitucion && (
                            <button style={item} onClick={() => { setAbierto(false); onCambiarInstitucion(); }}>🔁 Cambiar institución</button>
                        )}
                        <button style={item} onClick={() => { setAbierto(false); setPassword(true); }}>🔑 Cambiar contraseña</button>
                        <button style={{ ...item, color: '#dc2626' }} onClick={() => supabase.auth.signOut()}>⏻ Cerrar sesión</button>
                    </div>
                </>
            )}
            {password && <CambiarPassword onCerrar={() => setPassword(false)} />}
        </div>
    );
}
