import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

// Cirugías de una institución en una fecha, actualizadas en tiempo real.
// Además de escuchar los cambios, vuelve a leer todo al (re)conectarse y cuando
// el dispositivo vuelve a primer plano, así nunca queda mostrando datos viejos.
export function useCirugias(institucionId, fecha) {
    const clave = `${institucionId}|${fecha}`;
    // Las filas se guardan junto con la clave de la que vienen: al cambiar de día
    // no se muestran las del día anterior mientras carga el nuevo
    const [estado,    setEstado]    = useState({ clave: null, rows: [] });
    const [error,     setError]     = useState(null);
    const [conectado, setConectado] = useState(true);
    const pedido = useRef(0);
    const canal  = useRef(null);

    const recargar = useCallback(async () => {
        const n = ++pedido.current;
        const { data, error: err } = await supabase
            .from('qx_cirugias')
            .select('*')
            .eq('institucion_id', institucionId)
            .eq('fecha', fecha);
        if (n !== pedido.current) return; // llegó una respuesta más nueva
        if (err) {
            setError(err.message);
            return;
        }
        setError(null);
        setEstado({ clave, rows: data });
        // Si la lectura anduvo y el canal en vivo está unido, la conexión está bien
        if (canal.current?.state === 'joined') setConectado(true);
    }, [institucionId, fecha, clave]);

    useEffect(() => {
        // recargar() solo cambia el estado cuando llega la respuesta (después del await)
        // eslint-disable-next-line react-hooks/set-state-in-effect
        recargar();

        // Aplica un cambio en vivo solo si corresponde a la clave que se está mostrando
        const actualizar = (fn) => setEstado(prev => prev.clave === clave ? { clave, rows: fn(prev.rows) } : prev);

        const channel = supabase
            .channel(`qx-${clave}-${Math.random().toString(36).slice(2)}`)
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'qx_cirugias', filter: `institucion_id=eq.${institucionId}` },
                (payload) => {
                    if (payload.eventType === 'DELETE') {
                        actualizar(rows => rows.filter(r => r.id !== payload.old.id));
                        return;
                    }
                    const row = payload.new;
                    actualizar(rows => {
                        const sinEsta = rows.filter(r => r.id !== row.id);
                        return row.fecha === fecha ? [...sinEsta, row] : sinEsta;
                    });
                })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    setConectado(true);
                    recargar(); // por si algo cambió mientras estaba desconectado
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                    setConectado(false);
                }
            });
        canal.current = channel;

        const alVolver = () => { if (document.visibilityState !== 'hidden') recargar(); };
        const offline  = () => setConectado(false);
        document.addEventListener('visibilitychange', alVolver);
        window.addEventListener('focus',   alVolver);
        window.addEventListener('online',  alVolver);
        window.addEventListener('offline', offline);

        return () => {
            canal.current = null;
            supabase.removeChannel(channel);
            document.removeEventListener('visibilitychange', alVolver);
            window.removeEventListener('focus',   alVolver);
            window.removeEventListener('online',  alVolver);
            window.removeEventListener('offline', offline);
        };
    }, [institucionId, fecha, clave, recargar]);

    const listo = estado.clave === clave;
    return {
        rows:     listo ? estado.rows : [],
        cargando: !listo && !error,
        error,
        conectado,
        recargar
    };
}
