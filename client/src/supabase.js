import { createClient } from '@supabase/supabase-js';

// La clave "publishable" está pensada para ir en el navegador: lo que protege los datos
// son las reglas de acceso (RLS) de la base, que exigen sesión y membresía en la institución.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://jxhxitgyvssxhmfpzzlt.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_GR173HjCr2rpSxiQbOLzEA_KXKfFMnA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        // PKCE usa ?code= en vez de #token=, que chocaría con el HashRouter
        flowType: 'pkce'
    }
});
