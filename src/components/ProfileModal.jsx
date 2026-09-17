const handleFriendRequest = async () => {
    // 1. Vérifier les conditions de base
    if (!currentUserId || !authorId || currentUserId === authorId || friendLoading) {
      alert(`⚠️ BLOQUÉ :\n- currentUserId: ${currentUserId || "VIDE"}\n- authorId: ${authorId || "VIDE"}\n- friendLoading: ${friendLoading}`);
      return;
    }
    
    setFriendLoading(true);
    try {
      alert(`📤 Envoi de la demande d'ami à : ${authorId}`);
      
      const { data, error } = await sendFriendRequest(authorId);
      
      if (error) {
        alert(`❌ ERREUR SUPABASE :\n${error.message}\n\nDétails: ${JSON.stringify(error)}`);
        throw error;
      }
      
      alert(`✅ SUCCÈS !\nDonnées reçues: ${JSON.stringify(data)}`);
      showToast("Demande d'ami envoyée", "success");
      
    } catch (error) {
      console.error("Erreur demande d'ami:", error);
      alert(`❌ ÉCHEC FINAL :\n${error.message}`);
      showToast("Impossible d'envoyer la demande d'ami", "error");
    } finally {
      setFriendLoading(false);
    }
  };
