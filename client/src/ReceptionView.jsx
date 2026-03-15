import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

function ReceptionView({ socket, patients, activePatient, history }) {
    const [filteredPatients, setFilteredPatients] = useState([]);
    const [searchTerm,       setSearchTerm]       = useState('');
    const [hideCompleted,    setHideCompleted]     = useState(true);
    const [showModal,        setShowModal]         = useState(false);
    const [pendingPatient,   setPendingPatient]    = useState(null);

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
            <h1>Panel de Control — Recepción</h1>

            <div className="upload-section">
                <label>
                    <strong>Cargar Lista (Excel): </strong>
                    <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} />
                </label>
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
