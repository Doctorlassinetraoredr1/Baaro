-- Migration 014 : Un seul identifiant unique (id)
-- Date : 2026-09-18
-- Objectif : Supprimer toute dépendance à user_id et auth.uid()
-- pour permettre l'utilisation d'IDs personnalisés

-- Résumé des changements :
-- 1. Suppression des contraintes FK vers auth.users
-- 2. Conversion UUID → TEXT pour toutes les colonnes d'identité
-- 3. Suppression de la colonne redondante user_id dans debate_messages
-- 4. Réécriture des politiques RLS pour compatibilité TEXT

-- Voir le script complet exécuté dans l'historique SQL de Supabase
