// ============================================================================
// Configuration Firebase
// ----------------------------------------------------------------------------
// Tant que ces valeurs restent à "VOTRE_..._ICI", l'application fonctionne
// en mode local (les données sont sauvegardées uniquement sur cet appareil,
// via le stockage du navigateur).
//
// Pour activer la synchronisation en temps réel entre tous les appareils
// et tous les sites (Neau, Saint-Gaultier, Terrasson, Sauveterre), suivez
// les 5 minutes d'installation décrites dans README.md, puis collez ici
// les valeurs fournies par Firebase.
// ============================================================================

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCnSjWN9rfJ7hqiEIqLLEgTI2NT5xk3Vcc",
  authDomain: "sqcdp-a789a.firebaseapp.com",
  projectId: "sqcdp-a789a",
  storageBucket: "sqcdp-a789a.firebasestorage.app",
  messagingSenderId: "251060087248",
  appId: "1:251060087248:web:fe653ef105d9feae4ab1d5",
};

// ----------------------------------------------------------------------------
// Authentification : mot de passe unique partagé pour toute l'équipe de
// direction. Cet identifiant n'est jamais saisi par les utilisateurs (ils ne
// tapent que le mot de passe) — c'est juste la "clé technique" du compte
// partagé. Il doit correspondre EXACTEMENT au compte que vous créez dans
// Firebase Console → Authentication → Users → Add user.
// Vous pouvez le changer ici pour autre chose si vous préférez.
// ----------------------------------------------------------------------------
export const SHARED_LOGIN_EMAIL = "direction@safety-first.app";

export function isFirebaseConfigured() {
  return !FIREBASE_CONFIG.apiKey.includes("VOTRE_");
}
