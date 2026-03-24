import React from 'react';

const QUIROFANOS = [
    { id: 'q1', nombre: 'Quirófano 1', color: '#0ea5e9' },
    { id: 'q2', nombre: 'Quirófano 2', color: '#8b5cf6' },
    { id: 'q3', nombre: 'Quirófano 3', color: '#10b981' },
    { id: 'q4', nombre: 'Quirófano 4', color: '#f59e0b' },
];

function RoomSelector({ onSelect }) {
    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#0f172a',
            padding: '2rem',
            gap: '2rem'
        }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🏥</div>
                <h1 style={{
                    color: '#f1f5f9',
                    fontSize: '2rem',
                    fontWeight: '800',
                    margin: 0,
                    letterSpacing: '0.05em'
                }}>
                    SISTEMA DE CIRUGÍA
                </h1>
                <p style={{ color: '#64748b', marginTop: '0.5rem', fontSize: '1rem' }}>
                    Seleccioná el quirófano para continuar
                </p>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '1.5rem',
                width: '100%',
                maxWidth: '500px'
            }}>
                {QUIROFANOS.map(q => (
                    <button
                        key={q.id}
                        onClick={() => onSelect(q)}
                        style={{
                            backgroundColor: '#1e293b',
                            border: `2px solid ${q.color}`,
                            borderRadius: '16px',
                            padding: '2rem 1rem',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '0.75rem',
                            transition: 'all 0.15s',
                            color: '#f1f5f9',
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.backgroundColor = q.color;
                            e.currentTarget.style.transform = 'scale(1.04)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.backgroundColor = '#1e293b';
                            e.currentTarget.style.transform = 'scale(1)';
                        }}
                    >
                        <span style={{ fontSize: '2.5rem' }}>🔬</span>
                        <span style={{
                            fontSize: '1.1rem',
                            fontWeight: '700',
                            textAlign: 'center',
                            color: q.color
                        }}>
                            {q.nombre}
                        </span>
                    </button>
                ))}
            </div>

            <p style={{ color: '#334155', fontSize: '0.8rem', marginTop: '1rem' }}>
                La sesión se mantiene mientras el navegador esté abierto
            </p>
        </div>
    );
}

export { QUIROFANOS };
export default RoomSelector;
