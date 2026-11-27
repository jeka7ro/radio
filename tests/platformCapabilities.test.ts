import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyPlatform,
  isSmartTvUserAgent,
} from '../src/utils/platformCapabilities.ts';

test('LG webOS Smart TV 1080p classifies as hardware-tv with 32px subtitles and no backdrop blur', () => {
  const caps = classifyPlatform({
    userAgent:
      'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36 WebAppManager',
    innerWidth: 1920,
    innerHeight: 1080,
    screenWidth: 1920,
    screenHeight: 1080,
    maxTouchPoints: 0,
  });

  assert.equal(caps.deviceClass, 'hardware-tv');
  assert.equal(caps.isExplicitTvUa, true);
  assert.equal(caps.isHardwareTv, true);
  assert.equal(caps.isSmartTv, true);
  assert.equal(caps.isMobilePhone, false);
  assert.equal(caps.isTabletOrMobile, false);
  assert.equal(caps.supportsBackdropBlur, false);
  assert.equal(caps.defaultSubFontPx, 32);
  assert.equal(caps.preferredMaxQuality, '4k');
  assert.equal(caps.deviceDisplayName, 'Smart TV');
});

test('Sony Bravia model UA (KD-55X85J / Android) classifies as hardware-tv, never Android Tablet', () => {
  const ua =
    'Mozilla/5.0 (Linux; Android 10; KD-55X85J Build/QTG3.200305.006.S292) AppleWebKit/537.36 Chrome/91.0.4472.120 Safari/537.36';
  const caps = classifyPlatform({
    userAgent: ua,
    innerWidth: 1920,
    innerHeight: 1080,
    screenWidth: 1920,
    screenHeight: 1080,
    maxTouchPoints: 0,
  });

  assert.equal(caps.deviceClass, 'hardware-tv');
  assert.equal(caps.isHardwareTv, true);
  assert.equal(caps.isTablet, false);
  assert.equal(caps.isTabletOrMobile, false);
  assert.equal(caps.defaultSubFontPx, 32);
  assert.equal(caps.deviceDisplayName, 'Smart TV');
  assert.equal(isSmartTvUserAgent(ua), true);
});

test('Samsung Tizen and Hisense VIDAA UAs unify consistently across client and server', () => {
  const tizenUa =
    'Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.5) AppleWebKit/537.36 Chrome/85.0.4183.93 TV Safari/537.36';
  const hisenseUa =
    'Mozilla/5.0 (Linux; U; en-gb) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.182 Safari/537.36 VIDAA/6.0';

  for (const ua of [tizenUa, hisenseUa]) {
    const caps = classifyPlatform({
      userAgent: ua,
      innerWidth: 1920,
      innerHeight: 1080,
    });
    assert.equal(caps.isHardwareTv, true);
    assert.equal(caps.isSmartTv, true);
    assert.equal(caps.deviceDisplayName, 'Smart TV');
    assert.equal(caps.defaultSubFontPx, 32);
    assert.equal(isSmartTvUserAgent(ua), true);
  }
});

test('iPad Mini Landscape (MacIntel + maxTouchPoints=5, 1133x744) is tablet, NEVER phone (fixes regression)', () => {
  const caps = classifyPlatform({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    platform: 'MacIntel',
    maxTouchPoints: 5,
    innerWidth: 1133,
    innerHeight: 744,
    coarsePointer: true,
    hoverNone: true,
    hasIpadPwaClass: true,
  });

  assert.equal(caps.deviceClass, 'tablet');
  assert.equal(caps.isIpadTablet, true);
  assert.equal(caps.isTablet, true);
  assert.equal(caps.isMobilePhone, false);
  assert.equal(caps.isTabletOrMobile, true);
  assert.equal(caps.isIosWebKit, true);
  assert.equal(caps.defaultSubFontPx, 22);
  assert.equal(caps.preferredMaxQuality, '1080');
  assert.equal(caps.deviceDisplayName, 'iPad');
});

test('iPad Mini Portrait (744x1133) also stays tablet (not mobile phone)', () => {
  const caps = classifyPlatform({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    platform: 'MacIntel',
    maxTouchPoints: 5,
    innerWidth: 744,
    innerHeight: 1133,
    coarsePointer: true,
    hoverNone: true,
  });

  assert.equal(caps.deviceClass, 'tablet');
  assert.equal(caps.isIpadTablet, true);
  assert.equal(caps.isMobilePhone, false);
  assert.equal(caps.isTabletOrMobile, true);
  assert.equal(caps.defaultSubFontPx, 22);
});

test('iPhone 15 PWA Portrait (390x844) and Landscape (844x390) classify as phone with 16px subtitles', () => {
  const ua =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

  for (const [w, h] of [
    [390, 844],
    [844, 390],
  ]) {
    const caps = classifyPlatform({
      userAgent: ua,
      platform: 'iPhone',
      maxTouchPoints: 5,
      innerWidth: w,
      innerHeight: h,
      hasIosPwaClass: true,
      hasSmartTvClass: true, // even if /tv route had smart-tv-mode, phone stays phone
    });
    assert.equal(caps.deviceClass, 'phone');
    assert.equal(caps.isMobilePhone, true);
    assert.equal(caps.isSmartTv, false);
    assert.equal(caps.isIpadTablet, false);
    assert.equal(caps.isTabletOrMobile, true);
    assert.equal(caps.isIosWebKit, true);
    assert.equal(caps.defaultSubFontPx, 16);
    assert.equal(caps.preferredMaxQuality, '1080');
    assert.equal(caps.deviceDisplayName, 'iPhone');
  }
});

test('Android Mobile phone classifies as phone, Android tablet with touch classifies as tablet', () => {
  const phone = classifyPlatform({
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
    maxTouchPoints: 5,
    innerWidth: 412,
    innerHeight: 915,
  });
  assert.equal(phone.deviceClass, 'phone');
  assert.equal(phone.isMobilePhone, true);
  assert.equal(phone.defaultSubFontPx, 16);
  assert.equal(phone.deviceDisplayName, 'Telefon Android');

  const tablet = classifyPlatform({
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    maxTouchPoints: 5,
    innerWidth: 1200,
    innerHeight: 750,
    screenWidth: 1200,
    screenHeight: 750,
  });
  assert.equal(tablet.deviceClass, 'tablet');
  assert.equal(tablet.isHardwareTv, false);
  assert.equal(tablet.isMobilePhone, false);
  assert.equal(tablet.isTabletOrMobile, true);
  assert.equal(tablet.defaultSubFontPx, 22);
  assert.equal(tablet.deviceDisplayName, 'Tabletă Android');
});

test('macOS Desktop Safari/Chrome stays desktop (26px subtitles, 4k quality, backdrop blur enabled)', () => {
  const caps = classifyPlatform({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    platform: 'MacIntel',
    maxTouchPoints: 0,
    innerWidth: 1440,
    innerHeight: 900,
    hostname: 'filmio.my',
  });

  assert.equal(caps.deviceClass, 'desktop');
  assert.equal(caps.isHardwareTv, false);
  assert.equal(caps.isSmartTv, false);
  assert.equal(caps.isIpadTablet, false);
  assert.equal(caps.isMobilePhone, false);
  assert.equal(caps.isTabletOrMobile, false);
  assert.equal(caps.supportsBackdropBlur, true);
  assert.equal(caps.defaultSubFontPx, 26);
  assert.equal(caps.preferredMaxQuality, '4k');
  assert.equal(caps.deviceDisplayName, 'Mac / Laptop');
  assert.equal(caps.isPrivateLanHost, false);
});

test('Car widescreen mode suppresses isMobilePhone even on short landscape viewport', () => {
  const caps = classifyPlatform({
    userAgent:
      'Mozilla/5.0 (Linux; Android 12; MBUX) AppleWebKit/537.36 Chrome/110.0.0.0 Safari/537.36',
    innerWidth: 1280,
    innerHeight: 480,
    hasCarModeClass: true,
    pathname: '/car',
  });

  assert.equal(caps.deviceClass, 'car');
  assert.equal(caps.isCarMode, true);
  assert.equal(caps.isMobilePhone, false);
});

test('Private LAN host detection recognizes RFC1918 subnets accurately', () => {
  assert.equal(
    classifyPlatform({ userAgent: 'Chrome', hostname: '192.168.2.92' }).isPrivateLanHost,
    true
  );
  assert.equal(
    classifyPlatform({ userAgent: 'Chrome', hostname: '10.0.0.5' }).isPrivateLanHost,
    true
  );
  assert.equal(
    classifyPlatform({ userAgent: 'Chrome', hostname: '172.20.10.2' }).isPrivateLanHost,
    true
  );
  assert.equal(
    classifyPlatform({ userAgent: 'Chrome', hostname: 'filmio.my' }).isPrivateLanHost,
    false
  );
});
