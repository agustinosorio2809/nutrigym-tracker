import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://utuxwjlgoxfmtyebtfit.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0dXh3amxnb3hmbXR5ZWJ0Zml0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyOTA2NTcsImV4cCI6MjA4OTg2NjY1N30.m06heMKY9MaHdGpyGteB-a3A02TfpSqOyBcf6o3z2TQ'

export const supabase = createClient(supabaseUrl, supabaseKey)