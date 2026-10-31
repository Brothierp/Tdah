#!/usr/bin/env bash
# Met en place le mode cloud de Focus sur TON projet Supabase, en une commande :
#   bash scripts/setup-cloud.sh
#
# Le script :
#   1. te connecte à Supabase (une page web s'ouvre) ;
#   2. relie ce dossier à ton projet ;
#   3. crée les tables et les règles de sécurité (db push) ;
#   4. déploie la fonction serveur « family » ;
#   5. écrit le fichier .env avec l'adresse et la clé PUBLIQUE du projet ;
#   6. (optionnel) enregistre ces deux valeurs dans ton projet Expo pour les APK.
#
# Il ne touche jamais à la clé secrète, et peut être relancé sans risque.
set -euo pipefail
cd "$(dirname "$0")/.."

SB="npx --yes supabase@latest"
bold() { printf '\n\033[1m%s\033[0m\n' "$1"; }

command -v node >/dev/null || { echo "Node.js est nécessaire : https://nodejs.org (version LTS)."; exit 1; }

bold "1/6 · Connexion à Supabase (une page web va s'ouvrir)"
$SB login

bold "2/6 · Choix du projet"
$SB projects list
read -rp "Copie ici la « REFERENCE ID » de ton projet Focus : " REF
REF="$(echo "$REF" | tr -d '[:space:]')"
[[ "$REF" =~ ^[a-z0-9]{20}$ ]] || { echo "Cette référence ne ressemble pas à un identifiant Supabase (20 lettres/chiffres)."; exit 1; }

bold "3/6 · Liaison du dossier au projet (Supabase demande le mot de passe de la base, choisi à la création du projet)"
$SB link --project-ref "$REF"

bold "4/6 · Création des tables et des règles de sécurité"
$SB db push

bold "5/6 · Déploiement de la fonction serveur « family »"
# --no-verify-jwt est normal : la fonction vérifie elle-même qui l'appelle.
# --use-api : la fonction est préparée sur les serveurs de Supabase (pas besoin de Docker).
$SB functions deploy family --no-verify-jwt --use-api --project-ref "$REF"

bold "6/6 · Écriture du fichier .env"
KEYS_JSON="$($SB projects api-keys --project-ref "$REF" -o json)"
KEY="$(node scripts/pick-public-key.js "$KEYS_JSON")"
URL="https://$REF.supabase.co"
cat > .env <<EOF
# Généré par scripts/setup-cloud.sh — clé PUBLIQUE uniquement (jamais la clé secrète).
EXPO_PUBLIC_SUPABASE_URL=$URL
EXPO_PUBLIC_SUPABASE_KEY=$KEY
EOF
echo "✔ .env écrit ($URL)"

echo "Pour les APK, Expo doit aussi connaître ces valeurs (le projet doit déjà être relié : npx eas-cli@latest init)."
read -rp "Les enregistrer dans ton projet Expo maintenant ? (o/N) " EAS
if [[ "$EAS" =~ ^[oOyY] ]]; then
  for ENV in preview production; do
    npx --yes eas-cli@latest env:set "$ENV" --name EXPO_PUBLIC_SUPABASE_URL --value "$URL" --visibility plaintext --non-interactive
    npx --yes eas-cli@latest env:set "$ENV" --name EXPO_PUBLIC_SUPABASE_KEY --value "$KEY" --visibility plaintext --non-interactive
  done
  echo "✔ Variables enregistrées dans Expo (preview et production)"
fi

bold "C'est prêt ! Il reste 2 réglages à faire dans le tableau de bord Supabase :"
cat <<EOF
  https://supabase.com/dashboard/project/$REF/auth/providers
    → Email : pendant la phase de test, tu peux DÉSACTIVER « Confirm email »
      (sinon chaque adulte doit cliquer sur un lien reçu par e-mail).
  https://supabase.com/dashboard/project/$REF/auth/url-configuration
    → Site URL : mets l'adresse de ta page de confidentialité (ou https://expo.dev).

Ensuite : npx expo start   (l'app est en mode cloud)
     ou : npx eas-cli@latest build --profile preview --platform android   (APK pour les testeurs)
EOF
