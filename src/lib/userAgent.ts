// Minimal User-Agent classification for the first-party funnel events
// (Marketing/AuswahlBuddy_Event-Spezifikation.md §2: device_class, os_family,
// browser_family on every event). Regex-based on purpose — the spec only
// needs three coarse buckets each, not a full UA database.

export type DeviceClass = 'mobile' | 'tablet' | 'desktop';
export type OsFamily = 'ios' | 'android' | 'macos' | 'windows' | 'other';
export type BrowserFamily = 'safari' | 'chrome' | 'firefox' | 'edge' | 'other';

export interface UserAgentInfo {
  device_class: DeviceClass;
  os_family: OsFamily;
  browser_family: BrowserFamily;
}

export function classifyUserAgent(ua: string | null | undefined): UserAgentInfo {
  const s = ua || '';

  // iPadOS 13+ identifies as "Macintosh" with touch support, which no UA
  // string alone can distinguish from a real Mac — treated as desktop like
  // every other UA-only classifier; not worth a client-side touch probe for
  // a beta-scale funnel.
  const isTablet = /iPad|Tablet|(Android(?!.*Mobile))/i.test(s);
  const isMobile = !isTablet && /Mobi|iPhone|iPod|Android/i.test(s);
  const device_class: DeviceClass = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';

  const os_family: OsFamily = /iPhone|iPad|iPod/i.test(s)
    ? 'ios'
    : /Android/i.test(s)
      ? 'android'
      : /Mac OS X/i.test(s)
        ? 'macos'
        : /Windows/i.test(s)
          ? 'windows'
          : 'other';

  // Order matters: Edge and Chrome both include "Safari" in their UA string,
  // and Chrome's UA also appears inside Edge's.
  const browser_family: BrowserFamily = /Edg\//i.test(s)
    ? 'edge'
    : /Chrome|CriOS/i.test(s)
      ? 'chrome'
      : /Firefox|FxiOS/i.test(s)
        ? 'firefox'
        : /Safari/i.test(s)
          ? 'safari'
          : 'other';

  return { device_class, os_family, browser_family };
}
