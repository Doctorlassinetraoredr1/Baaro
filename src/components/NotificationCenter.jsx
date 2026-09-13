import React, { useEffect, useState } from 'react';
import { Bell, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';

/** Drop-in notification center. Expects an authenticated Supabase client. */
export default function NotificationCenter({ onOpen }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    if (!error) setItems(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const channel = supabase.channel('baaro-notifications-ui')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' },
        payload => setItems(prev => [payload.new, ...prev].slice(0, 30)))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function markAll() {
    const ids = items.filter(x => !x.read_at).map(x => x.id);
    if (!ids.length) return;
    await supabase.rpc('mark_notifications_read', { p_ids: ids });
    setItems(prev => prev.map(x => ({ ...x, read_at: x.read_at || new Date().toISOString() })));
  }

  const unread = items.filter(x => !x.read_at).length;
  return <div className="relative">
    <button aria-label="Notifications" onClick={() => { setOpen(v => !v); if (!open) load(); }} className="relative">
      <Bell size={20} />
      {unread > 0 && <span className="absolute -right-2 -top-2 min-w-5 rounded-full px-1 text-xs">{unread > 99 ? '99+' : unread}</span>}
    </button>
    {open && <div className="absolute right-0 z-50 mt-2 w-80 max-w-[92vw] rounded-xl border bg-white shadow-xl">
      <div className="flex items-center justify-between border-b p-3">
        <strong>Notifications</strong>
        <button onClick={markAll} disabled={!unread} title="Tout marquer comme lu"><Check size={18} /></button>
      </div>
      <div className="max-h-96 overflow-auto">
        {loading && <div className="p-4 text-sm">Chargement…</div>}
        {!loading && !items.length && <div className="p-4 text-sm opacity-70">Aucune notification</div>}
        {items.map(n => <button key={n.id} onClick={() => onOpen?.(n)} className="block w-full border-b p-3 text-left">
          <div className="text-sm">{n.message || n.title || n.type || 'Nouvelle notification'}</div>
          <div className="mt-1 text-xs opacity-60">{new Date(n.created_at).toLocaleString()}</div>
        </button>)}
      </div>
    </div>}
  </div>;
}
