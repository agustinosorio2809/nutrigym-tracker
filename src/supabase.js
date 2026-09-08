import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY

// createClient lanza si la URL viene vacia, y como este modulo se importa desde
// el top-level de App.jsx eso mata el render antes de montar: la app queda en
// blanco, sin ninguna pista de que fallo. Se prefiere exponer el faltante y que
// App.jsx lo muestre en pantalla.
export const faltaConfiguracion = !supabaseUrl || !supabaseKey

export const supabase = faltaConfiguracion ? null : createClient(supabaseUrl, supabaseKey)
