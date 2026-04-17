import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

// Remove static HTML boot overlay once the web bundle has had a frame to paint.
if (typeof window !== 'undefined') {
  const removeBoot = () => {
    const fn = (window as unknown as { __ledgerlineRemoveBoot?: () => void }).__ledgerlineRemoveBoot;
    fn?.();
  };
  try {
    const stored = window.localStorage.getItem('ledgerline/theme-mode');
    const mode = stored === 'light' || stored === 'dark' ? stored : 'dark';
    const boot = document.getElementById('ledgerline-boot');
    if (boot && mode === 'light') {
      boot.classList.add('boot-light');
    }
  } catch {
    // ignore
  }
  requestAnimationFrame(() => requestAnimationFrame(removeBoot));
  setTimeout(removeBoot, 800);
}
