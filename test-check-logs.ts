import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ubfqpeyosyuaxrlqomqp.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InViZnFwZXlvc3l1YXhybHFvbXFwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjEyMjczMiwiZXhwIjoyMTAxNjk4NzMyfQ.Qax2tCLZitxTrd5cxacMalL92vNZmOVgJ0nASYLnY_k';

async function run() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  const { data: session } = await supabase.from('client_bot_sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
    
  console.log('Session Status:', session.status);
  console.log('Session Last Error:', session.last_error);
  
  const { data: logs } = await supabase.from('client_bot_logs')
    .select('*')
    .eq('bot_id', session.bot_id)
    .order('created_at', { ascending: true });
    
  console.log('Logs:');
  logs?.forEach(l => console.log(`[${l.category}] ${l.message}`));
}
run();
