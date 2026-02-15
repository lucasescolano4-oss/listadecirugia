import React, { useState, useEffect } from 'react';

function HistoryView({ socket, history }) {
    const [selectedIds, setSelectedIds] = useState([]);

    const formatTime = (isoString) => {
        if (!isoString) return '-';
        return new Date(isoString).toLocaleTimeString('es-AR', { hour12: false });
    };

    const handleSelect = (id) => {
        setSelectedIds(prev => {
            if (prev.includes(id)) {
                return prev.filter(item => item !== id);
            } else {
                return [...prev, id];
            }
        });
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            // Select only items that have an ID
            const allIds = history.map(item => item.historyId).filter(id => id);
            setSelectedIds(allIds);
        } else {
            setSelectedIds([]);
        }
    };

    const handleDeleteSelected = () => {
        if (selectedIds.length === 0) return;

        if (window.confirm(`¿Seguro que desea eliminar ${selectedIds.length} elemento(s) del historial?`)) {
            socket.emit('delete_history_item', selectedIds);
            setSelectedIds([]);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    // Calculate if all valid items are selected
    const validHistoryItems = history.filter(h => h.historyId);
    const allSelected = validHistoryItems.length > 0 && selectedIds.length === validHistoryItems.length;

    return (
        <div className="reception-container" style={{ paddingBottom: '80px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1>Historial de Cirugías</h1>
                <button
                    onClick={handlePrint}
                    className="no-print"
                    style={{
                        padding: '10px 20px',
                        fontSize: '1rem',
                        cursor: 'pointer',
                        backgroundColor: '#4e5d6c',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px'
                    }}
                >
                    🖨️ IMPRIMIR LISTA
                </button>
            </div>

            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th className="no-print" style={{ width: '40px', textAlign: 'center' }}>
                                <input
                                    type="checkbox"
                                    onChange={handleSelectAll}
                                    checked={allSelected}
                                />
                            </th>
                            <th>Nombre</th>
                            <th>Ojo</th>
                            <th>LIO</th>
                            <th>Hora Inicio</th>
                            <th>Hora Fin</th>
                            <th>Duración</th>
                        </tr>
                    </thead>
                    <tbody>
                        {history.slice().reverse().map((item, index) => {
                            // Ensure we have an ID to key off, use index fallback if server hasn't updated ID yet but it shouldn't happen for new ones
                            const key = item.historyId || `idx-${index}`;
                            const hasId = !!item.historyId;

                            return (
                                <tr key={key} onClick={() => hasId && handleSelect(item.historyId)} style={{ cursor: hasId ? 'pointer' : 'default' }}>
                                    <td className="no-print" style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                                        {hasId && (
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(item.historyId)}
                                                onChange={() => handleSelect(item.historyId)}
                                            />
                                        )}
                                    </td>
                                    <td>{item['NOMBRE Y APELLIDO']}</td>
                                    <td>{item['OJO']}</td>
                                    <td>{item['LIO']}</td>
                                    <td>{formatTime(item.startTime)}</td>
                                    <td>{formatTime(item.endTime)}</td>
                                    <td>{item.duration}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {history.length === 0 && <p>No hay cirugías registradas aún.</p>}
            </div>

            {selectedIds.length > 0 && (
                <div className="delete-selected-btn no-print" onClick={handleDeleteSelected}>
                    <span>🗑️ Eliminar ({selectedIds.length})</span>
                </div>
            )}
        </div>
    );
}

export default HistoryView;
