# Surgery Screen App

Sistema para gestionar pacientes en quirófano: carga un Excel con la lista, proyectá cada paciente en la pantalla del quirófano y registrá el historial con tiempos de cirugía.

---

## Estructura del proyecto

```
/
├── server/          ← Backend Node.js (deployar en Render)
│   ├── index.js
│   └── package.json
└── client/          ← Frontend React + Vite (deployar en Vercel)
    ├── src/
    ├── vercel.json
    └── package.json
```

---

## Deploy en producción (Render + Vercel)

### 1. Render — Servidor

1. Crear nuevo **Web Service** en [render.com](https://render.com)
2. Conectar el repositorio
3. Configuración:
   - **Root Directory:** `server`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment:** Node
4. En **Environment Variables** agregar:
   - `CLIENT_URL` = la URL de tu app en Vercel (ej: `https://tu-app.vercel.app`)
5. Copiar la URL que te da Render (ej: `https://tu-servidor.onrender.com`)

> ⚠️ Render en plan gratuito "duerme" el servidor tras 15 min de inactividad.
> El endpoint `/health` existe para usarlo con un servicio de uptime (ej: UptimeRobot).

### 2. Vercel — Cliente

1. Crear nuevo proyecto en [vercel.com](https://vercel.com)
2. Conectar el repositorio
3. Configuración:
   - **Root Directory:** `client`
   - **Framework:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. En **Environment Variables** agregar:
   - `VITE_SERVER_URL` = la URL de Render del paso anterior
5. Hacer **Redeploy** para que tome la variable de entorno

---

## Desarrollo local

```bash
# Terminal 1 — servidor
cd server
npm install
npm start

# Terminal 2 — cliente
cd client
npm install
npm run dev
```

El cliente se conecta automáticamente a `localhost:3000` en desarrollo.

---

## Columnas esperadas en el Excel

| Columna | Descripción |
|---------|-------------|
| HORA | Horario programado |
| NOMBRE Y APELLIDO | Nombre completo |
| OJO | Derecho / Izquierdo |
| LIO | Valor del lente intraocular |
| EDAD | Edad del paciente |
| DNI | Documento (se usa para identificar duplicados) |
| OS | Obra social |
| N° | Número de afiliado |
| CATA | Tipo de catarata |
| DIL | Dilatación |
| APP | Antecedentes patológicos |

---

## Rutas de la aplicación

| URL | Vista |
|-----|-------|
| `/` | Recepción — cargar Excel, seleccionar paciente |
| `/#/surgery` | Quirófano — pantalla de cirugía en curso |
| `/#/history` | Historial — cirugías finalizadas |
