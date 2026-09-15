import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const AppContext = createContext();

const GUEST_KEY = 'baaro_is_guest';

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isGuest, setIsGuest] = useState(() => localStorage.getItem(GUEST_KEY) === 'true');
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) throw error;
      setProfile(data);
    } catch (err) {
      console.error('Erreur chargement profil:', err);
    }
  };

  useEffect(() => {
    // Vérification initiale de la session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        setIsGuest(false);
        localStorage.setItem(GUEST_KEY, 'false');
        fetchUserProfile(session.user.id);
      } else {
        const storedGuest = localStorage.getItem(GUEST_KEY) === 'true';
        setIsGuest(storedGuest);
      }
      setLoading(false);
    });

    // Écouteur des changements d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        setIsGuest(false);
        localStorage.setItem(GUEST_KEY, 'false');
        await fetchUserProfile(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  const enableGuestMode = () => {
    localStorage.setItem(GUEST_KEY, 'true');
    setIsGuest(true);
    setUser(null);
    setProfile(null);
  };

  const logout = async () => {
    localStorage.removeItem(GUEST_KEY);
    await supabase.auth.signOut();
    setIsGuest(false);
    setUser(null);
    setProfile(null);
  };

  return (
    <AppContext.Provider value={{ user, profile, isGuest, loading, enableGuestMode, logout, setProfile }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
