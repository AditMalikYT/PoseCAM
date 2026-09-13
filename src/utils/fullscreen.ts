// Mobile browsers require a user gesture before granting fullscreen access,
// so this utility must always be called from within a native event handler.

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
};

const getFsElement = (): FullscreenElement => document.documentElement as FullscreenElement;

export const enableFullscreen = (): void => {
  const elem = getFsElement();

  if (elem.requestFullscreen) {
    elem.requestFullscreen().catch((err: unknown) => {
      console.log('Fullscreen error:', err);
    });
  } else if (elem.webkitRequestFullscreen) {
    // Safari / older WebKit
    elem.webkitRequestFullscreen();
  } else if (elem.msRequestFullscreen) {
    // Legacy Edge / IE
    elem.msRequestFullscreen();
  }
};

export const isFullscreen = (): boolean =>
  !!(document.fullscreenElement ?? (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement);

export const exitFullscreen = (): void => {
  const doc = document as Document & {
    webkitExitFullscreen?: () => Promise<void> | void;
    msExitFullscreen?: () => Promise<void> | void;
  };
  if (doc.exitFullscreen) {
    doc.exitFullscreen().catch(() => {});
  } else if (doc.webkitExitFullscreen) {
    doc.webkitExitFullscreen();
  } else if (doc.msExitFullscreen) {
    doc.msExitFullscreen();
  }
};