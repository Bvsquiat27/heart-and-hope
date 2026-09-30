/**
 * Live sync config for Postpartum Ember.
 *
 * Preferred: public REST API (restBaseUrl) — works from GitHub Pages + APK WebView.
 * Optional: Firebase RTDB when configured:true with a real project.
 *
 * Never put baby-tracker / personal schedule data on the public store.
 */
window.HEART_FIREBASE = {
  configured: false,
  apiKey: "",
  authDomain: "",
  databaseURL: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
  /* Public Ember REST API (CORS *). */
  restBaseUrl: "https://hearth-ember-api.hearthandhope.workers.dev"
};
