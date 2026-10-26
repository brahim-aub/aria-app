# Brancher Supabase (comptes utilisateurs)

Sans configuration, l'app reste en mode local, sans écran de connexion.

1. **Créer le projet** sur https://supabase.com, région **Europe** (par exemple Paris ou Francfort). Les données de santé (douleurs) restent ainsi dans l'UE.
2. **Créer la table** : dans *SQL Editor > New query*, colle le contenu de [`schema.sql`](schema.sql), puis clique sur *Run*.
3. **E-mails** : sans SMTP personnel, Supabase envoie ses modèles par défaut, qu'on ne peut pas modifier.
   - **Inscription** : l'e-mail contient un lien. L'utilisateur clique dessus, revient dans l'app, puis appuie sur « J'ai confirmé, me connecter ».
   - **Mot de passe oublié** : l'app attend un code à 6 chiffres. Il faut donc un SMTP (Brevo ou Resend, gratuits), puis ajouter `{{ .Token }}` dans le modèle *Reset password*.
4. **Mots de passe** : dans *Authentication > Providers > Email*, mets la longueur minimale à 8 caractères (l'app l'exige déjà).
5. **Clés** : dans *Project Settings > API*, copie dans `.env` :
   - `EXPO_PUBLIC_SUPABASE_URL` : la *Project URL* ;
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` : la clé **anon** (ou *publishable*).

   N'utilise **jamais** la clé `service_role` (ou *secret*) : elle donnerait accès à toutes les données.
6. **Redémarre** `npx expo start`. Les variables `EXPO_PUBLIC_` sont lues au démarrage.

L'envoi d'e-mails intégré à Supabase est limité à quelques messages par heure. Avant la bêta, branche un SMTP (par exemple Brevo ou Resend) dans *Authentication > Emails > SMTP Settings*.

## Fonctionnement

- Table `user_data` : une ligne par compte, qui contient tout l'état de l'app au format JSON. La RLS garantit que chacun ne lit et n'écrit que sa propre ligne.
- **À la connexion et à chaque démarrage** :
  - des changements du téléphone jamais envoyés (hors connexion, app fermée trop tôt) partent en priorité ;
  - sinon, les données du compte remplacent celles du téléphone ;
  - un compte vide demande s'il faut reprendre les données du téléphone.
- **Ensuite** : chaque changement est envoyé environ 1,5 s plus tard, et tout de suite quand l'app passe en arrière-plan.
- **La clé Gemini personnelle** (Réglages) n'est jamais envoyée au cloud.
- **Déconnexion** : les données du compte sont retirées du téléphone.
- **Suppression du compte** : la fonction `delete_my_account()` efface le compte et ses données (RGPD).

## Relais Gemini, quotas et cache de prix

1. Exécute [`ai.sql`](ai.sql) dans le *SQL Editor* : consommation IA, réglages à distance et cache de prix partagé.
2. Déploie la fonction [`functions/gemini/index.ts`](functions/gemini/index.ts) : *Edge Functions > Deploy a new function > Via Editor*, nom `gemini`.
3. Ajoute le secret **`GEMINI_API_KEY`** : *Edge Functions > Secrets*. Utilise de préférence une clé neuve, car l'ancienne a circulé.
4. Une fois que le coach fonctionne via ton compte, retire `EXPO_PUBLIC_GEMINI_API_KEY` du `.env` : la clé ne sera plus dans l'APK.

**Réglages à distance**, sans republier l'app : modifie la ligne `ai` de la table `app_config`.
- `enabled: false` met le coach en pause.
- `prices_enabled: false` coupe la recherche de prix.
- `daily_limits` fixe le nombre d'appels par jour et par utilisateur (`chat`, `meal`, `prices`, `test`).

**Coût réel** : la table `ai_usage` donne les appels, les tokens et les recherches Google par utilisateur et par jour.

```sql
select day, kind, sum(calls) appels, sum(tokens_in) entree, sum(tokens_out) sortie, sum(searches) recherches
from ai_usage group by day, kind order by day desc;
```

**Cache de prix** (`price_cache`) : une ligne par enseigne et par produit, partagée entre tous les utilisateurs.
- Un prix relevé en ligne sert à tout le monde pendant **7 jours**.
- Un produit cherché sans succès dans une enseigne (`{"missing": true}`) n'est pas recherché à nouveau pendant **3 jours**.
- Les noms sont normalisés (`productKey`, `storeKey` dans `src/lib/prices.ts`). « Riz basmati cru 1 kg » et « riz basmati » partagent la même ligne, et « Leclerc » vaut « E.Leclerc ». En revanche, « fromage blanc 0 % » et « 20 % » restent deux produits distincts.
- N'importe quel compte connecté peut y écrire. Si des abus apparaissent, il faudra faire écrire le cache par l'Edge Function uniquement.
- Les appels refusés par Google ne comptent pas dans le quota du jour (`ai_refund_quota`).

### Plafonds par requête du relais Gemini

Le serveur lit au maximum **256 Kio** par requête, avec **32 messages** au plus et du texte uniquement. Les corps trop volumineux ou invalides sont refusés avant la prise de quota.

Une seule réponse est générée, avec les plafonds `maxOutputTokens` suivants :
- conversation : **8 192** ;
- menus : **24 576** (plan sur sept jours) ;
- prix : **4 096** ;
- test : **1 024**.

Une limite demandée plus basse est respectée. Le client ne peut pas augmenter les plafonds ni demander de sortie image/audio ou faire charger un contenu distant. La recherche Google reste réservée aux prix.

Le corps reçu de Google est limité à **2 Mio**. Une réponse arrêtée à sa limite de tokens est signalée avec `OUTPUT_LIMIT`, afin de ne pas renvoyer un JSON tronqué ou relancer automatiquement d'autres modèles. Cet appel conserve son quota et sa consommation : il a déjà sollicité Gemini.

Ces limites bornent chaque appel ; elles ne constituent pas un budget financier mensuel global. Une requête refusée avant la prise de quota ne lance aucun appel Google.
