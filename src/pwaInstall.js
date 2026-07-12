export function isStandaloneApp() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export function getInstallHint() {
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  if (isStandaloneApp()) return '';
  if (isIOS) return 'To hide the address bar on iPhone: open in Safari, tap Share, tap Add to Home Screen, then open ASR Iron from the Home Screen icon.';
  return 'To hide the address bar: install ASR Iron from the browser install prompt, then open it from the app icon.';
}
