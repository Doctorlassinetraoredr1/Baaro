# Système de Débat Baaro

## Architecture d'Identification

Le système utilise désormais **un seul identifiant unique** (`id`) pour toutes les opérations, sans dépendance à `user_id` ou `auth.uid()`.

### Avantages
- ✅ Flexibilité : accepte UUID, chaînes personnalisées, IDs de session
- ✅ Simplicité : une seule colonne d'identité par table
- ✅ Performance : pas de jointures vers auth.users
- ✅ Portabilité : fonctionne hors Supabase Auth

### Structure des Tables

#### debate_rooms
- `host_id` (TEXT) : ID de l'hôte (n'importe quel format)
- `co_hosts` (TEXT[]) : Liste des co-hôtes

#### debate_messages
- `sender_id` (TEXT) : ID de l'expéditeur
- ⚠️ Plus de colonne `user_id` (supprimée)

#### debate_participants
- `user_id` (TEXT) : ID du participant

#### debate_role_requests
- `from_user_id` (TEXT) : ID de l'expéditeur
- `to_user_id` (TEXT) : ID du destinataire

### Sécurité

Les politiques RLS vérifient l'appartenance via :
1. Comparaison directe avec `auth.uid()::TEXT` (si authentifié)
2. Vérification de présence dans `debate_participants`
3. Accès total pour `service_role` (API backend)

### Migration des Données

Les données existantes (UUID) ont été automatiquement converties en TEXT sans perte.
