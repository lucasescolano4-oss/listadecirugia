import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

const PATIENT_FIELDS = ['HORA', 'NOMBRE Y APELLIDO', 'OJO', 'LIO', 'EDAD', 'DNI', 'OS', 'N°', 'CATA', 'DIL', 'APP'];
const EMPTY_PATIENT  = Object.fromEntries(PATIENT_FIELDS.map(f => [f, '']));

// Variantes de encabezado que se aceptan al pegar (se comparan en mayúsculas y sin espacios extra)
const HEADER_ALIASES = {
    'NOMBRE': 'NOMBRE Y APELLIDO', 'APELLIDO Y NOMBRE': 'NOMBRE Y APELLIDO', 'PACIENTE': 'NOMBRE Y APELLIDO',
    'Nº': 'N°', 'NO': 'N°', 'NRO': 'N°', 'N': 'N°', 'NUMERO': 'N°', 'NÚMERO': 'N°',
    'OBRA SOCIAL': 'OS'
};

function normalizeHeader(h) {
    const key = String(h).trim().toUpperCase().replace(/\s+/g, ' ');
    return HEADER_ALIASES[key] || key;
}

// Convierte el texto copiado de Excel (filas separadas por salto de línea, celdas por tab)
// en pacientes. Si la primera fila tiene encabezados se usan; si no, se asume el orden estándar.
function parsePastedRows(text) {
    const rows = text
        .split(/\r?\n/)
        .map(line => line.split('\t'))
        .filter(cells => cells.some(c => c.trim() !== ''));
    if (rows.length === 0) return [];

    const firstRow = rows[0].map(normalizeHeader);
    const hasHeader = firstRow.some(h => ['NOMBRE Y APELLIDO', 'HORA', 'DNI'].includes(h));
    const headers = hasHeader ? firstRow : PATIENT_FIELDS;
    const dataRows = hasHeader ? rows.slice(1) : rows;

    return dataRows.map(cells => {
        const patient = {};
        headers.forEach((h, i) => {
            const val = (cells[i] ?? '').trim();
            if (h && val) patient[h] = val;
        });
        return patient;
    });
}

function ReceptionView({ socket, patients, activePatient, history, quirofano }) {
    const [filteredPatients, setFilteredPatients] = useState([]);
    const [searchTerm,       setSearchTerm]       = useState('');
    const [hideCompleted,    setHideCompleted]     = useState(true);
    const [showModal,        setShowModal]         = useState(false);
    const [pendingPatient,   setPendingPatient]    = useState(null);
    const [showAddForm,      setShowAddForm]       = useState(false);
    const [newPatient,       setNewPatient]        = useState(EMPTY_PATIENT);
    const [showPaste,        setShowPaste]         = useState(false);
    const [pastedRows,       setPastedRows]        = useState([]);

    const surgeryHistory = history || [];

    // ── Filtrar lista ─────────────────────────────────────────────────────────
    useEffect(() => {
        let list = patients || [];

        if (hideCompleted) {
            // Ocultar solo si hay un _id coincidente (evita falsos positivos)
            const completedIds = new Set(
                surgeryHistory
                    .filter(h => h._id)
                    .map(h => h._id)
            );
            // Fallback: nombre + DNI cuando no hay _id en el historial
            list = list.filter(p => {
                if (p._id && completedIds.has(p._id)) return false;
                return !surgeryHistory.some(h =>
                    !h._id &&
                    h['NOMBRE Y APELLIDO'] === p['NOMBRE Y APELLIDO'] &&
                    h['DNI'] && h['DNI'] === p['DNI']
                );
            });
        }

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            list = list.filter(p =>
                Object.values(p).some(val =>
                    String(val).toLowerCase().includes(term)
                )
            );
        }

        setFilteredPatients(list);
    }, [patients, searchTerm, hideCompleted, surgeryHistory]);

    // ── Nueva Jornada ─────────────────────────────────────────────────────────
    const handleResetAll = () => {
        if (!window.confirm(
            '⚠️ NUEVA JORNADA\n\nEsto va a borrar:\n• La lista de pacientes\n• El paciente en pantalla\n• Todo el historial\n\n¿Confirmar?'
        )) return;
        // Limpiar backup de localStorage para que no se restaure tras el reset
        try {
            if (quirofano?.id) localStorage.removeItem(`surgery_patients_${quirofano.id}`);
        } catch (e) { /* */ }
        socket.emit('reset_all');
    };

    // ── Cargar Excel ──────────────────────────────────────────────────────────
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const wb = XLSX.read(evt.target.result, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                let data = XLSX.utils.sheet_to_json(ws);

                // Normalizar claves (quitar espacios extra)
                data = data.map((row, index) => {
                    const newRow = { _id: `row-${index}-${Date.now()}` };
                    Object.keys(row).forEach(key => {
                        newRow[key.trim()] = row[key];
                    });
                    return newRow;
                });

                setSearchTerm('');
                socket.emit('upload_patients', data);
                // Limpiar el input para permitir subir el mismo archivo de nuevo
                e.target.value = '';
            } catch (err) {
                alert('Error al leer el archivo Excel: ' + err.message);
            }
        };
        reader.readAsBinaryString(file);
    };

    // ── Agregar paciente manual ───────────────────────────────────────────────
    const openAddForm = () => {
        setNewPatient(EMPTY_PATIENT);
        setShowAddForm(true);
    };

    const handleAddPatient = (e) => {
        e.preventDefault();
        const nombre = newPatient['NOMBRE Y APELLIDO'].trim();
        if (!nombre) {
            alert('El nombre y apellido es obligatorio.');
            return;
        }
        const patient = {};
        PATIENT_FIELDS.forEach(f => {
            const val = String(newPatient[f]).trim();
            if (val) patient[f] = val;
        });
        socket.emit('add_patient', patient);
        setShowAddForm(false);
    };

    // ── Pegar filas desde Excel ───────────────────────────────────────────────
    const openPaste = () => {
        setPastedRows([]);
        setShowPaste(true);
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const rows = parsePastedRows(e.clipboardData.getData('text'));
        if (rows.length === 0) {
            alert('No se detectaron filas. Copiá las celdas en Excel (Ctrl+C) y pegalas acá (Ctrl+V).');
            return;
        }
        setPastedRows(rows);
    };

    const validPasted   = pastedRows.filter(p => p['NOMBRE Y APELLIDO']);
    const skippedPasted = pastedRows.length - validPasted.length;

    const confirmPaste = (mode) => {
        if (validPasted.length === 0) return;
        if (mode === 'replace') {
            if (patients.length > 0 && !window.confirm(
                `Esto reemplaza los ${patients.length} pacientes actuales por los ${validPasted.length} pegados.\n\n¿Confirmar?`
            )) return;
            setSearchTerm('');
            socket.emit('upload_patients', validPasted.map((p, i) => ({ ...p, _id: `paste-${i}-${Date.now()}` })));
        } else {
            socket.emit('add_patient', validPasted);
        }
        setShowPaste(false);
        setPastedRows([]);
    };

    // Columnas de la vista previa: las estándar primero, después cualquier extra que venga en el pegado
    const previewColumns = [
        ...PATIENT_FIELDS,
        ...[...new Set(pastedRows.flatMap(Object.keys))].filter(k => !PATIENT_FIELDS.includes(k))
    ];

    // ── Cambio de OJO en la tabla ─────────────────────────────────────────────
    const handleOjoChange = (e, patientId) => {
        e.stopPropagation();
        const patientToUpdate = patients.find(p => p._id === patientId);
        if (patientToUpdate) {
            socket.emit('update_patient_in_list', { ...patientToUpdate, OJO: e.target.value });
        }
    };

    // ── Proyectar paciente ────────────────────────────────────────────────────
    const projectPatient = (patient) => {
        if (activePatient && activePatient._id !== patient._id) {
            setPendingPatient(patient);
            setShowModal(true);
        } else {
            sendToScreen(patient);
        }
    };

    const sendToScreen = (patient) => {
        socket.emit('update_patient', patient);
        setShowModal(false);
        setPendingPatient(null);
    };

    const handleFinalizeCurrent = () => {
        // FIX: antes se emitía clear_patient dos veces — ahora solo una
        socket.emit('clear_patient');
        setShowModal(false);
        setPendingPatient(null);
    };

    const handleChangePatient = () => {
        if (pendingPatient) sendToScreen(pendingPatient);
    };

    const closeModal = () => {
        setShowModal(false);
        setPendingPatient(null);
    };

    // ── Helpers ───────────────────────────────────────────────────────────────
    const isCompleted = (p) => {
        if (p._id) {
            return surgeryHistory.some(h => h._id === p._id);
        }
        return surgeryHistory.some(h =>
            h['NOMBRE Y APELLIDO'] === p['NOMBRE Y APELLIDO'] &&
            h['DNI'] && h['DNI'] === p['DNI']
        );
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="reception-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h1 style={{ margin: 0 }}>Panel de Control — Recepción</h1>
                <button
                    onClick={handleResetAll}
                    style={{
                        padding: '10px 20px',
                        fontSize: '0.95rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        backgroundColor: '#dc2626',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}
                >
                    🗑️ NUEVA JORNADA
                </button>
            </div>

            <div className="upload-section">
                <label>
                    <strong>Cargar Lista (Excel): </strong>
                    <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} />
                </label>
                <button
                    onClick={openAddForm}
                    style={{
                        padding: '8px 16px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        backgroundColor: '#0ea5e9',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px'
                    }}
                >
                    ➕ AGREGAR PACIENTE
                </button>
                <button
                    onClick={openPaste}
                    style={{
                        padding: '8px 16px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        backgroundColor: '#16a34a',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px'
                    }}
                >
                    📋 PEGAR DESDE EXCEL
                </button>
                {patients.length > 0 && (
                    <span>{patients.length} pacientes cargados</span>
                )}
            </div>

            <div className="search-section" style={{ margin: '20px 0', display: 'flex', gap: '20px', alignItems: 'center' }}>
                <input
                    type="text"
                    placeholder="Buscar paciente (Nombre, DNI, etc…)"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{ padding: '10px', flex: 1, fontSize: '16px' }}
                />
                <label style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    cursor: 'pointer', whiteSpace: 'nowrap',
                    backgroundColor: '#f1f5f9', padding: '10px 15px',
                    borderRadius: '8px', border: '1px solid #cbd5e1'
                }}>
                    <input
                        type="checkbox"
                        checked={hideCompleted}
                        onChange={e => setHideCompleted(e.target.checked)}
                        style={{ width: '20px', height: '20px' }}
                    />
                    <strong>OCULTAR FINALIZADOS</strong>
                </label>
            </div>

            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Acción</th>
                            <th>HORA</th>
                            <th>NOMBRE Y APELLIDO</th>
                            <th>OJO</th>
                            <th>LIO</th>
                            <th>EDAD</th>
                            <th>DNI</th>
                            <th>OS</th>
                            <th>N°</th>
                            <th>CATA</th>
                            <th>DIL</th>
                            <th>APP</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredPatients.map((p, index) => {
                            const isActive    = activePatient && activePatient._id === p._id;
                            const isDone      = isCompleted(p);

                            return (
                                <tr
                                    key={p._id || index}
                                    onClick={() => !isDone && projectPatient(p)}
                                    style={{
                                        backgroundColor: isActive ? '#e0f2fe' : (isDone ? '#f0fdf4' : 'transparent'),
                                        borderLeft: isActive ? '4px solid #0ea5e9' : (isDone ? '4px solid #22c55e' : 'none'),
                                        cursor: isDone ? 'default' : 'pointer',
                                        opacity: isDone ? 0.7 : 1
                                    }}
                                >
                                    <td>
                                        {isDone ? (
                                            <span style={{ color: '#22c55e', fontWeight: 'bold' }}>✅ FINALIZADO</span>
                                        ) : (
                                            <button onClick={e => { e.stopPropagation(); projectPatient(p); }}>
                                                PROYECTAR
                                            </button>
                                        )}
                                    </td>
                                    <td>{p['HORA']}</td>
                                    <td>{p['NOMBRE Y APELLIDO']}</td>
                                    <td onClick={e => e.stopPropagation()}>
                                        <select
                                            value={p['OJO'] ? String(p['OJO']).toUpperCase().trim() : ''}
                                            onChange={e => handleOjoChange(e, p._id)}
                                            style={{ padding: '5px' }}
                                            disabled={isDone}
                                        >
                                            <option value="">ELEGIR</option>
                                            <option value="DERECHO">DERECHO</option>
                                            <option value="IZQUIERDO">IZQUIERDO</option>
                                        </select>
                                    </td>
                                    <td>{p['LIO']}</td>
                                    <td>{p['EDAD']}</td>
                                    <td>{p['DNI']}</td>
                                    <td>{p['OS']}</td>
                                    <td>{p['N°']}</td>
                                    <td>{p['CATA']}</td>
                                    <td>{p['DIL']}</td>
                                    <td>{p['APP']}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {patients.length === 0 && (
                    <p style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                        Cargue un archivo Excel para ver la lista.
                    </p>
                )}
                {patients.length > 0 && filteredPatients.length === 0 && (
                    <p style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                        No hay pacientes que coincidan con la búsqueda.
                    </p>
                )}
            </div>

            {/* Modal — pegar filas desde Excel */}
            {showPaste && (
                <div className="modal-overlay" onClick={() => setShowPaste(false)}>
                    <div
                        className="modal-content"
                        onClick={e => e.stopPropagation()}
                        style={{ maxWidth: '1100px', width: '95%', maxHeight: '90vh', overflowY: 'auto', textAlign: 'left' }}
                    >
                        <h2 style={{ marginTop: 0, textAlign: 'center' }}>📋 Pegar desde Excel</h2>

                        <textarea
                            onPaste={handlePaste}
                            value=""
                            onChange={() => {}}
                            autoFocus
                            placeholder={'Seleccioná las filas en Excel, copiá (Ctrl+C) y pegá acá (Ctrl+V).\n\nPodés incluir la fila de encabezados (HORA, NOMBRE Y APELLIDO, …) o solo los datos en el orden:\nHORA · NOMBRE Y APELLIDO · OJO · LIO · EDAD · DNI · OS · N° · CATA · DIL · APP'}
                            style={{
                                width: '100%', minHeight: pastedRows.length ? '60px' : '140px',
                                padding: '12px', fontSize: '15px', boxSizing: 'border-box',
                                border: '2px dashed #16a34a', borderRadius: '8px', resize: 'vertical'
                            }}
                        />

                        {pastedRows.length > 0 && (
                            <>
                                <p style={{ margin: '12px 0 8px' }}>
                                    <strong>{validPasted.length} pacientes detectados.</strong>
                                    {skippedPasted > 0 && (
                                        <span style={{ color: '#dc2626' }}>
                                            {' '}{skippedPasted} fila(s) sin NOMBRE Y APELLIDO se van a omitir (en rojo).
                                        </span>
                                    )}
                                    {' '}Revisá que cada dato esté en su columna.
                                </p>
                                <div style={{ overflowX: 'auto', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
                                    <table style={{ fontSize: '0.85rem' }}>
                                        <thead>
                                            <tr>{previewColumns.map(c => <th key={c}>{c}</th>)}</tr>
                                        </thead>
                                        <tbody>
                                            {pastedRows.map((p, i) => (
                                                <tr key={i} style={{ backgroundColor: p['NOMBRE Y APELLIDO'] ? 'transparent' : '#fee2e2' }}>
                                                    {previewColumns.map(c => <td key={c}>{p[c] ?? ''}</td>)}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}

                        <div style={{ display: 'flex', gap: '12px', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                            <button
                                onClick={() => confirmPaste('append')}
                                disabled={validPasted.length === 0}
                                style={{
                                    flex: 1, padding: '12px', fontSize: '1rem', fontWeight: 'bold',
                                    backgroundColor: '#22c55e', color: 'white', border: 'none', borderRadius: '8px',
                                    cursor: validPasted.length ? 'pointer' : 'not-allowed', opacity: validPasted.length ? 1 : 0.5
                                }}
                            >
                                AGREGAR A LA LISTA
                            </button>
                            <button
                                onClick={() => confirmPaste('replace')}
                                disabled={validPasted.length === 0}
                                style={{
                                    flex: 1, padding: '12px', fontSize: '1rem', fontWeight: 'bold',
                                    backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '8px',
                                    cursor: validPasted.length ? 'pointer' : 'not-allowed', opacity: validPasted.length ? 1 : 0.5
                                }}
                            >
                                REEMPLAZAR LISTA
                            </button>
                            <button
                                onClick={() => setShowPaste(false)}
                                className="btn-cancel"
                                style={{ flex: 1, padding: '12px', fontSize: '1rem', borderRadius: '8px', cursor: 'pointer' }}
                            >
                                CANCELAR
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal — agregar paciente manual */}
            {showAddForm && (
                <div className="modal-overlay" onClick={() => setShowAddForm(false)}>
                    <div
                        className="modal-content"
                        onClick={e => e.stopPropagation()}
                        style={{ maxWidth: '600px', width: '95%', maxHeight: '90vh', overflowY: 'auto', textAlign: 'left' }}
                    >
                        <h2 style={{ marginTop: 0, textAlign: 'center' }}>➕ Agregar paciente</h2>
                        <form onSubmit={handleAddPatient}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                                {PATIENT_FIELDS.map(field => (
                                    <label
                                        key={field}
                                        style={{
                                            display: 'flex', flexDirection: 'column', gap: '4px',
                                            fontWeight: 'bold', fontSize: '0.85rem',
                                            gridColumn: field === 'NOMBRE Y APELLIDO' ? '1 / -1' : undefined
                                        }}
                                    >
                                        {field}{field === 'NOMBRE Y APELLIDO' && ' *'}
                                        {field === 'OJO' ? (
                                            <select
                                                value={newPatient.OJO}
                                                onChange={e => setNewPatient({ ...newPatient, OJO: e.target.value })}
                                                style={{ padding: '8px', fontSize: '16px' }}
                                            >
                                                <option value="">ELEGIR</option>
                                                <option value="DERECHO">DERECHO</option>
                                                <option value="IZQUIERDO">IZQUIERDO</option>
                                            </select>
                                        ) : (
                                            <input
                                                type={field === 'HORA' ? 'time' : 'text'}
                                                value={newPatient[field]}
                                                onChange={e => setNewPatient({ ...newPatient, [field]: e.target.value })}
                                                autoFocus={field === 'NOMBRE Y APELLIDO'}
                                                style={{ padding: '8px', fontSize: '16px' }}
                                            />
                                        )}
                                    </label>
                                ))}
                            </div>
                            <div style={{ display: 'flex', gap: '12px', marginTop: '1.5rem' }}>
                                <button
                                    type="submit"
                                    style={{
                                        flex: 1, padding: '12px', fontSize: '1rem', fontWeight: 'bold',
                                        backgroundColor: '#22c55e', color: 'white',
                                        border: 'none', borderRadius: '8px', cursor: 'pointer'
                                    }}
                                >
                                    GUARDAR
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowAddForm(false)}
                                    className="btn-cancel"
                                    style={{ flex: 1, padding: '12px', fontSize: '1rem', borderRadius: '8px', cursor: 'pointer' }}
                                >
                                    CANCELAR
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal — paciente en curso */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>⚠️ Cirugía en curso</h2>
                        <p>Hay un paciente proyectado actualmente.</p>
                        <p>¿Qué desea hacer?</p>
                        <div className="modal-actions">
                            <button className="btn-finalize" onClick={handleFinalizeCurrent}>
                                FINALIZAR ACTUAL
                                <small>(Borrar pantalla)</small>
                            </button>
                            <button className="btn-change" onClick={handleChangePatient}>
                                CAMBIAR PACIENTE
                                <small>(Proyectar nuevo)</small>
                            </button>
                            <button className="btn-cancel" onClick={closeModal}>
                                CANCELAR
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ReceptionView;
