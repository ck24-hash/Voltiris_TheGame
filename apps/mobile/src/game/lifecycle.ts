/** Tells the game when the app goes to the background and comes back. */
export interface AppLifecycle {
  /** Returns a function that stops listening. */
  onHide(listener: () => void): () => void;
  onShow(listener: () => void): () => void;
}

/** Page visibility: hidden when the app is sent to the background or closed. */
export const pageLifecycle: AppLifecycle = {
  onHide: (listener) => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') listener();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', listener);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', listener);
    };
  },
  onShow: (listener) => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') listener();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  },
};
