import React, { useState } from 'react';
import { supabase } from './supabase';
import { valor, label, hhmm, duracion, fechaLarga } from './config';

function HistoryView({ ui, rows, fecha, puedeEditar, recargar }) {
    const [selectedIds, setSelectedIds] = useState([]);

    const finalizadas = rows
        .filter(r => r.estado === 'finalizada')
        .sort((a, b) => String(b.fin).localeCompare(String(a.fin)));

    const handleSelect = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleSelectAll = (e) => {
        setSelectedIds(e.target.checked ? finalizadas.map(r => r.id) : []);
    };

    // Devuelve las seleccionadas a la lista de pendientes (por si se finalizaron por error)
    const handleRestore = async () => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`¿Volver ${selectedIds.length} cirugía(s) a la lista de pendientes?`)) return;
        const { error } = await supabase
            .from('qx_cirugias')
            .update({ estado: 'pendiente', inicio: null, fin: null })
            .in('id', selectedIds);
        if (error) alert('No se pudo completar: ' + error.message);
        else setSelectedIds([]);
        recargar();
    };

    const allSelected = finalizadas.length > 0 && selectedIds.length === finalizadas.length;

    return (
        <div className="reception-container" style={{ paddingBottom: '80px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <h1 style={{ marginBottom: 0 }}>Cirugías finalizadas</h1>
                <button onClick={() => window.print()} className="no-print"
                        style={{ padding: '10px 20px', fontSize: '1rem', cursor: 'pointer', backgroundColor: '#4e5d6c',
                                 color: 'white', border: 'none', borderRadius: '5px' }}>
                    🖨️ IMPRIMIR LISTA
                </button>
            </div>
            <p style={{ color: '#475569', textTransform: 'capitalize', marginTop: '4px' }}>{fechaLarga(fecha)}</p>

            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            {puedeEditar && (
                                <th className="no-print" style={{ width: '40px', textAlign: 'center' }}>
                                    <input type="checkbox" onChange={handleSelectAll} checked={allSelected} />
                                </th>
                            )}
                            <th>Nombre</th>
                            {ui.resumen.map(col => <th key={col}>{label(col)}</th>)}
                            <th>Hora inicio</th>
                            <th>Hora fin</th>
                            <th>Duración</th>
                        </tr>
                    </thead>
                    <tbody>
                        {finalizadas.map(r => (
                            <tr key={r.id} onClick={() => puedeEditar && handleSelect(r.id)}
                                style={{ cursor: puedeEditar ? 'pointer' : 'default' }}>
                                {puedeEditar && (
                                    <td className="no-print" style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                                        <input type="checkbox" checked={selectedIds.includes(r.id)} onChange={() => handleSelect(r.id)} />
                                    </td>
                                )}
                                <td>{r.nombre}</td>
                                {ui.resumen.map(col => <td key={col}>{valor(r, col)}</td>)}
                                <td>{hhmm(r.inicio)}</td>
                                <td>{hhmm(r.fin)}</td>
                                <td>{duracion(r.inicio, r.fin)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {finalizadas.length === 0 && <p style={{ padding: '20px' }}>No hay cirugías finalizadas en este día.</p>}
            </div>

            {selectedIds.length > 0 && (
                <div className="delete-selected-btn no-print" onClick={handleRestore} style={{ backgroundColor: '#f59e0b' }}>
                    <span>↩ Volver a pendientes ({selectedIds.length})</span>
                </div>
            )}
        </div>
    );
}

export default HistoryView;
