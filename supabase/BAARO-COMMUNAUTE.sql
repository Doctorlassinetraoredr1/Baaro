-- ============================================================
-- BAARO — COMMUNAUTÉ
-- Groupes façon Facebook + Canaux façon Telegram
-- Sécurisation RLS
-- ============================================================

-- ------------------------------------------------------------
-- 1. ACTIVER RLS
-- ------------------------------------------------------------

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_participants ENABLE ROW LEVEL SECURITY;


-- ------------------------------------------------------------
-- 2. SUPPRIMER LES POLICIES TROP OUVERTES / ANCIENNES
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "all" ON public.groups;
DROP POLICY IF EXISTS "groups_insert" ON public.groups;
DROP POLICY IF EXISTS "groups_select" ON public.groups;
DROP POLICY IF EXISTS "groups_update_owner" ON public.groups;

DROP POLICY IF EXISTS "all" ON public.channels;

DROP POLICY IF EXISTS "all" ON public.channel_messages;

DROP POLICY IF EXISTS "all" ON public.group_roles;

DROP POLICY IF EXISTS "all" ON public.voice_participants;

DROP POLICY IF EXISTS "Permettre l'insertion de membres" ON public.group_members;
DROP POLICY IF EXISTS "Permettre la lecture des membres" ON public.group_members;
DROP POLICY IF EXISTS "Permettre la suppression" ON public.group_members;


-- ============================================================
-- GROUPES
-- ============================================================

-- ------------------------------------------------------------
-- Lecture des groupes
--
-- Groupe public :
--     visible par tous
--
-- Groupe privé :
--     visible uniquement par ses membres
-- ------------------------------------------------------------

CREATE POLICY "community_groups_select"
ON public.groups
FOR SELECT
TO authenticated
USING (
  is_public = true
  OR owner_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = groups.id
      AND gm.user_id = auth.uid()
  )
);


-- ------------------------------------------------------------
-- Création d'un groupe
-- ------------------------------------------------------------

CREATE POLICY "community_groups_insert"
ON public.groups
FOR INSERT
TO authenticated
WITH CHECK (
  owner_id = auth.uid()
);


-- ------------------------------------------------------------
-- Modification du groupe
-- propriétaire ou administrateur
-- ------------------------------------------------------------

CREATE POLICY "community_groups_update"
ON public.groups
FOR UPDATE
TO authenticated
USING (
  owner_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = groups.id
      AND gm.user_id = auth.uid()
      AND gm.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  owner_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = groups.id
      AND gm.user_id = auth.uid()
      AND gm.role IN ('owner', 'admin')
  )
);


-- ------------------------------------------------------------
-- Suppression d'un groupe
-- propriétaire uniquement
-- ------------------------------------------------------------

CREATE POLICY "community_groups_delete"
ON public.groups
FOR DELETE
TO authenticated
USING (
  owner_id = auth.uid()
);


-- ============================================================
-- MEMBRES
-- ============================================================

-- ------------------------------------------------------------
-- Voir les membres d'un groupe
-- uniquement si l'utilisateur appartient au groupe
-- ------------------------------------------------------------

CREATE POLICY "community_members_select"
ON public.group_members
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.groups g
    WHERE g.id = group_members.group_id
      AND (
        g.is_public = true
        OR g.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.group_members me
          WHERE me.group_id = g.id
            AND me.user_id = auth.uid()
        )
      )
  )
);


-- ------------------------------------------------------------
-- Rejoindre un groupe public soi-même
--
-- ou être ajouté par owner/admin
-- ------------------------------------------------------------

CREATE POLICY "community_members_insert"
ON public.group_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.groups g
    WHERE g.id = group_members.group_id
      AND g.is_public = true
  )
  OR
  EXISTS (
    SELECT 1
    FROM public.group_members me
    WHERE me.group_id = group_members.group_id
      AND me.user_id = auth.uid()
      AND me.role IN ('owner', 'admin')
  )
);


-- ------------------------------------------------------------
-- Quitter le groupe soi-même
--
-- ou suppression par owner/admin
-- ------------------------------------------------------------

CREATE POLICY "community_members_delete"
ON public.group_members
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.group_members me
    WHERE me.group_id = group_members.group_id
      AND me.user_id = auth.uid()
      AND me.role IN ('owner', 'admin')
  )
);


-- ------------------------------------------------------------
-- Modifier un rôle
-- owner/admin uniquement
-- ------------------------------------------------------------

CREATE POLICY "community_members_update"
ON public.group_members
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.group_members me
    WHERE me.group_id = group_members.group_id
      AND me.user_id = auth.uid()
      AND me.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.group_members me
    WHERE me.group_id = group_members.group_id
      AND me.user_id = auth.uid()
      AND me.role IN ('owner', 'admin')
  )
);


-- ============================================================
-- CANAUX — MODÈLE TELEGRAM
-- ============================================================

-- ------------------------------------------------------------
-- Lire les canaux d'un groupe auquel on appartient
-- ------------------------------------------------------------

CREATE POLICY "community_channels_select"
ON public.channels
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = channels.group_id
      AND gm.user_id = auth.uid()
  )
);


-- ------------------------------------------------------------
-- Créer un canal
-- owner/admin uniquement
-- ------------------------------------------------------------

CREATE POLICY "community_channels_insert"
ON public.channels
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = channels.group_id
      AND gm.user_id = auth.uid()
      AND gm.role IN ('owner', 'admin')
  )
);


-- ------------------------------------------------------------
-- Modifier un canal
-- owner/admin
-- ------------------------------------------------------------

CREATE POLICY "community_channels_update"
ON public.channels
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = channels.group_id
      AND gm.user_id = auth.uid()
      AND gm.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = channels.group_id
      AND gm.user_id = auth.uid()
      AND gm.role IN ('owner', 'admin')
  )
);


-- ------------------------------------------------------------
-- Supprimer un canal
-- owner/admin
-- ------------------------------------------------------------

CREATE POLICY "community_channels_delete"
ON public.channels
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = channels.group_id
      AND gm.user_id = auth.uid()
      AND gm.role IN ('owner', 'admin')
  )
);


-- ============================================================
-- MESSAGES — CANAUX
-- ============================================================

-- ------------------------------------------------------------
-- Lire les messages
-- uniquement les membres du groupe
-- ------------------------------------------------------------

CREATE POLICY "community_messages_select"
ON public.channel_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.channels c
    JOIN public.group_members gm
      ON gm.group_id = c.group_id
    WHERE c.id = channel_messages.channel_id
      AND gm.user_id = auth.uid()
  )
);


-- ------------------------------------------------------------
-- Envoyer un message
-- l'auteur doit être membre du groupe
-- ------------------------------------------------------------

CREATE POLICY "community_messages_insert"
ON public.channel_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.channels c
    JOIN public.group_members gm
      ON gm.group_id = c.group_id
    WHERE c.id = channel_messages.channel_id
      AND gm.user_id = auth.uid()
  )
);


-- ------------------------------------------------------------
-- Modifier son propre message
-- ------------------------------------------------------------

CREATE POLICY "community_messages_update"
ON public.channel_messages
FOR UPDATE
TO authenticated
USING (
  sender_id = auth.uid()
)
WITH CHECK (
  sender_id = auth.uid()
);


-- ------------------------------------------------------------
-- Supprimer son propre message
-- ------------------------------------------------------------

CREATE POLICY "community_messages_delete"
ON public.channel_messages
FOR DELETE
TO authenticated
USING (
  sender_id = auth.uid()
);


-- ============================================================
-- RÔLES PERSONNALISÉS
-- ============================================================

-- ------------------------------------------------------------
-- Lire les rôles
-- membres du groupe
-- ------------------------------------------------------------

CREATE POLICY "community_roles_select"
ON public.group_roles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = group_roles.group_id
      AND gm.user_id = auth.uid()
  )
);


-- ------------------------------------------------------------
-- Créer un rôle
-- owner/admin
-- ------------------------------------------------------------

CREATE POLICY "community_roles_insert"
ON public.group_roles
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = group_roles.group_id
      AND gm.user_id = auth.uid()
      AND gm.role IN ('owner', 'admin')
  )
);


-- ------------------------------------------------------------
-- Modifier un rôle
-- owner/admin
-- ------------------------------------------------------------

CREATE POLICY "community_roles_update"
ON public.group_roles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = group_roles.group_id
      AND gm.user_id = auth.uid()
      AND gm.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = group_roles.group_id
      AND gm.user_id = auth.uid()
      AND gm.role IN ('owner', 'admin')
  )
);


-- ------------------------------------------------------------
-- Supprimer un rôle
-- owner/admin
-- ------------------------------------------------------------

CREATE POLICY "community_roles_delete"
ON public.group_roles
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = group_roles.group_id
      AND gm.user_id = auth.uid()
      AND gm.role IN ('owner', 'admin')
  )
);


-- ============================================================
-- VOICE
-- ============================================================

-- ------------------------------------------------------------
-- Voir les participants
-- membres du groupe
-- ------------------------------------------------------------

CREATE POLICY "community_voice_select"
ON public.voice_participants
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.channels c
    JOIN public.group_members gm
      ON gm.group_id = c.group_id
    WHERE c.id = voice_participants.channel_id
      AND c.type = 'voice'
      AND gm.user_id = auth.uid()
  )
);


-- ------------------------------------------------------------
-- Entrer dans un vocal
-- soi-même uniquement
-- ------------------------------------------------------------

CREATE POLICY "community_voice_insert"
ON public.voice_participants
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.channels c
    JOIN public.group_members gm
      ON gm.group_id = c.group_id
    WHERE c.id = voice_participants.channel_id
      AND c.type = 'voice'
      AND gm.user_id = auth.uid()
  )
);


-- ------------------------------------------------------------
-- Quitter le vocal
-- soi-même
-- ------------------------------------------------------------

CREATE POLICY "community_voice_delete"
ON public.voice_participants
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
);


-- ------------------------------------------------------------
-- Mise à jour de son propre état vocal
-- ------------------------------------------------------------

CREATE POLICY "community_voice_update"
ON public.voice_participants
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
)
WITH CHECK (
  user_id = auth.uid()
);
