import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from './supabase';
import { aFila, valor, label, normalizeHeader, parseHora, BASE_FIELDS, EQUIPO, CASILLAS, fechaLarga } from './config';
import SelectorFecha from './SelectorFecha';

// Convierte el texto copiado de Excel (filas separadas por salto de línea, celdas por tab)
// en pacientes. Si la primera fila tiene encabezados se usan; si no, se asume el orden de `columnas`.
function parsePastedRows(text, columnas) {
    const rows = text
        .split(/\r?\n/)
        .map(line => line.split('\t'))
        .filter(cells => cells.some(c => c.trim() !== ''));
    if (rows.length === 0) return [];

    const firstRow  = rows[0].map(normalizeHeader);
    const hasHeader = firstRow.some(h => ['NOMBRE Y APELLIDO', 'HORA', 'DNI'].includes(h));
    const headers   = hasHeader ? firstRow : columnas;
    const dataRows  = hasHeader ? rows.slice(1) : rows;

    return dataRows.map(cells => {
        const paciente = {};
        headers.forEach((h, i) => {
            const val = (cells[i] ?? '').trim();
            if (h && val) paciente[h] = val;
        });
        return paciente;
    });
}

// Lee la primera hoja de un Excel con una fila de encabezados
function parseExcelSimple(buffer) {
    const wb = XLSX.read(buffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws, { raw: true }).map(row => {
        const paciente = {};
        Object.keys(row).forEach(k => { paciente[normalizeHeader(k)] = row[k]; });
        return paciente;
    });
}

function mensajeError(error) {
    if (!navigator.onLine || /fetch|network/i.test(error?.message || '')) {
        return 'Sin conexión. No se guardó — reintentá cuando vuelva la conexión.';
    }
    if (error?.code === '42501') return 'Tu cuenta no tiene permiso para modificar.';
    return 'No se pudo guardar: ' + (error?.message || 'error desconocido');
}

// Valores vacíos del formulario fijo (FECHA null = la fecha que se está mirando)
const panelVacio = (columnas) => ({ ...Object.fromEntries(columnas.map(c => [c, ''])), FECHA: null, QUIROFANO: '' });

// Lista del día con formulario fijo a la izquierda (en pantallas angostas va arriba)
const CSS_PANEL = `
.lista-con-panel { display: grid; grid-template-columns: 340px minmax(0, 1fr); gap: 20px; align-items: start; }
.panel-agregar {
    position: sticky; top: 10px; max-height: calc(100vh - 20px); overflow-y: auto;
    background: white; border: 2px solid #0ea5e9; border-radius: 12px; padding: 14px;
    box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08);
}
.panel-agregar summary { font-weight: 800; font-size: 1.1rem; cursor: pointer; list-style: none; }
.panel-agregar summary::-webkit-details-marker { display: none; }
@media (max-width: 1000px) {
    .lista-con-panel { grid-template-columns: 1fr; }
    .panel-agregar { position: static; max-height: none; }
}
`;

// Columnas con formato propio en la tabla
function estiloCelda(col) {
    if (col === 'EQUIPO')    return { fontSize: '0.8rem', lineHeight: 1.3, minWidth: '160px' };
    if (col === 'ARCO EN C') return { textAlign: 'center', fontWeight: 800, color: '#b45309' };
    return undefined;
}

// Al imprimir solo se ve la lista por quirófano, en A4 apaisado
const CSS_IMPRESION = `
.impresion-dia { display: none; }
@media print {
    @page { size: A4 landscape; margin: 10mm; }
    body * { visibility: hidden !important; }
    .impresion-dia, .impresion-dia * { visibility: visible !important; }
    .impresion-dia {
        display: block !important; position: absolute; left: 0; top: 0; width: 100%;
        background: white; color: black; font-family: Arial, sans-serif; font-size: 10pt;
    }
    .impresion-dia h1 { font-size: 15pt; margin: 0; }
    .impresion-dia .impresion-fecha { margin: 2px 0 10px; text-transform: capitalize; }
    .impresion-dia section { break-inside: avoid; margin-bottom: 12px; }
    .impresion-dia h2 { font-size: 12pt; margin: 0 0 4px; padding: 4px 6px; background: #e2e8f0 !important;
        -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .impresion-dia h2 span { font-weight: normal; }
    .impresion-dia table { width: 100%; border-collapse: collapse; }
    .impresion-dia th, .impresion-dia td { border: 1px solid #94a3b8; padding: 3px 5px; text-align: left; vertical-align: top; }
    .impresion-dia th { font-size: 8.5pt; }
}
`;

const btn = (bg) => ({
    padding: '8px 16px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: bg,
    color: 'white', border: 'none', borderRadius: '8px'
});

// Dos modos:
//  · con `quirofano`: la lista de ese quirófano (pantalla INGRESO)
//  · sin `quirofano`: la "Lista del día" de toda la institución, agrupada por quirófano,
//    con una sección "Sin quirófano" arriba para los que falta asignar
function ReceptionView({ institucion, ui, quirofano, quirofanos, rows, puedeEditar, puedeOperar, fecha, setFecha, recargar, encabezado, onEntrarQuirofano }) {
    const modoDia = !quirofano;
    const [searchTerm,     setSearchTerm]     = useState('');
    const [hideCompleted,  setHideCompleted]  = useState(true);
    const [pendingPatient, setPendingPatient] = useState(null);   // modal "hay una cirugía en curso"
    const [form,           setForm]           = useState(null);   // { id?, valores }
    const [preview,        setPreview]        = useState(null);   // { rows, origen } pegado o Excel
    const [toast,          setToast]          = useState(null);
    const [panel,          setPanel]          = useState(() => panelVacio(ui.formulario));   // formulario fijo
    const [panelKey,       setPanelKey]       = useState(0);
    const toastTimer = useRef(null);

    const columnasForm = ui.formulario;
    const nombreQ      = (n) => quirofanos.find(q => q.numero === n)?.nombre || `Quirófano ${n}`;
    // En el formulario, las casillas valen 'SI' o ''; el resto, el texto que se muestra
    const valorForm    = (r, c) => CASILLAS.includes(c) ? (r.extra?.[c] ? 'SI' : '') : String(valor(r, c));
    const tieneOjo     = ui.columnas.includes('OJO');

    // ── Aviso de resultado (✓ guardado / ⚠ error) ─────────────────────────────
    const showToast = (type, text) => {
        clearTimeout(toastTimer.current);
        setToast({ type, text });
        toastTimer.current = setTimeout(() => setToast(null), type === 'ok' ? 2500 : 7000);
    };
    useEffect(() => () => clearTimeout(toastTimer.current), []);

    // Ejecuta una operación de Supabase, avisa el resultado y refresca. Devuelve true si anduvo.
    const run = async (okText, operacion) => {
        let error;
        try { ({ error } = await operacion()); } catch (e) { error = e; }
        recargar();
        if (error) { showToast('error', mensajeError(error)); return false; }
        if (okText) showToast('ok', okText);
        return true;
    };

    // ── Filtrar lista ─────────────────────────────────────────────────────────
    let lista = rows;
    if (hideCompleted) lista = lista.filter(r => r.estado !== 'finalizada');
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        lista = lista.filter(r => [r.nombre, r.dni, r.cirugia, r.cirujano, r.diagnostico, ...Object.values(r.extra || {})]
            .some(v => String(v ?? '').toLowerCase().includes(term)));
    }
    const pendientes = rows.filter(r => r.estado === 'pendiente').length;
    const ambito     = modoDia ? institucion.nombre : quirofano.nombre;

    // Quirófano válido para esta institución, o null (= sin asignar)
    const quirofanoValido = (n) => (n >= 1 && n <= institucion.quirofanos ? n : null);
    const asignado        = (r) => quirofanoValido(r.quirofano) !== null;
    const activaDe        = (n) => rows.find(r => r.estado === 'en_curso' && r.quirofano === n) || null;

    // Las consultas de borrado se acotan al quirófano en modo quirófano, o a todo el día en modo lista
    const delAmbito = (query) => {
        query = query.eq('institucion_id', institucion.id).eq('fecha', fecha);
        return modoDia ? query : query.eq('quirofano', quirofano.numero);
    };

    // ── Vaciar el día ─────────────────────────────────────────────────────────
    const handleVaciar = () => {
        if (rows.length === 0) return;
        if (!window.confirm(
            `⚠️ VACIAR LISTA DEL DÍA\n\n${ambito} — ${fechaLarga(fecha)}\n\n` +
            `Se van a borrar las ${rows.length} cirugías de este día (pendientes, en curso y finalizadas).\n\n¿Confirmar?`
        )) return;
        run('Lista del día vaciada', () => delAmbito(supabase.from('qx_cirugias').delete()));
    };

    // ── Cargar Excel → vista previa ───────────────────────────────────────────
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const pacientes = parseExcelSimple(evt.target.result);
                if (pacientes.length === 0) return alert('El archivo no tiene filas con datos.');
                setPreview({ rows: pacientes, origen: file.name });
            } catch (err) {
                alert('Error al leer el archivo Excel: ' + err.message);
            }
            e.target.value = ''; // permitir subir el mismo archivo de nuevo
        };
        reader.readAsArrayBuffer(file);
    };

    // ── Pegar desde Excel → vista previa ──────────────────────────────────────
    const handlePaste = (e) => {
        e.preventDefault();
        const pacientes = parsePastedRows(e.clipboardData.getData('text'), ui.pegado);
        if (pacientes.length === 0) {
            alert('No se detectaron filas. Copiá las celdas en Excel (Ctrl+C) y pegalas acá (Ctrl+V).');
            return;
        }
        setPreview({ rows: pacientes, origen: 'pegado' });
    };

    const previewRows    = preview?.rows || [];
    const previewValidas = previewRows.filter(p => String(p['NOMBRE Y APELLIDO'] ?? '').trim());
    const previewColumns = [...new Set([...ui.pegado, ...previewRows.flatMap(Object.keys)])];

    const confirmarPreview = async (modo) => {
        if (previewValidas.length === 0) return;
        const base  = modo === 'reemplazar' ? 0 : Math.max(0, ...rows.map(r => r.orden + 1));
        const filas = previewValidas.map((p, i) => {
            const fila = aFila(p, { institucion_id: institucion.id, fecha, quirofano: quirofano?.numero ?? null, quirofanos });
            return { ...fila, quirofano: quirofanoValido(fila.quirofano), orden: base + i };
        });
        const sinQ    = filas.filter(f => f.quirofano === null).length;
        const enOtros = modoDia ? 0 : filas.filter(f => f.quirofano !== quirofano.numero).length;

        if (modo === 'reemplazar' && pendientes > 0 && !window.confirm(
            `Esto reemplaza los ${pendientes} pacientes pendientes de ${ambito} por los ${filas.length} nuevos.\n\n¿Confirmar?`
        )) return;

        const detalle = [
            enOtros && `${enOtros} en otros quirófanos`,
            sinQ    && `${sinQ} sin quirófano`
        ].filter(Boolean).join(', ');

        const ok = await run(
            `${filas.length} pacientes cargados` + (detalle ? ` (${detalle})` : ''),
            async () => {
                // Primero insertar y recién después borrar los viejos: si falla, no se pierde nada
                const ins = await supabase.from('qx_cirugias').insert(filas).select('id');
                if (ins.error || modo !== 'reemplazar') return ins;
                return delAmbito(supabase.from('qx_cirugias').delete())
                    .eq('estado', 'pendiente')
                    .not('id', 'in', `(${ins.data.map(r => r.id).join(',')})`);
            }
        );
        if (ok) { setSearchTerm(''); setPreview(null); }
    };

    // ── Agregar / editar una cirugía ──────────────────────────────────────────
    const abrirNuevo = () => setForm({
        valores: { ...Object.fromEntries(columnasForm.map(c => [c, ''])), FECHA: fecha, QUIROFANO: quirofano ? String(quirofano.numero) : '' }
    });

    const abrirEditar = (r) => setForm({
        id: r.id,
        valores: { ...Object.fromEntries(columnasForm.map(c => [c, valorForm(r, c)])), FECHA: r.fecha, QUIROFANO: String(r.quirofano ?? '') }
    });

    // Guarda una cirugía nueva (sin id) o los cambios de una existente. Devuelve true si anduvo.
    const guardarValores = async (valores, id) => {
        const { FECHA, QUIROFANO, ...campos } = valores;
        if (!String(campos['NOMBRE Y APELLIDO'] || '').trim()) {
            alert('El nombre y apellido es obligatorio.');
            return false;
        }

        const fila = aFila({ ...campos, QUIROFANO }, {
            institucion_id: institucion.id, fecha: FECHA, quirofano: null, quirofanos, detectarArco: false
        });
        fila.quirofano = quirofanoValido(fila.quirofano);
        let ok;
        if (id) {
            // Al editar, un campo vacío tiene que borrar el valor anterior
            const original = rows.find(r => r.id === id);
            const cambios  = { fecha: FECHA, quirofano: fila.quirofano, extra: { ...(original?.extra || {}) } };
            columnasForm.forEach(col => {
                const campo = BASE_FIELDS[col];
                if (campo && campo !== 'quirofano') cambios[campo] = fila[campo] ?? null;
                else if (!campo) delete cambios.extra[col];
            });
            Object.assign(cambios.extra, fila.extra);
            cambios.nombre = fila.nombre;
            ok = await run('Cambios guardados', () => supabase.from('qx_cirugias').update(cambios).eq('id', id));
        } else {
            const orden = Math.max(0, ...rows.map(r => r.orden + 1));
            ok = await run(`${fila.nombre} agregado/a` + (fila.quirofano ? ` en ${nombreQ(fila.quirofano)}` : ' (sin quirófano)'),
                () => supabase.from('qx_cirugias').insert({ ...fila, orden }));
        }
        return ok;
    };

    // Modal del lápiz / agregar: si falla, queda abierto para no perder lo escrito
    const guardarForm = async (e) => {
        e.preventDefault();
        if (await guardarValores(form.valores, form.id)) setForm(null);
    };

    // ── Formulario fijo "Agregar paciente" (Lista del día) ────────────────────
    // FECHA en null = usar la fecha que se está mirando en la lista
    const conPanel = modoDia && puedeEditar;
    const valoresPanel = { ...panel, FECHA: panel.FECHA ?? fecha };
    const guardarPanel = async (e) => {
        e.preventDefault();
        if (await guardarValores(valoresPanel, null)) {
            setPanel(panelVacio(columnasForm));
            setPanelKey(k => k + 1);   // vuelve a montar el formulario: el foco queda en el nombre
        }
    };

    const borrar = async () => {
        if (!window.confirm(`¿Borrar la cirugía de ${form.valores['NOMBRE Y APELLIDO']}?`)) return;
        if (await run('Cirugía borrada', () => supabase.from('qx_cirugias').delete().eq('id', form.id))) setForm(null);
    };

    // ── Cambio de OJO en la tabla (Privado) ───────────────────────────────────
    const handleOjoChange = (e, r) => {
        e.stopPropagation();
        run(null, () => supabase.from('qx_cirugias').update({ extra: { ...r.extra, OJO: e.target.value } }).eq('id', r.id));
    };

    // Asignar quirófano rápido (sección "Sin quirófano")
    const asignarQuirofano = (r, n) => {
        if (!n) return;
        run(`${r.nombre} → ${nombreQ(Number(n))}`, () => supabase.from('qx_cirugias').update({ quirofano: Number(n) }).eq('id', r.id));
    };

    // ── Proyectar ─────────────────────────────────────────────────────────────
    // Cada paciente va a la pantalla de SU quirófano
    const projectPatient = (r) => {
        if (!asignado(r)) {
            showToast('error', puedeEditar ? `Asigná un quirófano a ${r.nombre} antes de proyectarlo.` : `${r.nombre} no tiene quirófano asignado: pedile a quien carga la lista que lo asigne.`);
            if (puedeEditar) abrirEditar(r);
            return;
        }
        const activa = activaDe(r.quirofano);
        if (activa && activa.id !== r.id) setPendingPatient(r);
        else sendToScreen(r);
    };

    const sendToScreen = (r) => {
        setPendingPatient(null);
        run(`En pantalla de ${nombreQ(r.quirofano)}: ${r.nombre}`, () => supabase.rpc('qx_proyectar', { p_id: r.id }));
    };

    const handleFinalizeCurrent = () => {
        const n = pendingPatient.quirofano;
        setPendingPatient(null);
        run('Cirugía finalizada', () => supabase.rpc('qx_finalizar', { p_institucion: institucion.id, p_quirofano: n }));
    };

    // ── Campos del formulario (lápiz y formulario fijo) ───────────────────────
    const camposFormulario = (valores, setCampo, { autoFocusNombre = false, anchoMin = 160 } = {}) => (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${anchoMin}px, 1fr))`, gap: '12px' }}>
            {['FECHA', 'QUIROFANO', ...columnasForm].map(field => {
                const set   = (v) => setCampo(field, v);
                const val   = valores[field] ?? '';
                const largo = ['NOMBRE Y APELLIDO', 'DIAGNOSTICO', 'CIRUGIA', 'OBSERVACIONES', 'APP'].includes(field);
                const estilo = { padding: '8px', fontSize: '16px', minWidth: 0 };
                let control;
                if (field === 'FECHA') {
                    control = <input type="date" required value={val} onChange={e => set(e.target.value)} style={estilo} />;
                } else if (field === 'QUIROFANO') {
                    control = (
                        <select value={val} onChange={e => set(e.target.value)} style={estilo}>
                            <option value="">Sin asignar</option>
                            {quirofanos.map(q => <option key={q.numero} value={String(q.numero)}>{q.nombre}</option>)}
                        </select>
                    );
                } else if (CASILLAS.includes(field)) {
                    // Casilla sí/no: se dibuja en línea, ocupando todo el ancho
                    return (
                        <label key={field} style={{
                            gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '10px',
                            fontWeight: 'bold', fontSize: '0.95rem', cursor: 'pointer',
                            background: val ? '#fef3c7' : '#f1f5f9', padding: '10px 12px', borderRadius: '8px',
                            border: `1px solid ${val ? '#f59e0b' : '#cbd5e1'}`
                        }}>
                            <input type="checkbox" checked={!!val} onChange={e => set(e.target.checked ? 'SI' : '')}
                                   style={{ width: '22px', height: '22px' }} />
                            Necesita {label(field)}
                        </label>
                    );
                } else if (field === 'OJO') {
                    control = (
                        <select value={String(val).toUpperCase()} onChange={e => set(e.target.value)} style={estilo}>
                            <option value="">ELEGIR</option>
                            <option value="DERECHO">DERECHO</option>
                            <option value="IZQUIERDO">IZQUIERDO</option>
                        </select>
                    );
                } else {
                    control = <input type={field === 'HORA' ? 'time' : 'text'} value={val}
                                     onChange={e => set(e.target.value)} style={estilo}
                                     autoFocus={autoFocusNombre && field === 'NOMBRE Y APELLIDO'} />;
                }
                const campo = (
                    <label key={field} style={{
                        display: 'flex', flexDirection: 'column', gap: '4px', fontWeight: 'bold', fontSize: '0.85rem',
                        gridColumn: largo ? '1 / -1' : undefined, minWidth: 0
                    }}>
                        {label(field)}{field === 'NOMBRE Y APELLIDO' && ' *'}
                        {control}
                    </label>
                );
                // Título antes del primer integrante del equipo
                if (field === EQUIPO[0]) {
                    return (
                        <React.Fragment key={field}>
                            <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #e2e8f0', paddingTop: '10px',
                                          fontWeight: 800, color: '#0f172a' }}>
                                👥 Equipo quirúrgico
                            </div>
                            {campo}
                        </React.Fragment>
                    );
                }
                return campo;
            })}
        </div>
    );

    // Formulario fijo de la Lista del día (plegable en pantallas angostas)
    const panelAgregar = conPanel && (
        <aside className="panel-agregar">
            <style>{CSS_PANEL}</style>
            <details open={typeof window === 'undefined' || window.innerWidth > 1000}>
                <summary>➕ Agregar paciente</summary>
                <form key={panelKey} onSubmit={guardarPanel} style={{ marginTop: '12px' }}>
                    {camposFormulario(valoresPanel,
                        (campo, v) => setPanel(p => ({ ...p, [campo]: v })),
                        { autoFocusNombre: panelKey > 0, anchoMin: 130 })}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                        <button type="submit" style={{ ...btn('#22c55e'), flex: 2, padding: '12px', fontSize: '1rem' }}>GUARDAR</button>
                        <button type="button" onClick={() => setPanel(panelVacio(columnasForm))} className="btn-cancel"
                                style={{ flex: 1, padding: '12px', borderRadius: '8px', cursor: 'pointer' }}>LIMPIAR</button>
                    </div>
                </form>
            </details>
        </aside>
    );

    // ── Tabla ─────────────────────────────────────────────────────────────────
    const renderTabla = (filas) => (
        <table>
            <thead>
                <tr>
                    <th>Acción</th>
                    {ui.columnas.map(c => <th key={c}>{label(c)}</th>)}
                    {puedeEditar && <th></th>}
                </tr>
            </thead>
            <tbody>
                {filas.map(r => {
                    const isActive  = r.estado === 'en_curso';
                    const isDone    = r.estado === 'finalizada';
                    const sinQ      = !asignado(r);
                    const clickable = puedeOperar && !isDone && !sinQ;
                    return (
                        <tr key={r.id} onClick={() => clickable && projectPatient(r)}
                            style={{
                                backgroundColor: isActive ? '#e0f2fe' : (isDone ? '#f0fdf4' : 'transparent'),
                                borderLeft: isActive ? '4px solid #0ea5e9' : (isDone ? '4px solid #22c55e' : 'none'),
                                cursor: clickable ? 'pointer' : 'default',
                                opacity: isDone ? 0.7 : 1
                            }}>
                            <td onClick={e => sinQ && e.stopPropagation()}>
                                {isDone ? (
                                    <span style={{ color: '#22c55e', fontWeight: 'bold' }}>✅ FINALIZADO</span>
                                ) : isActive ? (
                                    <span style={{ color: '#0ea5e9', fontWeight: 'bold' }}>● EN CURSO</span>
                                ) : sinQ && puedeEditar ? (
                                    <select value="" onChange={e => asignarQuirofano(r, e.target.value)}
                                            style={{ padding: '5px', fontWeight: 700, borderColor: '#d97706' }}>
                                        <option value="">Asignar Q…</option>
                                        {quirofanos.map(q => <option key={q.numero} value={q.numero}>{q.corto}</option>)}
                                    </select>
                                ) : puedeOperar ? (
                                    <button onClick={e => { e.stopPropagation(); projectPatient(r); }}>PROYECTAR</button>
                                ) : (
                                    <span style={{ color: '#64748b' }}>{sinQ ? 'Sin quirófano' : 'Pendiente'}</span>
                                )}
                            </td>
                            {ui.columnas.map(c => (
                                c === 'OJO' && tieneOjo && puedeEditar ? (
                                    <td key={c} onClick={e => e.stopPropagation()}>
                                        <select value={String(valor(r, 'OJO')).toUpperCase().trim()}
                                                onChange={e => handleOjoChange(e, r)} style={{ padding: '5px' }} disabled={isDone}>
                                            <option value="">ELEGIR</option>
                                            <option value="DERECHO">DERECHO</option>
                                            <option value="IZQUIERDO">IZQUIERDO</option>
                                        </select>
                                    </td>
                                ) : (
                                    <td key={c} style={estiloCelda(c)}>{valor(r, c)}</td>
                                )
                            ))}
                            {puedeEditar && (
                                <td onClick={e => e.stopPropagation()}>
                                    <button onClick={() => abrirEditar(r)} title="Editar">✏️</button>
                                </td>
                            )}
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );

    // Bloque con título de color (secciones de la Lista del día)
    const seccion = ({ key, color, titulo, info, accion, children }) => (
        <section key={key} style={{ marginBottom: '1.25rem' }}>
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
                backgroundColor: color, color: 'white', padding: '8px 14px', borderRadius: '10px 10px 0 0', fontWeight: 800
            }}>
                <span>{titulo}{info && <span style={{ fontWeight: 600, opacity: 0.9, marginLeft: '10px', fontSize: '0.9rem' }}>{info}</span>}</span>
                {accion}
            </div>
            <div className="table-container" style={{ marginTop: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
                {children}
            </div>
        </section>
    );

    const sinQuirofano = lista.filter(r => !asignado(r));

    // ── Imprimir / guardar como PDF (solo las listas repartidas por quirófano) ─
    const sinAsignarDia = rows.filter(r => !asignado(r)).length;
    const imprimir = () => {
        if (sinAsignarDia > 0 && !window.confirm(
            `Hay ${sinAsignarDia} paciente(s) sin quirófano asignado: no van a salir en la impresión.\n\n¿Imprimir igual?`
        )) return;
        window.print();
    };

    const impresion = modoDia && (
        <div className="impresion-dia">
            <style>{CSS_IMPRESION}</style>
            <h1>Programación de quirófano — {institucion.nombre}</h1>
            <p className="impresion-fecha">{fechaLarga(fecha)}</p>
            {quirofanos.map(q => {
                const filasQ = rows.filter(r => r.quirofano === q.numero);
                if (filasQ.length === 0) return null;
                return (
                    <section key={q.numero}>
                        <h2>{q.nombre.toUpperCase()} <span>({filasQ.length})</span></h2>
                        <table>
                            <thead><tr>{ui.columnas.map(c => <th key={c}>{label(c)}</th>)}</tr></thead>
                            <tbody>
                                {filasQ.map(r => (
                                    <tr key={r.id}>{ui.columnas.map(c => <td key={c} style={estiloCelda(c)}>{valor(r, c)}</td>)}</tr>
                                ))}
                            </tbody>
                        </table>
                    </section>
                );
            })}
            {quirofanos.every(q => !rows.some(r => r.quirofano === q.numero)) && <p>No hay pacientes asignados a quirófanos este día.</p>}
        </div>
    );

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="reception-container" style={conPanel ? { maxWidth: '1900px' } : undefined}>
            {impresion}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '1rem' }}>
                {encabezado || <h1 style={{ margin: 0 }}>{modoDia ? `Lista del día — ${institucion.nombre}` : `Recepción — ${quirofano.nombre}`}</h1>}
                {puedeEditar && rows.length > 0 && (
                    <button onClick={handleVaciar} style={{ ...btn('#dc2626'), padding: '10px 20px', fontSize: '0.95rem' }}>
                        🗑️ VACIAR LISTA DEL DÍA
                    </button>
                )}
            </div>

            <div className={conPanel ? 'lista-con-panel' : undefined}>
            {panelAgregar}
            <div style={{ minWidth: 0 }}>

            <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <SelectorFecha fecha={fecha} setFecha={setFecha} />
                {modoDia && rows.length > 0 && (
                    <button onClick={imprimir} style={btn('#475569')} title="Abre la impresión: elegí 'Guardar como PDF' para obtener el archivo">
                        🖨️ IMPRIMIR / PDF
                    </button>
                )}
            </div>

            {puedeEditar ? (
                <div className="upload-section">
                    <label>
                        <strong>Cargar Lista (Excel): </strong>
                        <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} />
                    </label>
                    {!conPanel && <button onClick={abrirNuevo} style={btn('#0ea5e9')}>➕ AGREGAR PACIENTE</button>}
                    <button onClick={() => setPreview({ rows: [], origen: 'pegado' })} style={btn('#16a34a')}>📋 PEGAR DESDE EXCEL</button>
                    {rows.length > 0 && <span>{pendientes} pendientes · {rows.length} en total</span>}
                </div>
            ) : (
                <div className="upload-section" style={{ color: '#475569' }}>
                    {puedeOperar ? "🎛️ Podés proyectar y finalizar cirugías" : "👁️ Cuenta de solo lectura"} — {pendientes} pendientes · {rows.length} en total
                </div>
            )}

            <div className="search-section" style={{ margin: '20px 0', display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input type="text" placeholder="Buscar paciente (Nombre, DNI, etc…)" value={searchTerm}
                       onChange={e => setSearchTerm(e.target.value)} style={{ padding: '10px', flex: 1, minWidth: '200px', fontSize: '16px' }} />
                <label style={{
                    display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', whiteSpace: 'nowrap',
                    backgroundColor: '#f1f5f9', padding: '10px 15px', borderRadius: '8px', border: '1px solid #cbd5e1'
                }}>
                    <input type="checkbox" checked={hideCompleted} onChange={e => setHideCompleted(e.target.checked)}
                           style={{ width: '20px', height: '20px' }} />
                    <strong>OCULTAR FINALIZADOS</strong>
                </label>
            </div>

            {rows.length === 0 && (
                <p style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                    No hay cirugías cargadas para este día en {ambito}.
                    {puedeEditar && ' Pegá o subí el Excel, o agregá pacientes a mano.'}
                </p>
            )}
            {rows.length > 0 && lista.length === 0 && (
                <p style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>No hay pacientes que coincidan.</p>
            )}

            {modoDia ? (
                <>
                    {sinQuirofano.length > 0 && seccion({
                        key: 'sin-q', color: '#d97706',
                        titulo: `⚠️ SIN QUIRÓFANO (${sinQuirofano.length})`,
                        info: puedeEditar ? 'Asignalo con el selector o el lápiz ✏️' : null,
                        children: renderTabla(sinQuirofano)
                    })}
                    {rows.length > 0 && quirofanos.map(q => {
                        const filasQ = lista.filter(r => r.quirofano === q.numero);
                        const activa = activaDe(q.numero);
                        return seccion({
                            key: q.numero, color: q.color,
                            titulo: q.nombre.toUpperCase(),
                            info: activa ? `● En curso: ${activa.nombre}` : `${filasQ.length} paciente(s)`,
                            accion: (
                                <button onClick={() => onEntrarQuirofano(q)}
                                        style={{ background: 'rgba(0,0,0,0.2)', color: 'white', border: 'none', borderRadius: '8px',
                                                 padding: '4px 12px', fontWeight: 800, cursor: 'pointer' }}>
                                    PANTALLA ›
                                </button>
                            ),
                            children: filasQ.length > 0
                                ? renderTabla(filasQ)
                                : <p style={{ padding: '12px 16px', margin: 0, color: '#64748b' }}>Sin pacientes en este quirófano.</p>
                        });
                    })}
                </>
            ) : (
                lista.length > 0 && <div className="table-container">{renderTabla(lista)}</div>
            )}
            </div>
            </div>

            {/* Aviso de resultado de la última acción */}
            {toast && (
                <div onClick={() => setToast(null)} style={{
                    position: 'fixed', left: '50%', bottom: '90px', transform: 'translateX(-50%)',
                    zIndex: 10001, maxWidth: '90vw', padding: '12px 20px', borderRadius: '10px',
                    fontWeight: 700, color: 'white', cursor: 'pointer', textAlign: 'center',
                    backgroundColor: toast.type === 'ok' ? '#16a34a' : '#dc2626',
                    boxShadow: '0 6px 20px rgba(0,0,0,0.3)'
                }}>
                    {toast.type === 'ok' ? '✓ ' : '⚠️ '}{toast.text}
                </div>
            )}

            {/* Modal — vista previa de pegado o Excel */}
            {preview && (
                <div className="modal-overlay" onClick={() => setPreview(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}
                         style={{ maxWidth: '1100px', width: '95%', maxHeight: '90vh', overflowY: 'auto', textAlign: 'left' }}>
                        <h2 style={{ marginTop: 0, textAlign: 'center' }}>
                            {preview.origen === 'pegado' ? '📋 Pegar desde Excel' : `📄 ${preview.origen}`}
                        </h2>
                        <p style={{ textAlign: 'center', marginTop: 0, color: '#475569' }}>
                            Se cargan para el <strong>{fechaLarga(fecha)}</strong>.{' '}
                            {modoDia
                                ? <>Cada fila va al quirófano de su columna QUIRÓFANO (Q1, Q2…); las que no lo tengan quedan en <strong>Sin quirófano</strong>.</>
                                : <>Van a <strong>{quirofano.nombre}</strong>, salvo las filas que traigan su propio quirófano.</>}
                        </p>

                        {preview.origen === 'pegado' && (
                            <textarea onPaste={handlePaste} value="" onChange={() => {}} autoFocus
                                placeholder={`Seleccioná las filas en Excel, copiá (Ctrl+C) y pegá acá (Ctrl+V).\n\nPodés incluir la fila de encabezados o solo los datos en este orden:\n${ui.pegado.map(label).join(' · ')}`}
                                style={{
                                    width: '100%', minHeight: previewRows.length ? '60px' : '140px',
                                    padding: '12px', fontSize: '15px', boxSizing: 'border-box',
                                    border: '2px dashed #16a34a', borderRadius: '8px', resize: 'vertical'
                                }} />
                        )}

                        {previewRows.length > 0 && (
                            <>
                                <p style={{ margin: '12px 0 8px' }}>
                                    <strong>{previewValidas.length} pacientes detectados.</strong>
                                    {previewRows.length > previewValidas.length && (
                                        <span style={{ color: '#dc2626' }}>
                                            {' '}{previewRows.length - previewValidas.length} fila(s) sin NOMBRE Y APELLIDO se van a omitir (en rojo).
                                        </span>
                                    )}
                                    {' '}Revisá que cada dato esté en su columna.
                                </p>
                                <div style={{ overflowX: 'auto', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
                                    <table style={{ fontSize: '0.85rem' }}>
                                        <thead><tr>{previewColumns.map(c => <th key={c}>{label(c)}</th>)}</tr></thead>
                                        <tbody>
                                            {previewRows.map((p, i) => (
                                                <tr key={i} style={{ backgroundColor: String(p['NOMBRE Y APELLIDO'] ?? '').trim() ? 'transparent' : '#fee2e2' }}>
                                                    {previewColumns.map(c => (
                                                        <td key={c}>{c === 'HORA' ? (parseHora(p[c]) || String(p[c] ?? '')) : String(p[c] ?? '')}</td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}

                        <div style={{ display: 'flex', gap: '12px', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                            {['agregar', 'reemplazar'].map(modo => (
                                <button key={modo} onClick={() => confirmarPreview(modo)} disabled={previewValidas.length === 0}
                                        style={{
                                            ...btn(modo === 'agregar' ? '#22c55e' : '#f59e0b'), flex: 1, padding: '12px', fontSize: '1rem',
                                            cursor: previewValidas.length ? 'pointer' : 'not-allowed', opacity: previewValidas.length ? 1 : 0.5
                                        }}>
                                    {modo === 'agregar' ? 'AGREGAR A LA LISTA' : 'REEMPLAZAR PENDIENTES'}
                                </button>
                            ))}
                            <button onClick={() => setPreview(null)} className="btn-cancel"
                                    style={{ flex: 1, padding: '12px', fontSize: '1rem', borderRadius: '8px', cursor: 'pointer' }}>
                                CANCELAR
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal — agregar / editar cirugía */}
            {form && (
                <div className="modal-overlay" onClick={() => setForm(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}
                         style={{ maxWidth: '640px', width: '95%', maxHeight: '90vh', overflowY: 'auto', textAlign: 'left' }}>
                        <h2 style={{ marginTop: 0, textAlign: 'center' }}>{form.id ? '✏️ Editar cirugía' : '➕ Agregar paciente'}</h2>
                        <form onSubmit={guardarForm}>
                            {camposFormulario(
                                form.valores,
                                (campo, v) => setForm(f => ({ ...f, valores: { ...f.valores, [campo]: v } })),
                                { autoFocusNombre: !form.id, anchoMin: 160 }
                            )}
                            <div style={{ display: 'flex', gap: '12px', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                                <button type="submit" style={{ ...btn('#22c55e'), flex: 1, padding: '12px', fontSize: '1rem' }}>GUARDAR</button>
                                {form.id && (
                                    <button type="button" onClick={borrar} style={{ ...btn('#dc2626'), flex: 1, padding: '12px', fontSize: '1rem' }}>
                                        BORRAR
                                    </button>
                                )}
                                <button type="button" onClick={() => setForm(null)} className="btn-cancel"
                                        style={{ flex: 1, padding: '12px', fontSize: '1rem', borderRadius: '8px', cursor: 'pointer' }}>
                                    CANCELAR
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal — paciente en curso */}
            {pendingPatient && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>⚠️ Cirugía en curso</h2>
                        <p>En la pantalla de {nombreQ(pendingPatient.quirofano)} está <strong>{activaDe(pendingPatient.quirofano)?.nombre}</strong>.</p>
                        <p>¿Qué desea hacer?</p>
                        <div className="modal-actions">
                            <button className="btn-finalize" onClick={handleFinalizeCurrent}>
                                FINALIZAR ACTUAL
                                <small>(Borrar pantalla)</small>
                            </button>
                            <button className="btn-change" onClick={() => sendToScreen(pendingPatient)}>
                                CAMBIAR PACIENTE
                                <small>(Proyectar a {pendingPatient.nombre})</small>
                            </button>
                            <button className="btn-cancel" onClick={() => setPendingPatient(null)}>CANCELAR</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ReceptionView;
