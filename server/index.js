const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

const server = http.createServer(app);

const allowedOrigins = process.env.CLIENT_URL
    ? [process.env.CLIENT_URL, 'http://localhost:5173']
    : '*';

const io = new Server(server, {
    cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
});

// Persistencia
const DATA_FILE = path.join(__dirname, 'data.json');

function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (err) { console.error('Error al cargar data.json:', err); }
    return {};
}

function saveData(data) {
    try { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }
    catch (err) { console.error('Error al guardar data.json:', err); }
}

function ensureIds(list) {
    return (list || []).map((p, i) => ({ ...p, _id: p._id || `gen-${Date.now()}-${i}` }));
}

function emptyRoom() {
    return { currentPatient: null, history: [], currentPatientList: [] };
}

// Estado: un objeto por quirofano { q1: {...}, q2: {...} }
let rooms = loadData();

function getRoom(roomId) {
    if (!rooms[roomId]) rooms[roomId] = emptyRoom();
    rooms[roomId].currentPatientList = ensureIds(rooms[roomId].currentPatientList);
    return rooms[roomId];
}

function getRoomId(socket) {
    const r = Array.from(socket.rooms).filter(r => r !== socket.id);
    return r[0] || null;
}

function persist() { saveData(rooms); }

io.on('connection', (socket) => {
    console.log('Cliente conectado:', socket.id);

    socket.on('join_room', (roomId) => {
        Array.from(socket.rooms)
            .filter(r => r !== socket.id)
            .forEach(r => socket.leave(r));
        socket.join(roomId);
        console.log(`Socket ${socket.id} unido a sala: ${roomId}`);
        const room = getRoom(roomId);
        socket.emit('update_patient',  room.currentPatient);
        socket.emit('history_update',  room.history);
        socket.emit('patients_update', room.currentPatientList);
    });

    socket.on('upload_patients', (data) => {
        const roomId = getRoomId(socket);
        if (!roomId || !Array.isArray(data)) return;
        const room = getRoom(roomId);
        room.currentPatientList = ensureIds(data);
        persist();
        io.to(roomId).emit('patients_update', room.currentPatientList);
    });

    socket.on('request_patients', () => {
        const roomId = getRoomId(socket);
        if (!roomId) return;
        const room = getRoom(roomId);
        socket.emit('patients_update', room.currentPatientList);
        socket.emit('history_update',  room.history);
        socket.emit('update_patient',  room.currentPatient);
    });

    socket.on('update_patient_in_list', (updatedPatient) => {
        const roomId = getRoomId(socket);
        if (!roomId || !updatedPatient || !updatedPatient._id) return;
        const room = getRoom(roomId);
        room.currentPatientList = room.currentPatientList.map(p =>
            p._id === updatedPatient._id ? updatedPatient : p
        );
        if (room.currentPatient && room.currentPatient._id === updatedPatient._id) {
            room.currentPatient = { ...room.currentPatient, ...updatedPatient };
            io.to(roomId).emit('update_patient', room.currentPatient);
        }
        persist();
        io.to(roomId).emit('patients_update', room.currentPatientList);
    });

    socket.on('update_patient', (patientData) => {
        const roomId = getRoomId(socket);
        if (!roomId) return;
        const room = getRoom(roomId);
        room.currentPatient = patientData
            ? { ...patientData, startTime: new Date().toISOString() }
            : null;
        if (patientData) console.log(`[${roomId}] Proyectando:`, patientData['NOMBRE Y APELLIDO']);
        persist();
        io.to(roomId).emit('update_patient', room.currentPatient);
    });

    socket.on('clear_patient', () => {
        const roomId = getRoomId(socket);
        if (!roomId) return;
        const room = getRoom(roomId);
        if (room.currentPatient) {
            const endTime   = new Date();
            const startTime = new Date(room.currentPatient.startTime || endTime);
            const totalSecs = Math.floor((endTime - startTime) / 1000);
            const hh = Math.floor(totalSecs / 3600).toString().padStart(2, '0');
            const mm = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, '0');
            const ss = (totalSecs % 60).toString().padStart(2, '0');
            room.history.push({
                ...room.currentPatient,
                historyId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                endTime:   endTime.toISOString(),
                duration:  `${hh}:${mm}:${ss}`
            });
            room.currentPatientList = room.currentPatientList.filter(p => {
                if (room.currentPatient._id && p._id) return p._id !== room.currentPatient._id;
                return !(p['NOMBRE Y APELLIDO'] === room.currentPatient['NOMBRE Y APELLIDO'] && p['DNI'] === room.currentPatient['DNI']);
            });
        }
        room.currentPatient = null;
        persist();
        io.to(roomId).emit('update_patient',  null);
        io.to(roomId).emit('history_update',  room.history);
        io.to(roomId).emit('patients_update', room.currentPatientList);
    });

    socket.on('reset_all', () => {
        const roomId = getRoomId(socket);
        if (!roomId) return;
        console.log(`[${roomId}] Nueva jornada`);
        rooms[roomId] = emptyRoom();
        persist();
        io.to(roomId).emit('update_patient',  null);
        io.to(roomId).emit('history_update',  []);
        io.to(roomId).emit('patients_update', []);
    });

    socket.on('delete_history_item', (idOrIds) => {
        const roomId = getRoomId(socket);
        if (!roomId) return;
        const room = getRoom(roomId);
        const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
        const toRestore = room.history.filter(i => ids.includes(i.historyId));
        room.history = room.history.filter(i => !ids.includes(i.historyId));
        toRestore.forEach(item => {
            const { historyId, endTime, duration, startTime, ...p } = item;
            const exists = room.currentPatientList.some(x =>
                x._id === p._id || (x['NOMBRE Y APELLIDO'] === p['NOMBRE Y APELLIDO'] && x['DNI'] === p['DNI'])
            );
            if (!exists) room.currentPatientList.push(p);
        });
        persist();
        io.to(roomId).emit('history_update',  room.history);
        io.to(roomId).emit('patients_update', room.currentPatientList);
    });

    socket.on('disconnect', () => console.log('Desconectado:', socket.id));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`Servidor en puerto ${PORT}`));
