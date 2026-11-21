// ── Configuración de pantallas por institución ──────────────────────────────────
// Las columnas usan los nombres de encabezado del Excel. Las que están en BASE_FIELDS
// van a columnas propias de qx_cirugias; el resto se guarda en qx_cirugias.extra.

export const BASE_FIELDS = {
    'HORA':              'hora',
    'QUIROFANO':         'quirofano',
    'NOMBRE Y APELLIDO': 'nombre',
    'DNI':               'dni',
    'DIAGNOSTICO':       'diagnostico',
    'TELEFONO':          'telefono',
    'CIRUGIA':           'cirugia',
    'CIRUJANO':          'cirujano',
    'OBSERVACIONES':     'observaciones'
};

export const LABELS = {
    'QUIROFANO':     'QUIRÓFANO',
    'DIAGNOSTICO':   'DIAGNÓSTICO',
    'TELEFONO':      'TELÉFONO',
    'CIRUGIA':       'CIRUGÍA',
    'OS':            'OBRA SOCIAL',
    'APP':           'ANTECEDENTES (APP)'
};

export const label = (col) => LABELS[col] || col;

const COLORES_QUIROFANO = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

const UI = {
    privado: {
        columnas: ['HORA', 'NOMBRE Y APELLIDO', 'OJO', 'LIO', 'EDAD', 'DNI', 'OS', 'N°', 'CATA', 'DIL', 'APP'],
        // Pantalla "En cirugía": debajo del nombre, en tres tamaños
        pantalla: { grande: ['OJO', 'LIO'], media: ['EDAD', 'CATA', 'DIL'], chica: ['OS', 'N°', 'APP'] },
        resumen:  ['OJO', 'LIO']           // vista general e historial
    },
    hze: {
        columnas: ['HORA', 'NOMBRE Y APELLIDO', 'DNI', 'DIAGNOSTICO', 'TELEFONO', 'CIRUGIA', 'CIRUJANO', 'OBSERVACIONES'],
        // Orden de las columnas al pegar filas sin encabezado
        pegado:   ['HORA', 'QUIROFANO', 'NOMBRE Y APELLIDO', 'DNI', 'DIAGNOSTICO', 'TELEFONO', 'CIRUGIA', 'CIRUJANO', 'OBSERVACIONES'],
        pantalla: { grande: ['CIRUGIA'], media: ['DIAGNOSTICO', 'CIRUJANO'], chica: ['OBSERVACIONES'] },
        resumen:  ['CIRUGIA', 'CIRUJANO']
    }
};

export function uiDe(institucionId) {
    const ui = UI[institucionId] || UI.hze;
    return { ...ui, pegado: ui.pegado || ui.columnas };
}

export function quirofanosDe(institucion) {
    return Array.from({ length: institucion.quirofanos }, (_, i) => ({
        numero: i + 1,
        nombre: `Quirófano ${i + 1}`,
        color:  COLORES_QUIROFANO[i % COLORES_QUIROFANO.length]
    }));
}

// ── Encabezados ─────────────────────────────────────────────────────────────────
const quitarAcentos = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

// Variantes de encabezado que se aceptan (ya normalizadas: mayúsculas, sin acentos)
const HEADER_ALIASES = {
    'NOMBRE': 'NOMBRE Y APELLIDO', 'APELLIDO Y NOMBRE': 'NOMBRE Y APELLIDO', 'PACIENTE': 'NOMBRE Y APELLIDO',
    'PACIENTE - HISTORIA CLINICA': 'NOMBRE Y APELLIDO', 'PACIENTE HISTORIA CLINICA': 'NOMBRE Y APELLIDO',
    'Q': 'QUIROFANO', 'Q 1-2-3': 'QUIROFANO', 'Q1-2-3': 'QUIROFANO', 'QX': 'QUIROFANO',
    'OBSERVACION': 'OBSERVACIONES', 'OBSERVACIO NES': 'OBSERVACIONES', 'OBS': 'OBSERVACIONES',
    'TEL': 'TELEFONO', 'CELULAR': 'TELEFONO',
    'DIAGNOSTICO': 'DIAGNOSTICO', 'CIRUGIA': 'CIRUGIA',
    'Nº': 'N°', 'NO': 'N°', 'NRO': 'N°', 'N': 'N°', 'NUMERO': 'N°',
    'OBRA SOCIAL': 'OS'
};

export function normalizeHeader(h) {
    const key = quitarAcentos(String(h).trim().toUpperCase()).replace(/\s+/g, ' ');
    return HEADER_ALIASES[key] || key;
}

// ── Valores ─────────────────────────────────────────────────────────────────────
// Acepta 8 · "8" · "8:30" · "08.30" · "8 hs" · fracción de día de Excel (0.354…). Devuelve "HH:MM" o null.
export function parseHora(v) {
    if (v === null || v === undefined || v === '') return null;
    let h, m = 0;
    if (typeof v === 'number') {
        if (v > 0 && v < 1) {
            const mins = Math.round(v * 24 * 60);
            h = Math.floor(mins / 60);
            m = mins % 60;
        } else {
            h = Math.floor(v);
            m = Math.round((v - h) * 60);
        }
    } else {
        const match = String(v).trim().match(/^(\d{1,2})(?:\s*[:.h]\s*(\d{2}))?/i);
        if (!match) return null;
        h = Number(match[1]);
        m = match[2] ? Number(match[2]) : 0;
    }
    if (h > 23 || m > 59) return null;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function parseQuirofano(v) {
    const match = String(v ?? '').match(/\d+/);
    return match ? Number(match[0]) : null;
}

// Valor de una columna para mostrar
export function valor(row, col) {
    const field = BASE_FIELDS[col];
    if (field === 'hora') return row.hora ? row.hora.slice(0, 5) : '';
    if (field) return row[field] ?? '';
    return row.extra?.[col] ?? '';
}

// Convierte un paciente con claves de encabezado de Excel en una fila de qx_cirugias
export function aFila(paciente, { institucion_id, fecha, quirofano }) {
    const fila = { institucion_id, fecha, quirofano, extra: {} };
    for (const [rawKey, rawVal] of Object.entries(paciente)) {
        if (rawKey.startsWith('_')) continue;
        const col = normalizeHeader(rawKey);
        const val = typeof rawVal === 'string' ? rawVal.trim() : rawVal;
        if (val === '' || val === null || val === undefined) continue;
        const field = BASE_FIELDS[col];
        if (field === 'hora')           fila.hora = parseHora(val);
        else if (field === 'quirofano') fila.quirofano = parseQuirofano(val) ?? quirofano;
        else if (field)                 fila[field] = String(val);
        else                            fila.extra[col] = String(val);
    }
    return fila;
}

// Orden de la lista: por hora (sin hora al final), después el orden de carga
export function ordenar(rows) {
    return [...rows].sort((a, b) =>
        (a.hora || '99').localeCompare(b.hora || '99') ||
        (a.orden - b.orden) ||
        String(a.creado_en).localeCompare(String(b.creado_en))
    );
}

// ── Fechas (en la hora local del dispositivo) ───────────────────────────────────
export function hoyISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Mover una fecha N días (en hora local)
export function sumarDias(iso, n) {
    const [y, m, d] = iso.split('-').map(Number);
    const f = new Date(y, m - 1, d + n);
    return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
}

export function fechaLarga(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function hhmm(isoTimestamp) {
    if (!isoTimestamp) return '-';
    return new Date(isoTimestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function duracion(desde, hasta) {
    if (!desde) return '';
    const secs = Math.max(0, Math.floor(((hasta ? new Date(hasta) : new Date()) - new Date(desde)) / 1000));
    const hh = Math.floor(secs / 3600);
    const mm = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
    const ss = String(secs % 60).padStart(2, '0');
    return hh > 0 ? `${String(hh).padStart(2, '0')}:${mm}:${ss}` : `${mm}:${ss}`;
}
