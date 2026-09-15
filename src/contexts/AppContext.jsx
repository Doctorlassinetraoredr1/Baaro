import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const AppContext = createContext();

const GUEST_KEY = 'baaro_is_guest';

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isGuest, setIsGuest] = useState(() => {
    try {
      return localStorage.getItem(GUEST_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async (id) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      setProfile(data);
    } catch (err) {
      console.error('Erreur chargement profil:', err);
      setProfile(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!mounted) return;

        if (session?.user) {
          setUser(session.user);
          setIsGuest(false);

          try {
            localStorage.setItem(GUEST_KEY, 'false');
          } catch {
            // localStorage indisponible
          }

          fetchUserProfile(session.user.id);
        } else {
          let storedGuest = false;

          try {
            storedGuest =
              localStorage.getItem(GUEST_KEY) === 'true';
          } catch {
            storedGuest = false;
          }

          setIsGuest(storedGuest);
          setUser(null);
          setProfile(null);
        }

        setLoading(false);
      })
      .catch((error) => {
        console.error(
          'Erreur récupération session:',
          error
        );

        if (mounted) {
          setLoading(false);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        if (session?.user) {
          setUser(session.user);
          setIsGuest(false);

          try {
            localStorage.setItem(GUEST_KEY, 'false');
          } catch {
            // localStorage indisponible
          }

          await fetchUserProfile(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
        }

        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const enableGuestMode = () => {
    try {
      localStorage.setItem(GUEST_KEY, 'true');
    } catch {
      // Le mode invité reste actif pendant la session.
    }

    setIsGuest(true);
    setUser(null);
    setProfile(null);
  };

  const logout = async () => {
    try {
      localStorage.removeItem(GUEST_KEY);
    } catch {
      // Rien à faire.
    }

    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Erreur déconnexion:', error);
    }

    setIsGuest(false);
    setUser(null);
    setProfile(null);
  };

  return (
    <AppContext.Provider
      value={{
        user,
        profile,
        isGuest,
        loading,
        enableGuestMode,
        logout,
        setProfile,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);

export default AppContext;
