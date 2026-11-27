/**
 * Canonical cross-runtime platform capability classifier.
 *
 * Single source of truth for Smart TV (LG webOS, Samsung Tizen, Sony Bravia,
 * Hisense VIDAA, Android TV), iPadOS (including MacIntel + touch PWA mode),
 * iPhone/Android phones, Car widescreen mode, and Desktop browsers.
 *
 * Pure classification (`classifyPlatform`, `isSmartTvUserAgent`) has zero DOM
 * dependencies so it runs identically in browser, Node/QNAP server, and tests.
 */

export const SMART_TV_UA_REGEX =
  /Web0S|WebOS|NetCast|SmartTV|SMART-TV|Tizen|Large Screen|MSX|BRAVIA|Sony|CE-HTML|Vewd|Opera TV|InettvBrowser|HbbTV|VIDAA|Hisense|Viera|Philips|Android TV|GoogleTV|GTV|ADT-|AFT[A-Z0-9]*|MIBOX|SHIELD|Chromecast|CrKey|TV Bro|BrowseHere|Odin|Puffin.*TV|TCL|KD-[0-9]{2}[A-Z0-9]*|XR-[0-9]{2}[A-Z0-9]*|XBR-[0-9]{2}[A-Z0-9]*|K-[0-9]{2}[A-Z0-9]*|X80[A-Z]|X85[A-Z]|X90[A-Z]|X95[A-Z]|A80[A-Z]|A90[A-Z]|A95[A-Z]/i;

export const MOBILE_PHONE_UA_REGEX =
  /iPhone|iPod|Android.*Mobile|Windows Phone/i;

export const PRIVATE_LAN_HOST_REGEX =
  /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/;

export type PlatformDeviceClass =
  | 'hardware-tv'
  | 'tv-web'
  | 'car'
  | 'phone'
  | 'tablet'
  | 'desktop';

export interface PlatformFacts {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
  innerWidth?: number;
  innerHeight?: number;
  screenWidth?: number;
  screenHeight?: number;
  coarsePointer?: boolean;
  hoverNone?: boolean;
  pathname?: string;
  search?: string;
  hostname?: string;
  isSmartTvGlobalFlag?: boolean;
  hasSmartTvClass?: boolean;
  hasHardwareTvClass?: boolean;
  hasCarModeClass?: boolean;
  hasIpadPwaClass?: boolean;
  hasIosPwaClass?: boolean;
}

export interface PlatformCapabilities {
  deviceClass: PlatformDeviceClass;
  isExplicitTvUa: boolean;
  isHardwareTv: boolean;
  isSmartTv: boolean;
  isCarMode: boolean;
  isIpadTablet: boolean;
  isTablet: boolean;
  isMobilePhone: boolean;
  isTabletOrMobile: boolean;
  isIosWebKit: boolean;
  isPrivateLanHost: boolean;
  supportsBackdropBlur: boolean;
  preferredMaxQuality: '1080' | '4k';
  defaultSubFontPx: number;
  deviceDisplayName: string;
}

/**
 * Server-side & UA-only Smart TV / non-mobile Android client check.
 * Used by QNAP stream server to cap 4K streams to 1080p for TVs and Android non-phone devices.
 */
export function isSmartTvUserAgent(userAgent: string): boolean {
  const ua = String(userAgent || '');
  if (!ua) return false;
  return (
    SMART_TV_UA_REGEX.test(ua) ||
    (/Android/i.test(ua) && !/Mobile/i.test(ua))
  );
}

/**
 * Pure, DOM-free platform classification from explicit runtime facts.
 */
export function classifyPlatform(facts: PlatformFacts): PlatformCapabilities {
  const ua = String(facts.userAgent || '');
  const platform = String(facts.platform || '');
  const maxTouchPoints = Number(facts.maxTouchPoints || 0);
  const innerWidth = Number(facts.innerWidth || 0);
  const innerHeight = Number(facts.innerHeight || 0);
  const screenWidth = Number(facts.screenWidth || innerWidth || 0);
  const screenHeight = Number(facts.screenHeight || innerHeight || 0);
  const pathname = String(facts.pathname || '').toLowerCase();
  const hostname = String(facts.hostname || '').toLowerCase();

  let hasCarQueryParam = false;
  if (facts.search) {
    try {
      const params = new URLSearchParams(facts.search);
      hasCarQueryParam = params.get('car') === '1' || params.get('gle') === '1';
    } catch {
      // ignore malformed search string
    }
  }

  const isExplicitTvUa = SMART_TV_UA_REGEX.test(ua);
  const isAndroidNonMobile = /Android/i.test(ua) && !/Mobile/i.test(ua);
  const aspect =
    screenWidth > 0 && screenHeight > 0
      ? Math.max(screenWidth, screenHeight) /
        Math.max(1, Math.min(screenWidth, screenHeight))
      : 0;
  const isAndroidTvBox =
    isAndroidNonMobile && aspect >= 1.7 && maxTouchPoints === 0;

  const isHardwareTv =
    Boolean(facts.hasHardwareTvClass) || isExplicitTvUa || isAndroidTvBox;

  const isCarMode =
    Boolean(facts.hasCarModeClass) ||
    pathname === '/car' ||
    pathname.startsWith('/car/') ||
    hasCarQueryParam;

  const isPhoneUa = !isExplicitTvUa && MOBILE_PHONE_UA_REGEX.test(ua);

  const isIpadTablet =
    !isHardwareTv &&
    !isPhoneUa &&
    (/iPad/i.test(ua) ||
      ((platform === 'MacIntel' || /Macintosh/i.test(ua)) &&
        maxTouchPoints > 1) ||
      Boolean(facts.hasIpadPwaClass));

  const isAndroidTablet =
    !isHardwareTv && !isCarMode && isAndroidNonMobile && !isAndroidTvBox;

  const isTablet = isIpadTablet || isAndroidTablet;

  const isSmartTv =
    !isPhoneUa &&
    (isHardwareTv ||
      Boolean(facts.isSmartTvGlobalFlag) ||
      Boolean(facts.hasSmartTvClass));

  let isMobilePhone = false;
  if (!isCarMode && !isHardwareTv && !isTablet) {
    if (isPhoneUa || (!isExplicitTvUa && /Mobile Safari/i.test(ua))) {
      isMobilePhone = true;
    } else if (!isSmartTv) {
      const isTouchDevice =
        (maxTouchPoints > 1 || Boolean(facts.coarsePointer)) &&
        Boolean(facts.hoverNone);
      if (isTouchDevice && innerWidth > 0 && innerWidth < 768) {
        isMobilePhone = true;
      } else if (
        innerWidth > 0 &&
        (innerWidth < 768 ||
          (innerHeight > 0 && innerHeight <= 540 && innerWidth <= 980))
      ) {
        isMobilePhone = true;
      }
    }
  }

  const isTabletOrMobile =
    !isHardwareTv &&
    (isTablet ||
      isPhoneUa ||
      /iPhone|iPod|iPad|Android|Mobile/i.test(ua) ||
      Boolean(facts.hasIpadPwaClass) ||
      Boolean(facts.hasIosPwaClass));

  const isIosWebKit = isIpadTablet || /iPhone|iPod/i.test(ua);
  const isPrivateLanHost = PRIVATE_LAN_HOST_REGEX.test(hostname);
  const supportsBackdropBlur = !isHardwareTv;
  const preferredMaxQuality: '1080' | '4k' = isTabletOrMobile ? '1080' : '4k';

  let defaultSubFontPx = 26;
  if (isHardwareTv) {
    defaultSubFontPx = 32;
  } else if (isPhoneUa || isMobilePhone) {
    defaultSubFontPx = 16;
  } else if (isTabletOrMobile) {
    defaultSubFontPx = 22;
  }

  let deviceDisplayName = 'Dispozitiv Web';
  if (isHardwareTv) {
    deviceDisplayName = 'Smart TV';
  } else if (isIpadTablet) {
    deviceDisplayName = 'iPad';
  } else if (/iPhone|iPod/i.test(ua)) {
    deviceDisplayName = 'iPhone';
  } else if (/Android/i.test(ua)) {
    deviceDisplayName = /Mobile/i.test(ua)
      ? 'Telefon Android'
      : 'Tabletă Android';
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    deviceDisplayName = 'Mac / Laptop';
  } else if (/Windows|Linux/i.test(ua)) {
    deviceDisplayName = 'Laptop / PC';
  }

  let deviceClass: PlatformDeviceClass = 'desktop';
  if (isCarMode) {
    deviceClass = 'car';
  } else if (isHardwareTv) {
    deviceClass = 'hardware-tv';
  } else if (isPhoneUa || isMobilePhone) {
    deviceClass = 'phone';
  } else if (isTablet) {
    deviceClass = 'tablet';
  } else if (isSmartTv) {
    deviceClass = 'tv-web';
  }

  return {
    deviceClass,
    isExplicitTvUa,
    isHardwareTv,
    isSmartTv,
    isCarMode,
    isIpadTablet,
    isTablet,
    isMobilePhone,
    isTabletOrMobile,
    isIosWebKit,
    isPrivateLanHost,
    supportsBackdropBlur,
    preferredMaxQuality,
    defaultSubFontPx,
    deviceDisplayName,
  };
}

/**
 * Browser adapter that gathers live DOM/window/navigator facts and classifies them.
 * Safe to call in SSR/Node environments (returns safe desktop fallback).
 */
export function getCurrentPlatformCapabilities(): PlatformCapabilities {
  if (typeof window === 'undefined') {
    return classifyPlatform({ userAgent: '' });
  }
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const docEl =
    typeof document !== 'undefined' ? document.documentElement : undefined;

  return classifyPlatform({
    userAgent: nav?.userAgent || '',
    platform: nav?.platform || '',
    maxTouchPoints: nav?.maxTouchPoints || 0,
    innerWidth: window.innerWidth || 0,
    innerHeight: window.innerHeight || 0,
    screenWidth: window.screen?.width || 0,
    screenHeight: window.screen?.height || 0,
    coarsePointer: Boolean(window.matchMedia?.('(pointer: coarse)').matches),
    hoverNone: Boolean(window.matchMedia?.('(hover: none)').matches),
    pathname: window.location?.pathname || '',
    search: window.location?.search || '',
    hostname: window.location?.hostname || '',
    isSmartTvGlobalFlag: Boolean(
      (window as unknown as { __IS_SMART_TV_DEVICE__?: boolean })
        .__IS_SMART_TV_DEVICE__
    ),
    hasSmartTvClass: Boolean(docEl?.classList.contains('smart-tv-mode')),
    hasHardwareTvClass: Boolean(docEl?.classList.contains('hardware-tv-gpu')),
    hasCarModeClass: Boolean(docEl?.classList.contains('car-widescreen-mode')),
    hasIpadPwaClass: Boolean(docEl?.classList.contains('ipad-pwa-standalone')),
    hasIosPwaClass: Boolean(docEl?.classList.contains('ios-pwa-standalone')),
  });
}

export function isHardwareTvDevice(): boolean {
  return getCurrentPlatformCapabilities().isHardwareTv;
}

export function isIpadTabletDevice(): boolean {
  return getCurrentPlatformCapabilities().isIpadTablet;
}
