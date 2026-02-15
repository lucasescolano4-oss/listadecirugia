@echo off
echo Iniciando Servidor...
start "Servidor" cmd /k "cd server && npm start"
echo Iniciando Cliente...
start "Cliente" cmd /k "cd client && npm run dev -- --host"
echo.
echo Aplicacion iniciada.
echo 1. Abre http://localhost:5173/ en tu navegador para la Recepcion.
echo 2. Abre http://localhost:5173/surgery en otra ventana para el Quirofano.
echo 3. Abre http://localhost:5173/history para ver el Historial.
echo.
pause
