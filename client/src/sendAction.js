// Envía una acción al servidor y espera su confirmación.
// Si no hay conexión NO la deja en cola: socket.io la mandaría al reconectar,
// minutos después y sin que nadie lo note (por ejemplo, proyectar un paciente viejo).
const ACK_TIMEOUT_MS = 8000;

export function sendAction(socket, event, ...args) {
    return new Promise((resolve, reject) => {
        if (!socket.connected) {
            socket.connect();
            reject(new Error('offline'));
            return;
        }
        socket.timeout(ACK_TIMEOUT_MS).emit(event, ...args, (err, res) => {
            if (err) reject(new Error('timeout'));
            else if (res && res.ok === false) reject(new Error(res.error || 'error'));
            else resolve(res);
        });
    });
}

export function actionErrorMessage(err) {
    if (err?.message === 'offline') {
        return 'Sin conexión con el servidor. No se envió — esperá a que vuelva la conexión y reintentá.';
    }
    if (err?.message === 'timeout') {
        return 'El servidor no confirmó a tiempo. Revisá la pantalla del quirófano y reintentá si no se aplicó.';
    }
    return 'No se pudo completar la acción. Reintentá.';
}
