import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

const ROLES = [
    { id: 'operador', nombre: 'Operador',      detalle: 'Ve la lista, proyecta y finaliza (personal de quirófano)' },
    { id: 'lector',   nombre: 'Solo lectura',  detalle: 'Ve todo, no puede modificar nada' },
    { id: 'editor',   nombre: 'Editor',        detalle: 'Carga y modifica la lista' },
    { id: 'admin',    nombre: 'Administrador', detalle: 'Todo, incluido invitar y quitar usuarios' }
];

const nombreRol = (id) => ROLES.find(r => r.id === id)?.nombre || id;

function fechaIngreso(ts) {
    if (!ts) return 'Nunca ingresó';
    return 'Último ingreso: ' + new Date(ts).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const boton = (bg, extra = {}) => ({
    padding: '8px 14px', fontWeight: 700, border: 'none', borderRadius: '8px',
    backgroundColor: bg, color: 'white', cursor: 'pointer', ...extra
});

// Panel de administración de usuarios de una institución (solo admin)
function Usuarios({ institucion, miId, onCerrar }) {
    const [lista,   setLista]   = useState(null);
    const [error,   setError]   = useState('');
    const [aviso,   setAviso]   = useState('');
    const [email,   setEmail]   = useState('');
    const [rol,     setRol]     = useState('operador');
    const [ocupado, setOcupado] = useState(false);
    const [solicitudes, setSolicitudes] = useState([]);
    const [rolSolicitud, setRolSolicitud] = useState({});   // user_id → rol elegido para aprobar

    const cargar = useCallback(async () => {
        const [usuarios, pedidos] = await Promise.all([
            supabase.rpc('qx_usuarios', { p_institucion: institucion.id }),
            supabase.rpc('qx_solicitudes_pendientes')
        ]);
        if (usuarios.error) setError('No se pudieron cargar los usuarios: ' + usuarios.error.message);
        else { setError(''); setLista(usuarios.data); }
        setSolicitudes(pedidos.data || []);
    }, [institucion.id]);

    const aprobar = (s) => {
        const r = rolSolicitud[s.user_id] || 'operador';
        accion(
            () => supabase.rpc('qx_aprobar_solicitud', { p_user: s.user_id, p_institucion: institucion.id, p_rol: r }),
            `✓ ${s.email} ahora tiene acceso a ${institucion.nombre} como ${nombreRol(r)}.`
        );
    };

    const rechazar = (s) => {
        if (!window.confirm(`¿Rechazar la solicitud de ${s.email}?`)) return;
        accion(() => supabase.rpc('qx_rechazar_solicitud', { p_user: s.user_id }), `✓ Solicitud de ${s.email} rechazada.`);
    };

    useEffect(() => {
        // cargar() solo cambia el estado cuando llega la respuesta
        // eslint-disable-next-line react-hooks/set-state-in-effect
        cargar();
    }, [cargar]);

    // Ejecuta una acción, muestra el resultado y recarga la lista
    const accion = async (fn, textoOk) => {
        setOcupado(true);
        setAviso('');
        setError('');
        const { data, error: err } = await fn();
        setOcupado(false);
        if (err) { setError(err.message); return false; }
        setAviso(typeof textoOk === 'function' ? textoOk(data) : textoOk);
        cargar();
        return true;
    };

    const invitar = async (e) => {
        e.preventDefault();
        const destino = email.trim().toLowerCase();
        if (!destino) return;
        const ok = await accion(
            () => supabase.rpc('qx_invitar', { p_institucion: institucion.id, p_email: destino, p_rol: rol }),
            (res) => res === 'habilitado'
                ? `✓ ${destino} ya tenía cuenta: quedó habilitado/a como ${nombreRol(rol)}.`
                : `✓ Invitación guardada. Cuando ${destino} ingrese por primera vez con ese email, va a tener acceso como ${nombreRol(rol)}.`
        );
        if (ok) setEmail('');
    };

    const cambiarRol = (u, nuevo) => accion(
        () => supabase.rpc('qx_cambiar_rol', { p_institucion: institucion.id, p_user: u.user_id, p_rol: nuevo }),
        `✓ ${u.email} ahora es ${nombreRol(nuevo)}.`
    );

    const quitar = (u) => {
        if (!window.confirm(`¿Quitarle el acceso a ${u.email} en ${institucion.nombre}?\n\nSu cuenta sigue existiendo, pero ya no va a ver esta institución.`)) return;
        accion(() => supabase.rpc('qx_quitar_acceso', { p_institucion: institucion.id, p_user: u.user_id }), `✓ Se quitó el acceso a ${u.email}.`);
    };

    const cancelar = (u) => accion(
        () => supabase.rpc('qx_cancelar_invitacion', { p_institucion: institucion.id, p_email: u.email }),
        `✓ Invitación a ${u.email} cancelada.`
    );

    const miembros   = (lista || []).filter(u => !u.pendiente);
    const pendientes = (lista || []).filter(u => u.pendiente);

    const fila = { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderTop: '1px solid #e2e8f0', flexWrap: 'wrap' };

    return (
        <div className="modal-overlay" onClick={onCerrar}>
            <div className="modal-content" onClick={e => e.stopPropagation()}
                 style={{ maxWidth: '640px', width: '95%', maxHeight: '90vh', overflowY: 'auto', textAlign: 'left' }}>
                <h2 style={{ marginTop: 0, textAlign: 'center' }}>👥 Usuarios — {institucion.nombre}</h2>

                {/* Invitar */}
                <form onSubmit={invitar} style={{ background: '#f1f5f9', borderRadius: '10px', padding: '12px', marginBottom: '1rem' }}>
                    <strong>Invitar por email</strong>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                        <input type="email" required placeholder="nombre@gmail.com" value={email}
                               onChange={e => setEmail(e.target.value)}
                               style={{ flex: '2 1 220px', padding: '8px', fontSize: '16px' }} />
                        <select value={rol} onChange={e => setRol(e.target.value)} style={{ flex: '1 1 140px', padding: '8px', fontSize: '16px' }}>
                            {ROLES.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                        </select>
                        <button type="submit" disabled={ocupado} style={boton('#0ea5e9')}>INVITAR</button>
                    </div>
                    <small style={{ color: '#475569' }}>{ROLES.find(r => r.id === rol)?.detalle}</small>
                </form>

                {aviso && <div style={{ background: '#dcfce7', color: '#166534', padding: '8px 12px', borderRadius: '8px', marginBottom: '8px' }}>{aviso}</div>}
                {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '8px 12px', borderRadius: '8px', marginBottom: '8px' }}>⚠️ {error}</div>}

                {lista === null && !error && <p>Cargando…</p>}

                {/* Solicitudes de acceso */}
                {solicitudes.length > 0 && (
                    <div style={{ border: '2px solid #f59e0b', borderRadius: '10px', padding: '4px 12px 8px', marginBottom: '1rem' }}>
                        <h3 style={{ marginBottom: '4px' }}>🔔 Solicitudes de acceso ({solicitudes.length})</h3>
                        {solicitudes.map(s => (
                            <div key={s.user_id} style={fila}>
                                <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, wordBreak: 'break-all' }}>{s.nombre ? `${s.nombre} — ` : ''}{s.email}</div>
                                    {s.verificado_google ? (
                                        <small style={{ color: '#166534', fontWeight: 700 }}>✓ Email verificado por Google</small>
                                    ) : (
                                        <small style={{ color: '#b45309', fontWeight: 700 }}
                                               title="Entró con email y contraseña: no está comprobado que el email sea suyo">
                                            ⚠️ Email sin verificar — confirmá con la persona antes de aprobar
                                        </small>
                                    )}
                                    {s.mensaje && <div style={{ fontStyle: 'italic', color: '#334155' }}>“{s.mensaje}”</div>}
                                    <small style={{ color: '#64748b' }}>
                                        Pedido el {new Date(s.creado_en).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                    </small>
                                </div>
                                <select value={rolSolicitud[s.user_id] || 'operador'} disabled={ocupado}
                                        onChange={e => setRolSolicitud(prev => ({ ...prev, [s.user_id]: e.target.value }))} style={{ padding: '6px' }}>
                                    {ROLES.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                                </select>
                                <button onClick={() => aprobar(s)} disabled={ocupado} style={boton('#16a34a', { padding: '6px 10px' })}>
                                    Aprobar en {institucion.nombre}
                                </button>
                                <button onClick={() => rechazar(s)} disabled={ocupado} className="btn-cancel"
                                        style={{ padding: '6px 10px', borderRadius: '8px', cursor: 'pointer' }}>Rechazar</button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Con acceso */}
                {miembros.length > 0 && (
                    <>
                        <h3 style={{ marginBottom: '4px' }}>Con acceso ({miembros.length})</h3>
                        {miembros.map(u => (
                            <div key={u.user_id} style={fila}>
                                <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, wordBreak: 'break-all' }}>{u.email}{u.user_id === miId && ' (vos)'}</div>
                                    <small style={{ color: '#64748b' }}>{fechaIngreso(u.ultimo_ingreso)}</small>
                                </div>
                                <select value={u.rol} disabled={ocupado} onChange={e => cambiarRol(u, e.target.value)} style={{ padding: '6px' }}>
                                    {ROLES.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                                </select>
                                <button onClick={() => quitar(u)} disabled={ocupado} title="Quitar acceso"
                                        style={boton('#dc2626', { padding: '6px 10px' })}>Quitar</button>
                            </div>
                        ))}
                    </>
                )}

                {/* Invitaciones pendientes */}
                {pendientes.length > 0 && (
                    <>
                        <h3 style={{ marginBottom: '4px' }}>Invitaciones pendientes ({pendientes.length})</h3>
                        {pendientes.map(u => (
                            <div key={u.email} style={fila}>
                                <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, wordBreak: 'break-all' }}>{u.email}</div>
                                    <small style={{ color: '#64748b' }}>{nombreRol(u.rol)} · todavía no ingresó</small>
                                </div>
                                <button onClick={() => cancelar(u)} disabled={ocupado} className="btn-cancel"
                                        style={{ padding: '6px 10px', borderRadius: '8px', cursor: 'pointer' }}>Cancelar</button>
                            </div>
                        ))}
                    </>
                )}

                <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
                    Si el email es de Google (Gmail o cuentas de Google), alcanza con que la persona toque
                    "Entrar con Google": la invitación se aplica sola. Si no lo es, hay que crearle la cuenta en
                    Supabase (Authentication → Users) con ese mismo email.
                </p>

                <button onClick={onCerrar} style={boton('#475569', { width: '100%', padding: '12px' })}>CERRAR</button>
            </div>
        </div>
    );
}

export default Usuarios;
