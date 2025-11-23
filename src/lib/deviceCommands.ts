import { supabase } from './supabase';

export async function sendCommand(cmd: string, payload: any = {}, deviceId?: string) {
  try {
    const row = {
      cmd,
      payload: { ...payload, deviceId },
      status: 'pending',
    } as any;

    const { data, error } = await supabase.from('commands').insert([row]).select();
    return { data, error };
  } catch (err) {
    return { data: null, error: err };
  }
}

// Subscribe to telemetry INSERTs. Returns an unsubscribe function.
export function subscribeTelemetry(onInsert: (row: any) => void) {
  const channel = supabase
    .channel('telemetry-listener')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'telemetry' },
      (payload) => {
        try {
          onInsert(payload.new);
        } catch (e) {
          // ignore handler errors
        }
      }
    );

  // subscribe and return unsubscribe helper
  channel.subscribe();

  return async () => {
    try {
      await supabase.removeChannel(channel);
    } catch (e) {
      // best-effort cleanup
    }
  };
}
