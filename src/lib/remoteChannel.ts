import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { topicFor } from './remote';

// A thin wrapper around a private Supabase Realtime Broadcast channel (remote:<code>).
// The channel is private, so the database decides who may use it (supabase/realtime-remote.sql).

export type LinkStatus =
  | 'connecting' // opening the connection
  | 'connected' // the channel is open
  | 'retrying' // the connection dropped, trying again
  | 'denied' // the database refused: the security SQL has not been run, or this is not the owner
  | 'closed'; // we closed it on purpose

export interface RemoteLink {
  send: (event: string, payload?: Record<string, unknown>) => void;
  reconnect: () => void;
  close: () => void;
}

export function openRemote(
  supabase: SupabaseClient,
  code: string,
  onEvent: (event: string, payload: unknown) => void,
  onStatus: (status: LinkStatus) => void,
): RemoteLink {
  let channel: RealtimeChannel | null = null;
  let closed = false;
  let attempt = 0;

  function connect() {
    const mine = ++attempt;
    onStatus('connecting');
    const next = supabase.channel(topicFor(code), { config: { private: true, broadcast: { self: false, ack: false } } });
    channel = next;
    next.on('broadcast', { event: '*' }, ({ event, payload }) => onEvent(event, payload));
    next.subscribe((status, error) => {
      if (closed || mine !== attempt) return;
      if (status === 'SUBSCRIBED') onStatus('connected');
      else if (status === 'CLOSED') onStatus('retrying');
      else if (status === 'TIMED_OUT') onStatus('retrying');
      else if (status === 'CHANNEL_ERROR') {
        // A private channel the database refuses reports an error that mentions permission or authorization.
        const text = `${error?.message ?? ''}`.toLowerCase();
        onStatus(/unauthor|permission|not allowed|forbidden|policy/.test(text) ? 'denied' : 'retrying');
      }
    });
  }

  function drop() {
    if (channel) void supabase.removeChannel(channel);
    channel = null;
  }

  connect();
  return {
    send(event, payload = {}) {
      if (!channel || closed) return;
      void channel.send({ type: 'broadcast', event, payload });
    },
    reconnect() {
      if (closed) return;
      drop();
      connect();
    },
    close() {
      closed = true;
      onStatus('closed');
      drop();
    },
  };
}

export const linkWords: Record<LinkStatus, string> = {
  connecting: 'Connecting',
  connected: 'Connected',
  retrying: 'Disconnected. Trying again',
  denied: "The remote isn't allowed yet",
  closed: 'Closed',
};
