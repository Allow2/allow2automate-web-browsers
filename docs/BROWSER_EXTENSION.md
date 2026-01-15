# Browser Extension Development Guide

**Version:** 1.0.0
**Last Updated:** 2026-01-15
**Target:** Chrome/Edge (Manifest V3), Firefox (Manifest V2)

---

## Table of Contents

1. [Overview](#overview)
2. [Extension Architecture](#extension-architecture)
3. [Manifest Files](#manifest-files)
4. [Background Script](#background-script)
5. [Content Scripts](#content-scripts)
6. [Native Messaging](#native-messaging)
7. [Website Classification](#website-classification)
8. [Blocking Implementation](#blocking-implementation)
9. [Testing](#testing)
10. [Publishing](#publishing)

---

## Overview

The Allow2Automate browser extension enables detailed website tracking and real-time blocking for parental control. It runs in Chrome, Edge, Firefox, and other Chromium-based browsers.

### Key Features

- **Active Tab Tracking**: Records which website is currently active
- **Per-Site Time Tracking**: Tracks duration spent on each domain
- **Category Classification**: Auto-classifies sites (social media, gaming, etc.)
- **Idle Detection**: Pauses tracking when user idle
- **Real-Time Blocking**: Blocks specific sites or categories on command
- **Privacy-Focused**: Only records domains, not full URLs or content

### Extension Components

```
extension/
├── manifest.json           # Extension metadata and permissions
├── background.js           # Core logic, tab tracking, native messaging
├── content.js              # Minimal page interaction (if needed)
├── blocked.html            # Page shown when site is blocked
├── blocked.css
├── popup.html              # Extension popup (status display)
├── popup.js
├── icons/
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
└── _locales/              # Internationalization
    └── en/
        └── messages.json
```

---

## Extension Architecture

### Data Flow

```
User opens new tab (youtube.com)
        │
        ▼
[Background Script: tabs.onActivated listener]
        │
        ▼
[Record active tab URL: "youtube.com"]
        │
        ▼
[Start timer for this tab]
        │
        ▼
[Classify site: category = "video"]
        │
        ▼
[Every 30 seconds: Send activity report to native host]
        │
        ▼
[Native Messaging Host]
        │
        ▼
[Allow2Automate WebBrowsers Plugin]
        │
        ▼
[Check category quota: video = 90 min, used = 75 min]
        │
        ▼
[If quota exhausted: Send block command to extension]
        │
        ▼
[Extension redirects tab to blocked.html]
```

### Component Interaction

```
┌────────────────────────────────────────────────────┐
│            Browser Extension                        │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │       Background Script (Service Worker)     │  │
│  │                                               │  │
│  │  • Tab tracking (onActivated, onUpdated)     │  │
│  │  • Time accumulation                         │  │
│  │  • Website classification                    │  │
│  │  • Idle detection (chrome.idle API)          │  │
│  │  • Native messaging connection               │  │
│  │  • Command handling (block site/category)    │  │
│  └───────────┬──────────────────────────────────┘  │
│              │                                      │
│  ┌───────────▼──────────────────────────────────┐  │
│  │  Content Scripts (optional, minimal)         │  │
│  │                                               │  │
│  │  • Only used for specific page interaction   │  │
│  │  • Currently not needed                      │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │          UI Components                        │  │
│  │                                               │  │
│  │  • popup.html: Extension icon popup          │  │
│  │    - Show current mode (tracking/blocked)    │  │
│  │    - Display remaining time                  │  │
│  │                                               │  │
│  │  • blocked.html: Blocked site page           │  │
│  │    - Shown when site blocked                 │  │
│  │    - Explains reason (quota exhausted)       │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## Manifest Files

### Chrome/Edge Manifest V3

```json
{
  "manifest_version": 3,
  "name": "Allow2Automate Browser Monitor",
  "version": "1.0.0",
  "description": "Parental control browser monitoring and enforcement",

  "permissions": [
    "tabs",
    "activeTab",
    "idle",
    "nativeMessaging",
    "storage"
  ],

  "host_permissions": [
    "<all_urls>"
  ],

  "background": {
    "service_worker": "background.js",
    "type": "module"
  },

  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },

  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  },

  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

### Firefox Manifest V2

```json
{
  "manifest_version": 2,
  "name": "Allow2Automate Browser Monitor",
  "version": "1.0.0",
  "description": "Parental control browser monitoring and enforcement",

  "permissions": [
    "tabs",
    "activeTab",
    "idle",
    "nativeMessaging",
    "storage",
    "<all_urls>"
  ],

  "background": {
    "scripts": ["background.js"],
    "persistent": true
  },

  "browser_action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },

  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  },

  "content_security_policy": "script-src 'self'; object-src 'self'"
}
```

---

## Background Script

### Core Implementation

```javascript
// extension/background.js

// === State Management ===

let activeTab = null;
let sessionStart = Date.now();
let siteHistory = [];
let blockedCategories = [];
let blockedSites = [];
let isIdle = false;
let nativePort = null;

// === Initialization ===

// Chrome extension startup
chrome.runtime.onStartup.addListener(() => {
  console.log('[Allow2Automate] Extension started');
  init();
});

// Extension installed/updated
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Allow2Automate] Extension installed:', details.reason);
  init();
});

async function init() {
  // Connect to native app
  connectNative();

  // Setup listeners
  setupListeners();

  // Restore state
  await restoreState();

  // Start periodic reporting
  startReportingLoop();

  // Get active tab
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]) {
    updateActiveTab(tabs[0]);
  }
}

// === Native Messaging ===

function connectNative() {
  console.log('[Allow2Automate] Connecting to native host...');

  nativePort = chrome.runtime.connectNative('com.allow2.automate.browser');

  nativePort.onMessage.addListener((message) => {
    console.log('[Allow2Automate] Received from native:', message.type);
    handleNativeMessage(message);
  });

  nativePort.onDisconnect.addListener(() => {
    console.error('[Allow2Automate] Native messaging disconnected:', chrome.runtime.lastError);

    // Retry connection after 5 seconds
    setTimeout(connectNative, 5000);
  });

  // Send handshake
  sendToNative({
    type: 'handshake',
    browser: 'chrome',
    version: chrome.runtime.getManifest().version
  });
}

function sendToNative(message) {
  if (nativePort) {
    try {
      nativePort.postMessage(message);
    } catch (error) {
      console.error('[Allow2Automate] Error sending to native:', error);
    }
  }
}

function handleNativeMessage(message) {
  switch (message.type) {
    case 'handshake_ack':
      console.log('[Allow2Automate] Connected to native host');
      break;

    case 'block_site':
      blockSite(message.url);
      break;

    case 'unblock_site':
      unblockSite(message.url);
      break;

    case 'block_category':
      blockCategory(message.category);
      break;

    case 'unblock_category':
      unblockCategory(message.category);
      break;

    case 'get_status':
      sendStatusReport();
      break;

    default:
      console.warn('[Allow2Automate] Unknown message type:', message.type);
  }
}

// === Tab Tracking ===

function setupListeners() {
  // Tab activated (switched to different tab)
  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    updateActiveTab(tab);
  });

  // Tab updated (URL changed in same tab)
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.url && tab.active) {
      updateActiveTab(tab);
    }
  });

  // Window focus changed
  chrome.windows.onFocusChanged.addListener(async (windowId) => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
      // Browser lost focus
      handleBrowserBlurred();
    } else {
      // Browser gained focus
      const tabs = await chrome.tabs.query({ active: true, windowId });
      if (tabs[0]) {
        updateActiveTab(tabs[0]);
      }
    }
  });

  // Idle detection (user inactive)
  chrome.idle.onStateChanged.addListener((newState) => {
    handleIdleStateChange(newState);
  });

  // Set idle detection threshold (5 minutes)
  chrome.idle.setDetectionInterval(300);
}

function updateActiveTab(tab) {
  console.log('[Allow2Automate] Active tab:', tab.url);

  // Record previous tab time
  if (activeTab && !isIdle) {
    const duration = Date.now() - activeTab.startTime;
    recordSiteVisit(activeTab.url, duration);
  }

  // Check if new tab should be blocked
  if (shouldBlockTab(tab)) {
    blockTab(tab.id, tab.url);
    activeTab = null;
    return;
  }

  // Set new active tab
  activeTab = {
    id: tab.id,
    url: tab.url,
    title: tab.title,
    startTime: Date.now()
  };

  // Notify native app
  sendToNative({
    type: 'tab_changed',
    data: {
      url: extractDomain(tab.url),
      title: tab.title
    }
  });
}

function handleBrowserBlurred() {
  console.log('[Allow2Automate] Browser blurred');

  if (activeTab) {
    const duration = Date.now() - activeTab.startTime;
    recordSiteVisit(activeTab.url, duration);
    activeTab = null;
  }
}

function handleIdleStateChange(newState) {
  console.log('[Allow2Automate] Idle state:', newState);

  isIdle = (newState === 'idle' || newState === 'locked');

  if (isIdle && activeTab) {
    // User went idle, save current session
    const duration = Date.now() - activeTab.startTime;
    recordSiteVisit(activeTab.url, duration);
  } else if (!isIdle && activeTab) {
    // User came back, restart timer
    activeTab.startTime = Date.now();
  }

  // Notify native app
  sendToNative({
    type: 'idle_state',
    idle: isIdle
  });
}

// === Time Recording ===

function recordSiteVisit(url, duration) {
  if (duration < 1000) {
    // Ignore very short visits (<1 second)
    return;
  }

  const domain = extractDomain(url);
  const category = classifySite(domain);

  siteHistory.push({
    url: domain,
    duration: Math.round(duration), // milliseconds
    category: category,
    timestamp: Date.now()
  });

  console.log(`[Allow2Automate] Recorded: ${domain} (${category}) = ${Math.round(duration/1000)}s`);

  // Limit history size
  if (siteHistory.length > 1000) {
    siteHistory = siteHistory.slice(-500); // Keep last 500 entries
  }

  // Save to storage
  saveState();
}

function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (error) {
    return null;
  }
}

// === Website Classification ===

function classifySite(domain) {
  if (!domain) return 'other';

  const patterns = {
    social: [
      'facebook.com', 'fb.com', 'instagram.com', 'twitter.com', 'x.com',
      'tiktok.com', 'snapchat.com', 'linkedin.com', 'pinterest.com',
      'reddit.com', 'tumblr.com', 'discord.com', 'whatsapp.com'
    ],
    video: [
      'youtube.com', 'youtu.be', 'twitch.tv', 'netflix.com', 'hulu.com',
      'disneyplus.com', 'primevideo.com', 'vimeo.com', 'dailymotion.com'
    ],
    gaming: [
      'roblox.com', 'minecraft.net', 'steam.com', 'epicgames.com',
      'ea.com', 'blizzard.com', 'ubisoft.com', 'playstation.com',
      'xbox.com', 'nintendo.com', 'ign.com', 'gamespot.com'
    ],
    education: [
      'khanacademy.org', 'coursera.org', 'edx.org', 'udemy.com',
      'duolingo.com', 'quizlet.com', 'wikipedia.org', 'wolfram.com',
      'codecademy.com', 'brilliant.org', 'skillshare.com'
    ],
    news: [
      'cnn.com', 'bbc.com', 'nytimes.com', 'washingtonpost.com',
      'theguardian.com', 'reuters.com', 'apnews.com', 'npr.org'
    ],
    shopping: [
      'amazon.com', 'ebay.com', 'etsy.com', 'walmart.com', 'target.com',
      'bestbuy.com', 'shopify.com', 'alibaba.com'
    ],
    productivity: [
      'google.com', 'gmail.com', 'outlook.com', 'office.com',
      'docs.google.com', 'drive.google.com', 'dropbox.com',
      'notion.so', 'trello.com', 'asana.com', 'slack.com'
    ]
  };

  for (const [category, domains] of Object.entries(patterns)) {
    for (const pattern of domains) {
      if (domain.includes(pattern)) {
        return category;
      }
    }
  }

  return 'other';
}

// === Blocking ===

function shouldBlockTab(tab) {
  const domain = extractDomain(tab.url);
  if (!domain) return false;

  // Check if site explicitly blocked
  if (blockedSites.includes(domain)) {
    return true;
  }

  // Check if category blocked
  const category = classifySite(domain);
  if (blockedCategories.includes(category)) {
    return true;
  }

  return false;
}

function blockTab(tabId, url) {
  console.log('[Allow2Automate] Blocking tab:', url);

  const domain = extractDomain(url);
  const category = classifySite(domain);

  // Redirect to blocked page
  chrome.tabs.update(tabId, {
    url: chrome.runtime.getURL('blocked.html') +
         `?domain=${encodeURIComponent(domain)}&category=${encodeURIComponent(category)}`
  });
}

function blockSite(url) {
  console.log('[Allow2Automate] Blocking site:', url);

  if (!blockedSites.includes(url)) {
    blockedSites.push(url);
    saveState();
  }

  // Check if current tab matches
  if (activeTab && extractDomain(activeTab.url) === url) {
    blockTab(activeTab.id, activeTab.url);
  }
}

function unblockSite(url) {
  console.log('[Allow2Automate] Unblocking site:', url);

  const index = blockedSites.indexOf(url);
  if (index > -1) {
    blockedSites.splice(index, 1);
    saveState();
  }
}

function blockCategory(category) {
  console.log('[Allow2Automate] Blocking category:', category);

  if (!blockedCategories.includes(category)) {
    blockedCategories.push(category);
    saveState();
  }

  // Check if current tab matches
  if (activeTab) {
    const domain = extractDomain(activeTab.url);
    const tabCategory = classifySite(domain);

    if (tabCategory === category) {
      blockTab(activeTab.id, activeTab.url);
    }
  }
}

function unblockCategory(category) {
  console.log('[Allow2Automate] Unblocking category:', category);

  const index = blockedCategories.indexOf(category);
  if (index > -1) {
    blockedCategories.splice(index, 1);
    saveState();
  }
}

// === Reporting ===

function startReportingLoop() {
  // Send activity report every 30 seconds
  setInterval(() => {
    sendActivityReport();
  }, 30000);
}

function sendActivityReport() {
  if (siteHistory.length === 0) return;

  console.log(`[Allow2Automate] Sending activity report: ${siteHistory.length} entries`);

  sendToNative({
    type: 'activity_report',
    data: {
      history: siteHistory,
      currentTab: activeTab ? extractDomain(activeTab.url) : null,
      timestamp: Date.now()
    }
  });

  // Clear history after reporting
  siteHistory = [];
  saveState();
}

function sendStatusReport() {
  const domain = activeTab ? extractDomain(activeTab.url) : null;
  const category = domain ? classifySite(domain) : null;

  sendToNative({
    type: 'status_report',
    data: {
      active: !!activeTab,
      currentSite: domain,
      currentCategory: category,
      isIdle: isIdle,
      blockedSites: blockedSites,
      blockedCategories: blockedCategories
    }
  });
}

// === State Persistence ===

async function saveState() {
  await chrome.storage.local.set({
    siteHistory,
    blockedSites,
    blockedCategories,
    lastUpdate: Date.now()
  });
}

async function restoreState() {
  const state = await chrome.storage.local.get([
    'siteHistory',
    'blockedSites',
    'blockedCategories'
  ]);

  if (state.siteHistory) {
    siteHistory = state.siteHistory;
  }

  if (state.blockedSites) {
    blockedSites = state.blockedSites;
  }

  if (state.blockedCategories) {
    blockedCategories = state.blockedCategories;
  }

  console.log('[Allow2Automate] State restored');
}
```

---

## Content Scripts

Content scripts are **not required** for basic functionality. All tracking is done via the background script using the `tabs` API. Content scripts would only be needed for:

- Injecting custom UI elements into pages
- Detecting specific page elements
- Modifying page behavior

For this plugin, we avoid content scripts to minimize performance impact and privacy concerns.

---

## Native Messaging

### Protocol Design

Messages are JSON objects sent over stdin/stdout:

**Extension → Native Host:**
```json
{
  "type": "handshake",
  "browser": "chrome",
  "version": "1.0.0"
}

{
  "type": "activity_report",
  "data": {
    "history": [
      {
        "url": "youtube.com",
        "duration": 900000,
        "category": "video",
        "timestamp": 1705342800000
      }
    ],
    "currentTab": "youtube.com",
    "timestamp": 1705342800000
  }
}

{
  "type": "tab_changed",
  "data": {
    "url": "roblox.com",
    "title": "Roblox - Home"
  }
}

{
  "type": "idle_state",
  "idle": true
}
```

**Native Host → Extension:**
```json
{
  "type": "handshake_ack",
  "capabilities": {
    "browserDetection": true,
    "perSiteTracking": true
  }
}

{
  "type": "block_site",
  "url": "instagram.com"
}

{
  "type": "block_category",
  "category": "social"
}

{
  "type": "get_status"
}
```

### Native Messaging Host Manifest

**Location:**
- **Windows**: `HKEY_CURRENT_USER\Software\Google\Chrome\NativeMessagingHosts\com.allow2.automate.browser`
- **macOS**: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.allow2.automate.browser.json`
- **Linux**: `~/.config/google-chrome/NativeMessagingHosts/com.allow2.automate.browser.json`

**Content:**
```json
{
  "name": "com.allow2.automate.browser",
  "description": "Allow2Automate Browser Monitor Native Host",
  "path": "/usr/local/bin/allow2automate-browser-host",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://EXTENSION_ID_HERE/"
  ]
}
```

---

## Website Classification

### Classification Algorithm

```javascript
function classifySite(domain) {
  // 1. Check exact matches
  if (exactPatterns[domain]) {
    return exactPatterns[domain];
  }

  // 2. Check subdomain matches (youtube.com matches www.youtube.com, m.youtube.com)
  for (const [pattern, category] of Object.entries(subdomainPatterns)) {
    if (domain.endsWith(pattern)) {
      return category;
    }
  }

  // 3. Check keyword matches
  for (const [category, keywords] of Object.entries(keywordPatterns)) {
    for (const keyword of keywords) {
      if (domain.includes(keyword)) {
        return category;
      }
    }
  }

  // 4. Machine learning classification (future enhancement)
  // const category = await classifyWithML(domain);

  // 5. Default to "other"
  return 'other';
}
```

### Classification Patterns

See `background.js` for full list. Key categories:

- **social**: Social media platforms
- **video**: Video streaming and content
- **gaming**: Games and gaming platforms
- **education**: Educational resources
- **news**: News and media outlets
- **shopping**: E-commerce sites
- **productivity**: Work and productivity tools
- **other**: Unclassified sites

---

## Blocking Implementation

### Blocked Page UI

```html
<!-- extension/blocked.html -->
<!DOCTYPE html>
<html>
<head>
  <title>Site Blocked</title>
  <link rel="stylesheet" href="blocked.css">
</head>
<body>
  <div class="container">
    <div class="icon">🚫</div>
    <h1>This site is currently blocked</h1>
    <p id="message">You've reached your time limit for this category.</p>

    <div class="details">
      <div><strong>Domain:</strong> <span id="domain"></span></div>
      <div><strong>Category:</strong> <span id="category"></span></div>
    </div>

    <p class="hint">Ask a parent to adjust your time limits if needed.</p>
  </div>

  <script src="blocked.js"></script>
</body>
</html>
```

```javascript
// extension/blocked.js

// Get domain and category from URL params
const params = new URLSearchParams(window.location.search);
const domain = params.get('domain');
const category = params.get('category');

document.getElementById('domain').textContent = domain || 'Unknown';
document.getElementById('category').textContent = category || 'Unknown';

// Customize message based on category
if (category === 'social') {
  document.getElementById('message').textContent = 'You\'ve reached your social media time limit for today.';
} else if (category === 'video') {
  document.getElementById('message').textContent = 'You\'ve reached your video watching time limit for today.';
} else if (category === 'gaming') {
  document.getElementById('message').textContent = 'You\'ve reached your gaming time limit for today.';
}
```

---

## Testing

### Manual Testing Checklist

- [ ] Extension loads without errors
- [ ] Native messaging connection established
- [ ] Tab switching tracked correctly
- [ ] Time accumulation accurate
- [ ] Site classification correct for top 20 sites
- [ ] Idle detection pauses tracking
- [ ] Blocking works for specific sites
- [ ] Blocking works for categories
- [ ] Blocked page displays correctly
- [ ] Activity reports sent to native host
- [ ] State persists across browser restarts

### Automated Testing

```javascript
// tests/extension.test.js

describe('Extension Background Script', () => {
  test('classifies YouTube correctly', () => {
    const category = classifySite('www.youtube.com');
    expect(category).toBe('video');
  });

  test('tracks tab time accurately', async () => {
    const tab = { id: 1, url: 'https://youtube.com', title: 'YouTube' };
    updateActiveTab(tab);

    await sleep(5000); // 5 seconds

    recordSiteVisit(tab.url, 5000);

    expect(siteHistory).toContainEqual(
      expect.objectContaining({
        url: 'youtube.com',
        duration: 5000,
        category: 'video'
      })
    );
  });
});
```

---

## Publishing

### Chrome Web Store

1. **Package extension**: Create ZIP file
2. **Developer account**: Sign up at chrome.google.com/webstore/devconsole
3. **Upload**: Submit ZIP file
4. **Details**:
   - Name: "Allow2Automate Browser Monitor"
   - Description: (See OVERVIEW.md)
   - Category: Productivity
   - Privacy policy: Link to PRIVACY.md
5. **Review**: Typically 1-3 days
6. **Publish**: Available to users

### Firefox Add-ons

1. **Package extension**: Create ZIP file (manifest v2)
2. **Developer account**: addons.mozilla.org
3. **Submit**: Upload ZIP
4. **Validation**: Automated checks
5. **Review**: 1-7 days
6. **Publish**: Available on Firefox Add-ons

### Edge Add-ons

1. Use same package as Chrome (manifest v3)
2. Developer account: partner.microsoft.com/edge
3. Submit and publish (similar to Chrome)

---

## Security Considerations

1. **Permissions**: Request only necessary permissions
2. **Content Security Policy**: Strict CSP to prevent XSS
3. **Native Messaging**: Verify host authenticity
4. **Data Storage**: Encrypt sensitive data
5. **No Eval**: Never use `eval()` or similar
6. **User Data**: Only collect necessary data

---

## Maintenance

### Updating Extension

1. Increment version in manifest.json
2. Test thoroughly
3. Submit update to stores
4. Auto-updates to users within 24-48 hours

### Browser API Changes

- Monitor Chrome/Firefox API changes
- Test on Beta browsers before stable release
- Migrate to new APIs when old ones deprecated

---

## Troubleshooting

### Extension Not Loading

- Check manifest.json syntax
- Verify permissions are correct
- Check background script for errors

### Native Messaging Not Working

- Verify native host installed correctly
- Check manifest path and permissions
- Test with `chrome://extensions` in developer mode

### Classification Inaccurate

- Add domain to classification patterns
- Consider machine learning enhancement
- Allow parent to manually classify sites

---

**See also:**
- ARCHITECTURE.md for overall system design
- PRIVACY.md for privacy policy details
