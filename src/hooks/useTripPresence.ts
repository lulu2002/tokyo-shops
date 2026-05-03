import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { PresenceUser } from '../types/trip';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function useTripPresence(
  tripId: string | null,
  enabled: boolean,
  currentUser: { userId: string; displayName: string; avatarUrl: string } | null,
): PresenceUser[] {
  const [editors, setEditors] = useState<PresenceUser[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!tripId || !enabled || !currentUser) {
      setEditors([]);
      return;
    }

    const channel = supabase.channel(`trip-presence:${tripId}`);

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceUser>();
        const users: PresenceUser[] = [];
        const seen = new Set<string>();
        for (const presences of Object.values(state)) {
          for (const p of presences) {
            if (!seen.has(p.userId)) {
              seen.add(p.userId);
              users.push({
                userId: p.userId,
                displayName: p.displayName,
                avatarUrl: p.avatarUrl,
              });
            }
          }
        }
        setEditors(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId: currentUser.userId,
            displayName: currentUser.displayName,
            avatarUrl: currentUser.avatarUrl,
          });
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [tripId, enabled, currentUser?.userId]);

  return editors;
}
