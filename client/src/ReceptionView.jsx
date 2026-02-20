
import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

function ReceptionView({ socket, patients, activePatient, history }) {
    const [filteredPatients, setFilteredPatients] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [hideCompleted, setHideCompleted] = useState(true);

    const activePatientOnServer = activePatient;
    const surgeryHistory = history || [];

    // Actualizar filteredPatients cuando cambian patients o el término de búsqueda
    useEffect(() => {
        let list = patients || [];

        // Filtrar completados si el toggle está activo
        if (hideCompleted) {
            list = list.filter(p => !surgeryHistory.some(h =>
                (h['DNI'] && h['DNI'] === p['DNI']) ||
                (h['NOMBRE Y APELLIDO'] === p['NOMBRE Y APELLIDO'] && h['OS'] === p['OS'])
            ));
        }

        if (!searchTerm) {
            setFilteredPatients(list);
        } else {
            const term = searchTerm.toLowerCase();
            const filtered = list.filter(p =>
                Object.values(p).some(val =>
                    String(val).toLowerCase().includes(term)
                )
            );
            setFilteredPatients(filtered);
        }
    }, [patients, searchTerm, hideCompleted, surgeryHistory]);

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            let data = XLSX.utils.sheet_to_json(ws);

            // Normalize keys (trim spaces) to avoid issues with "NOMBRE Y APELLIDO "
            data = data.map((row, index) => {
                const newRow = { _id: `row-${index}-${Date.now()}` };
                Object.keys(row).forEach(key => {
                    const normalizedKey = key.trim();
                    newRow[normalizedKey] = row[key];
                });
                return newRow;
            });

            setSearchTerm(''); // Limpiar búsqueda al cargar nuevo archivo
            socket.emit('upload_patients', data);
        };
        reader.readAsBinaryString(file);
    };

    const handleSearch = (e) => {
        setSearchTerm(e.target.value);
    };

    const handleOjoChange = (e, patientId) => {
        const newValue = e.target.value;
        const patientToUpdate = patients.find(p => p._id === patientId);
        if (patientToUpdate) {
            const updated = { ...patientToUpdate, 'OJO': newValue };
            socket.emit('update_patient_in_list', updated);
        }
    };

    const [showModal, setShowModal] = useState(false);
    const [pendingPatient, setPendingPatient] = useState(null);

    const projectPatient = (patient) => {
        // If active patient exists and different from new
        if (activePatientOnServer && activePatientOnServer._id !== patient._id) {
            setPendingPatient(patient);
            setShowModal(true);
        } else {
            // No active patient, just project
            confirmProject(patient);
        }
    };

    const confirmProject = (patient) => {
        setSelectedPatient(patient);
        socket.emit('update_patient', patient);
        setShowModal(false);
        setPendingPatient(null);
    };

    const handleFinalizeCurrent = () => {
        socket.emit('clear_patient');
        // After clearing, we could auto-project the pending one, or just close.
        // Let's auto-project the pending one as "changing patient" implies that.
        // Wait a tiny bit for server to clear? actually socket logic is fast.
        // But the user might want "Finish" to mean "Stop everything". 
        // Based on request "finalizar O cambiar", "Finalizar" means just stop current. "Cambiar" means stop current + start new.

        // Wait, "finalizar o cambiar". 
        // Finalizar -> Clear current, stay empty? Or proceed?
        // Usually "Finalizar" in this context (override) might mean "Just mark previous as done and stay here".
        // But if I want to project *this* patient, I usually want "Cambiar".

        // Let's implement literally:
        // 1. Finalizar Actual: Clears screen. (PENDING PATIENT IS IGNORED/CANCELLED?)
        //    If I clicked patient B, and modal says "A is active", and I click "Finalize A", do I project B?
        //    User said "Finalizar o cambiar". 
        //    "Finalizar" -> Clean screen. User stays on reception.
        //    "Cambiar" -> Project B.

        socket.emit('clear_patient');
        setShowModal(false);
        setPendingPatient(null);
    };

    const handleChangePatient = () => {
        if (pendingPatient) {
            confirmProject(pendingPatient);
        }
    };

    const closeModal = () => {
        setShowModal(false);
        setPendingPatient(null);
    };

    return (
        <div className="reception-container">
            <h1>Panel de Control - Recepción</h1>

            <div className="upload-section">
                <label>
                    <strong>Cargar Lista (Excel): </strong>
                    <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} />
                </label>
                <div>
                    {patients.length > 0 && <span>{patients.length} pacientes cargados.</span>}
                </div>
            </div>

            <div className="search-section" style={{ margin: '20px 0', display: 'flex', gap: '20px', alignItems: 'center' }}>
                <input
                    type="text"
                    placeholder="Buscar paciente (Nombre, DNI, etc...)"
                    value={searchTerm}
                    onChange={handleSearch}
                    style={{ padding: '10px', flex: 1, fontSize: '16px' }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', whiteSpace: 'nowrap', backgroundColor: '#f1f5f9', padding: '10px 15px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                    <input
                        type="checkbox"
                        checked={hideCompleted}
                        onChange={(e) => setHideCompleted(e.target.checked)}
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
                        </tr>
                    </thead>
                    <tbody>
                        {filteredPatients.map((p, index) => {
                            const isActive = activePatientOnServer && activePatientOnServer._id === p._id;
                            const isCompleted = surgeryHistory.some(h =>
                                (h['DNI'] && h['DNI'] === p['DNI']) ||
                                (h['NOMBRE Y APELLIDO'] === p['NOMBRE Y APELLIDO'] && h['OS'] === p['OS'])
                            );

                            return (
                                <tr
                                    key={p._id || index}
                                    onClick={() => !isCompleted && projectPatient(p)}
                                    className={`${isActive ? 'active-row' : ''} ${isCompleted ? 'completed-row' : ''}`}
                                    style={{
                                        backgroundColor: isActive ? '#e0f2fe' : (isCompleted ? '#f0fdf4' : 'transparent'),
                                        borderLeft: isActive ? '4px solid #0ea5e9' : (isCompleted ? '4px solid #22c55e' : 'none'),
                                        cursor: isCompleted ? 'default' : 'pointer',
                                        opacity: isCompleted ? 0.7 : 1
                                    }}
                                >
                                    <td>
                                        {isCompleted ? (
                                            <span style={{ color: '#22c55e', fontWeight: 'bold' }}>✅ FINALIZADO</span>
                                        ) : (
                                            <button onClick={(e) => {
                                                e.stopPropagation();
                                                projectPatient(p);
                                            }}>
                                                PROYECTAR
                                            </button>
                                        )}
                                    </td>
                                    <td>{p['HORA']}</td>
                                    <td>{p['NOMBRE Y APELLIDO']}</td>
                                    <td onClick={(e) => e.stopPropagation()}>
                                        <select
                                            value={p['OJO'] ? String(p['OJO']).toUpperCase().trim() : ''}
                                            onChange={(e) => handleOjoChange(e, p._id)}
                                            style={{ padding: '5px' }}
                                            disabled={isCompleted}
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
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {patients.length === 0 && <p>Cargue un archivo Excel para ver la lista.</p>}
            </div>

            {/* Custom Modal */}
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
