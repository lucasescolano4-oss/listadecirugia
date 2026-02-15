
const io = require('socket.io-client');

const socket = io('http://localhost:3000');

const samplePatient = {
    'NOMBRE Y APELLIDO': 'JUAN PEREZ',
    'OJO': 'DERECHO',
    'LIO': '+22.5',
    'EDAD': '65',
    'CATA': 'NO',
    'DIL': 'SI',
    'OS': 'OSDE 210',
    'APP': 'HTA, DBT'
};

socket.on('connect', () => {
    console.log('Connected to server');
    console.log('Emitting update_patient...');
    socket.emit('update_patient', samplePatient);

    setTimeout(() => {
        console.log('Done, disconnecting...');
        socket.disconnect();
    }, 2000);
});
