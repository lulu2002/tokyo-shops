import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vzoynvmrggvnvnammdlh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6b3ludm1yZ2d2bnZuYW1tZGxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3Mzc5NDIsImV4cCI6MjA5MzMxMzk0Mn0.UxQjb8TPJJLnVF5bdUpQwbVl_fOnUAQlaicDbru3kDw';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
