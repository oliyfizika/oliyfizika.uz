// E2E mock: firebase-app
const apps = [];
export function initializeApp(options = {}, name = "[DEFAULT]") {
  const app = { name, options };
  apps.push(app);
  return app;
}
export function getApp() { return apps[0] || initializeApp({}); }
export function getApps() { return apps.slice(); }
