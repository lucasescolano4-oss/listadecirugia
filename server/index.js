const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Health check para Render (evita que el servicio duerma)
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

const server = http.createServer(app);

// En producción (Render), el cliente viene de Vercel — permitir ese origen
const allowedOrigins = process.env.CLIENT_URL
    ? [process.env.CLIENT_URL, 'http://localhost:5173']
    : '*';

const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST']
    },
    // Importante para Render: permite WebSocket con fallback a polling
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
});

// ── Persistencia ──────────────────────────────────────────────────────────────
const DATA_FILE = path.join(__dirname, 'data.json');

function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE, 'utf8');
            return JSON.parse(raw);
        }
    } catch (err) {
        console.error('Error al cargar data.json:', err);
    }
    return { currentPatient: null, history: [], currentPatientList: [] };
}

function saveData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Error al guardar data.json:', err);
    }
}

function ensureIds(list) {
    return (list || []).map((p, i) => ({
        ...p,
        _id: p._id || `gen-${Date.now()}-${i}`
    }));
}

// Estado inicial
const initialState = loadData();
let currentPatient    = initialState.currentPatient    || null;
let history           = initialState.history           || [];
let currentPatientList = ensureIds(initialState.currentPatientList);

function persist() {
    saveData({ currentPatient, history, currentPatientList });
}

// ── Socket events ─────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
    console.log('Cliente conectado:', socket.id);

    // Enviar estado actual al cliente que se acaba de conectar
    socket.emit('update_patient',  currentPatient);
    socket.emit('history_update',  history);
    socket.emit('patients_update', currentPatientList);

    // Cargar lista completa desde Excel
    socket.on('upload_patients', (data) => {
        if (!Array.isArray(data)) return;
        currentPatientList = ensureIds(data);
        persist();
        io.emit('patients_update', currentPatientList);
    });

    // Solicitar lista (al recargar una pestaña)
    socket.on('request_patients', () => {
        socket.emit('patients_update', currentPatientList);
        socket.emit('history_update',  history);
        socket.emit('update_patient',  currentPatient);
    });

    // Editar un paciente de la lista (ej: cambiar OJO)
    socket.on('update_patient_in_list', (updatedPatient) => {
        if (!updatedPatient || !updatedPatient._id) return;

        currentPatientList = currentPatientList.map(p =>
            p._id === updatedPatient._id ? updatedPatient : p
        );

        // Si es el paciente activo, sincronizar pantalla quirófano también
        if (currentPatient && currentPatient._id === updatedPatient._id) {
            currentPatient = { ...currentPatient, ...updatedPatient };
            io.emit('update_patient', currentPatient);
        }

        persist();
        io.emit('patients_update', currentPatientList);
    });

    // Proyectar paciente en pantalla quirófano
    socket.on('update_patient', (patientData) => {
        if (!patientData) {
            currentPatient = null;
        } else {
            currentPatient = {
                ...patientData,
                startTime: new Date().toISOString()
            };
            console.log('Proyectando:', currentPatient['NOMBRE Y APELLIDO']);
        }
        persist();
        io.emit('update_patient', currentPatient);
    });

    // Finalizar cirugía — mueve al historial y elimina de la lista
    socket.on('clear_patient', () => {
        if (currentPatient) {
            console.log('Finalizando cirugía:', currentPatient['NOMBRE Y APELLIDO']);

            const endTime   = new Date();
            const startTime = new Date(currentPatient.startTime || endTime);
            const durationMs = endTime - startTime;
            const totalSecs  = Math.floor(durationMs / 1000);
            const hh = Math.floor(totalSecs / 3600).toString().padStart(2, '0');
            const mm = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, '0');
            const ss = (totalSecs % 60).toString().padStart(2, '0');

            history.push({
                ...currentPatient,
                historyId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                endTime:   endTime.toISOString(),
                duration:  `${hh}:${mm}:${ss}`
            });

            // Eliminar de la lista por _id (fallback: nombre + DNI)
            currentPatientList = currentPatientList.filter(p => {
                if (currentPatient._id && p._id) return p._id !== currentPatient._id;
                return !(
                    p['NOMBRE Y APELLIDO'] === currentPatient['NOMBRE Y APELLIDO'] &&
                    p['DNI'] === currentPatient['DNI']
                );
            });
        }

        currentPatient = null;
        persist();
        io.emit('update_patient',  null);
        io.emit('history_update',  history);
        io.emit('patients_update', currentPatientList);
    });

    // ── NUEVA JORNADA: borra todo el estado ──────────────────────────────────
    socket.on('reset_all', () => {
        console.log('Nueva jornada — limpiando todo el estado');
        currentPatient     = null;
        history            = [];
        currentPatientList = [];
        persist();
        io.emit('update_patient',  null);
        io.emit('history_update',  []);
        io.emit('patients_update', []);
    });

    // Eliminar item(s) del historial y restaurar en lista
    socket.on('delete_history_item', (idOrIds) => {
        const idsToDelete = Array.isArray(idOrIds) ? idOrIds : [idOrIds];

        const itemsToRestore = history.filter(item => idsToDelete.includes(item.historyId));
        history = history.filter(item => !idsToDelete.includes(item.historyId));

        itemsToRestore.forEach(item => {
            const { historyId, endTime, duration, startTime, ...patientData } = item;
            const alreadyExists = currentPatientList.some(p =>
                p._id === patientData._id ||
                (p['NOMBRE Y APELLIDO'] === patientData['NOMBRE Y APELLIDO'] &&
                 p['DNI'] === patientData['DNI'])
            );
            if (!alreadyExists) {
                currentPatientList.push(patientData);
            }
        });

        persist();
        io.emit('history_update',  history);
        io.emit('patients_update', currentPatientList);
    });

    socket.on('disconnect', () => {
        console.log('Cliente desconectado:', socket.id);
    });
});

// ── Iniciar servidor ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor escuchando en puerto ${PORT}`);
});
