// Config del proyecto Firebase "mp-gym-coach".
// (No es secreto: la config web de Firebase es pública por diseño; la seguridad
//  la dan las Security Rules, no el ocultar estas claves.)

export const firebaseConfig = {
  apiKey: "AIzaSyAJlTztlhnjryY8_XvXYIRbZ0FDIMPNwy8",
  // authDomain = dominio de Hosting (no el .firebaseapp.com) para que el login
  // por redirección funcione en móvil/Safari sin bloqueos de cookies de terceros.
  authDomain: "mp-gym-coach.web.app",
  projectId: "mp-gym-coach",
  storageBucket: "mp-gym-coach.firebasestorage.app",
  messagingSenderId: "230074230220",
  appId: "1:230074230220:web:d621e6551438ce78e96969",
};

// Versión del SDK de Firebase servida desde gstatic (sin bundler).
export const FIREBASE_SDK = "10.12.2";
