const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Persistence Setup
const DATA_FILE = path.join(__dirname, 'data.json');

function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (err) {
        console.error('Error loading data:', err);
    }
    return { currentPatient: null, history: [], currentPatientList: [] };
}

function saveData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Error saving data:', err);
    }
}

function healData(data) {
    if (data.currentPatientList) {
        data.currentPatientList = data.currentPatientList.map((p, i) => ({
            ...p,
            _id: p._id || `gen-${Date.now()}-${i}`
        }));
    }
    return data;
}

const initialState = healData(loadData());
let currentPatient = initialState.currentPatient;
let history = initialState.history;
let currentPatientList = initialState.currentPatientList;

function persist() {
    saveData({ currentPatient, history, currentPatientList });
}

io.on('connection', (socket) => {
    console.log('Cliente conectado:', socket.id);

    // Enviar datos iniciales
    if (currentPatient) {
        socket.emit('update_patient', currentPatient);
    }
    socket.emit('history_update', history);
    socket.emit('patients_update', currentPatientList);

    // Cargar lista completa
    socket.on('upload_patients', (data) => {
        console.log('Nueva lista cargada:', data.length, 'pacientes');
        // Asegurar que todos tengan ID
        currentPatientList = data.map((p, i) => ({
            ...p,
            _id: p._id || `gen-${Date.now()}-${i}`
        }));
        persist();
        io.emit('patients_update', currentPatientList);
    });

    // Solicitar lista completa (ej: al recargar una pestaña)
    socket.on('request_patients', () => {
        socket.emit('patients_update', currentPatientList);
    });

    // Actualizar un paciente de la lista (ej: cambio de OJO)
    socket.on('update_patient_in_list', (updatedPatient) => {
        console.log('Actualizando paciente en lista:', updatedPatient['NOMBRE Y APELLIDO']);
        currentPatientList = currentPatientList.map(p =>
            p._id === updatedPatient._id ? updatedPatient : p
        );

        // SI ES EL PACIENTE ACTUAL, ACTUALIZARLO TAMBIÉN EN PANTALLA
        if (currentPatient && (currentPatient._id === updatedPatient._id ||
            (currentPatient['NOMBRE Y APELLIDO'] === updatedPatient['NOMBRE Y APELLIDO'] && currentPatient['DNI'] === updatedPatient['DNI']))) {
            console.log('Sincronizando paciente activo con cambios en lista');
            currentPatient = { ...currentPatient, ...updatedPatient };
            io.emit('update_patient', currentPatient);
        }

        persist();
        io.emit('patients_update', currentPatientList);
    });

    // Escuchar actualización desde Recepción
    socket.on('update_patient', (patientData) => {
        if (!patientData) {
            currentPatient = null;
        } else {
            console.log('Proyectando paciente:', patientData['NOMBRE Y APELLIDO']);
            // Asegurar que el paciente proyectado tenga su ID de la lista
            patientData.startTime = new Date().toISOString();
            currentPatient = patientData;
        }
        persist();
        io.emit('update_patient', currentPatient);
    });

    // Limpiar paciente (Finalizar)
    socket.on('clear_patient', () => {
        if (currentPatient) {
            console.log('Finalizando cirugía:', currentPatient['NOMBRE Y APELLIDO'], 'ID:', currentPatient._id);
            const endTime = new Date();
            const startTime = new Date(currentPatient.startTime);
            const durationMs = endTime - startTime;

            // Format duration HH:MM:SS
            const durationSeconds = Math.floor(durationMs / 1000);
            const hh = Math.floor(durationSeconds / 3600).toString().padStart(2, '0');
            const mm = Math.floor((durationSeconds % 3600) / 60).toString().padStart(2, '0');
            const ss = (durationSeconds % 60).toString().padStart(2, '0');
            const durationStr = `${hh}:${mm}:${ss}`;

            const historyItem = {
                ...currentPatient,
                historyId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                endTime: endTime.toISOString(),
                duration: durationStr
            };

            history.push(historyItem);

            // ELIMINAR DE LA LISTA INICIAL (Búsqueda robusta por ID o por Nombre+DNI)
            const initialCount = currentPatientList.length;
            currentPatientList = currentPatientList.filter(p => {
                // Si hay ID, comparar por ID
                if (currentPatient._id && p._id) {
                    return p._id !== currentPatient._id;
                }
                // Si no hay ID o falla, comparar por Nombre y DNI
                return !(p['NOMBRE Y APELLIDO'] === currentPatient['NOMBRE Y APELLIDO'] && p['DNI'] === currentPatient['DNI']);
            });

            console.log(`Lista actualizada: ${initialCount} -> ${currentPatientList.length}`);

            currentPatient = null;
            persist();
            io.emit('history_update', history);
            io.emit('patients_update', currentPatientList);
        } else {
            currentPatient = null;
            persist();
        }

        io.emit('update_patient', null);
    });

    // Eliminar item(s) del historial
    socket.on('delete_history_item', (idOrIds) => {
        const idsToDelete = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
        console.log('Eliminando del historial y restaurando:', idsToDelete.length, 'items');

        const itemsToRestore = history.filter(item => idsToDelete.includes(item.historyId));
        history = history.filter(item => !idsToDelete.includes(item.historyId));

        itemsToRestore.forEach(item => {
            const { historyId, endTime, duration, startTime, ...patientData } = item;

            // Verificación robusta de duplicados
            const exists = currentPatientList.some(p =>
                p._id === patientData._id ||
                (p['NOMBRE Y APELLIDO'] === patientData['NOMBRE Y APELLIDO'] && p['DNI'] === patientData['DNI'])
            );

            if (!exists) {
                console.log('Restaurando paciente:', patientData['NOMBRE Y APELLIDO']);
                currentPatientList.push(patientData);
            }
        });

        persist();
        io.emit('history_update', history);
        io.emit('patients_update', currentPatientList);
    });

    socket.on('disconnect', () => {
        console.log('Cliente desconectado:', socket.id);
    });
});


const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor escuchando en puerto ${PORT}`);
});
