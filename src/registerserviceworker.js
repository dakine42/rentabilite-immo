export function registerSW() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/service-worker.js")
        .then((reg) => {
          console.log("✅ Service Worker enregistré :", reg.scope);
        })
        .catch((err) => {
          console.warn("❌ Échec Service Worker :", err);
        });
    });
  }
}