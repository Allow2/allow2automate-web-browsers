# Allow2Automate Web Browsers Plugin - Technical Architecture

**Version:** 1.0.0
**Last Updated:** 2026-01-15
**Approach:** Hybrid (Process-Level + Optional Extension)

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Plugin Architecture](#plugin-architecture)
3. [Basic Mode Implementation](#basic-mode-implementation)
4. [Enhanced Mode Implementation](#enhanced-mode-implementation)
5. [Data Flow](#data-flow)
6. [API Design](#api-design)
7. [State Management](#state-management)
8. [Error Handling](#error-handling)
9. [Testing Strategy](#testing-strategy)
10. [Deployment](#deployment)

---

## System Overview

### High-Level Architecture

```
┌────────────────────────────────────────────────────────────────┐
│             Allow2Automate Application (Electron)               │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │          WebBrowsers Plugin Entry Point (index.js)        │  │
│  │  • Plugin lifecycle management                            │  │
│  │  • Mode detection (basic vs enhanced)                     │  │
│  │  • IPC handler registration                               │  │
│  │  • Configuration management                               │  │
│  └───────────────────┬──────────────────────────────────────┘  │
│                      │                                          │
│         ┌────────────┴────────────┐                            │
│         │                         │                            │
│  ┌──────▼──────────┐       ┌─────▼──────────────┐            │
│  │  ProcessLevel   │       │    Extension       │            │
│  │    Detector     │       │     Detector       │            │
│  │   (Basic Mode)  │       │  (Enhanced Mode)   │            │
│  └──────┬──────────┘       └──────┬──────────────┘            │
│         │                         │                            │
│  ┌──────▼────────────────────────▼─────────────────────────┐  │
│  │         BrowserQuotaManager (Shared)                     │  │
│  │  • Track usage (basic or detailed)                       │  │
│  │  • Apply quotas and schedules                            │  │
│  │  • Trigger warnings                                       │  │
│  │  • Enforce blocking                                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                      │                                          │
│  ┌──────────────────▼──────────────────────────────────────┐  │
│  │           ActionExecutor (Enforcement)                    │  │
│  │  • Block browser launch                                   │  │
│  │  • Show notifications                                     │  │
│  │  • Kill browser processes                                 │  │
│  │  • Send block commands to extension                       │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
            │                              │
            │ (Basic Mode)                 │ (Enhanced Mode)
            ▼                              ▼
┌─────────────────────┐       ┌──────────────────────────────────┐
│   OS Process List   │       │    Browser Extension + Native    │
│                     │       │         Messaging Host           │
│ • chrome.exe        │       │                                  │
│ • firefox.exe       │       │  • Per-tab tracking              │
│ • msedge.exe        │       │  • Site classification           │
└─────────────────────┘       │  • Idle detection                │
                              │  • Real-time blocking            │
                              └──────────────────────────────────┘
```

### Component Interaction Flow

```
[User opens Chrome]
        │
        ▼
[ProcessLevelDetector detects "chrome.exe"]
        │
        ▼
[BrowserQuotaManager starts tracking internet time]
        │
        ├──> [Basic Mode: Count process running time]
        │
        └──> [Enhanced Mode: Request data from extension]
                    │
                    ▼
            [Extension reports: "youtube.com, 15 minutes"]
                    │
                    ▼
            [QuotaManager applies category quota (video)]
                    │
                    ▼
            [Quota check: video limit = 90 min, used = 75 min]
                    │
                    ▼
            [15 minutes remaining → Show warning]
```

---

## Plugin Architecture

### Directory Structure

```
plugins/allow2automate-webbrowsers/
├── package.json
├── index.js                      # Plugin entry point
├── README.md
├── src/
│   ├── detectors/
│   │   ├── ProcessLevelDetector.js    # Basic mode
│   │   ├── ExtensionDetector.js       # Enhanced mode
│   │   └── DetectorFactory.js         # Auto-select detector
│   ├── controllers/
│   │   ├── BrowserQuotaManager.js     # Quota tracking & enforcement
│   │   ├── ActionExecutor.js          # Enforcement actions
│   │   └── ReportGenerator.js         # Usage reports
│   ├── classifiers/
│   │   ├── WebsiteClassifier.js       # Category classification
│   │   └── CategoryPatterns.js        # Site→category mappings
│   ├── native-host/
│   │   ├── messaging-host.js          # Native messaging bridge
│   │   ├── install-host.js            # Auto-install script
│   │   └── manifests/                 # Native messaging manifests
│   │       ├── chrome.json
│   │       ├── firefox.json
│   │       └── edge.json
│   ├── utils/
│   │   ├── BrowserPatterns.js         # Browser detection patterns
│   │   ├── Logger.js                  # Logging utility
│   │   └── Encryption.js              # Data encryption
│   └── db/
│       ├── BrowserUsageDB.js          # Local database
│       └── migrations/                # DB schema migrations
├── extension/                         # Browser extension (Chrome)
│   ├── manifest.json
│   ├── background.js
│   ├── content.js
│   ├── blocked.html
│   └── icons/
├── extension-firefox/                 # Firefox variant
│   └── manifest.json
├── docs/
│   ├── FEASIBILITY.md
│   ├── OVERVIEW.md
│   ├── ARCHITECTURE.md (this file)
│   ├── BROWSER_EXTENSION.md
│   └── PRIVACY.md
└── tests/
    ├── unit/
    │   ├── ProcessLevelDetector.test.js
    │   ├── BrowserQuotaManager.test.js
    │   └── WebsiteClassifier.test.js
    └── integration/
        ├── end-to-end.test.js
        └── extension-integration.test.js
```

### Plugin Lifecycle

```javascript
// index.js - Plugin Entry Point

module.exports.requiresMainProcess = true;

module.exports.plugin = function(context) {
  const {
    ipcMain,
    configurationUpdate,
    statusUpdate,
    services
  } = context;

  // Initialize components
  const detectorFactory = new DetectorFactory(context);
  let activeDetector = null;
  let quotaManager = null;
  let actionExecutor = null;

  return {
    async onLoad(savedState) {
      console.log('[WebBrowsers] Loading plugin...');

      // Select detector (process or extension)
      activeDetector = await detectorFactory.createDetector();

      // Initialize controllers
      quotaManager = new BrowserQuotaManager(
        savedState,
        activeDetector,
        services.allow2Client
      );

      actionExecutor = new ActionExecutor(
        activeDetector,
        savedState
      );

      // Wire events
      quotaManager.on('quota-warning', async (data) => {
        await actionExecutor.showWarning(data);
      });

      quotaManager.on('quota-exhausted', async (data) => {
        if (data.type === 'internet') {
          await actionExecutor.blockBrowsers();
        } else if (data.type === 'category') {
          await actionExecutor.blockCategory(data.category);
        }
      });

      // Start monitoring
      await activeDetector.start();
      await quotaManager.start();

      // Report status
      const mode = activeDetector.getMode();
      statusUpdate({
        status: 'connected',
        message: `Browser monitoring active (${mode} mode)`,
        capabilities: activeDetector.getCapabilities()
      });
    },

    async newState(newState) {
      console.log('[WebBrowsers] State updated');
      await quotaManager.updateConfig(newState);
      await actionExecutor.updateConfig(newState);
    },

    async onSetEnabled(enabled) {
      if (enabled) {
        await activeDetector.start();
        await quotaManager.start();
        statusUpdate({ status: 'connected' });
      } else {
        await activeDetector.stop();
        await quotaManager.stop();
        statusUpdate({ status: 'disconnected' });
      }
    },

    async onUnload() {
      console.log('[WebBrowsers] Unloading plugin');
      await activeDetector.stop();
      await quotaManager.stop();
    }
  };
};
```

---

## Basic Mode Implementation

### ProcessLevelDetector

```javascript
// src/detectors/ProcessLevelDetector.js

const EventEmitter = require('events');
const BrowserPatterns = require('../utils/BrowserPatterns');

class ProcessLevelDetector extends EventEmitter {
  constructor(context) {
    super();
    this.context = context;
    this.patterns = BrowserPatterns.getPatterns();
    this.activeBrowsers = new Map(); // pid → BrowserInfo
    this.interval = null;

    // Get process monitor from OS plugin
    this.processMonitor = context.services.processMonitor;
  }

  getMode() {
    return 'basic';
  }

  getCapabilities() {
    return {
      browserDetection: true,
      totalTimeTracking: true,
      browserBlockingPerSiteTracking: false,
      categoryClassification: false,
      idleDetection: false,
      realTimeBlocking: false
    };
  }

  async start() {
    console.log('[ProcessLevelDetector] Starting basic mode monitoring');

    // Scan every 5 seconds
    this.interval = setInterval(() => {
      this.scanBrowsers();
    }, 5000);

    // Initial scan
    await this.scanBrowsers();
  }

  async stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async scanBrowsers() {
    try {
      // Get all processes
      const processes = await this.processMonitor.getProcessList();

      // Track currently running browsers
      const currentBrowserPids = new Set();

      for (const proc of processes) {
        const browserInfo = this.identifyBrowser(proc);

        if (browserInfo) {
          currentBrowserPids.add(proc.pid);

          if (!this.activeBrowsers.has(proc.pid)) {
            // New browser process
            this.activeBrowsers.set(proc.pid, {
              ...browserInfo,
              pid: proc.pid,
              startTime: Date.now()
            });

            this.emit('browser-started', browserInfo);
          }
        }
      }

      // Detect terminated browsers
      for (const [pid, info] of this.activeBrowsers.entries()) {
        if (!currentBrowserPids.has(pid)) {
          const duration = Date.now() - info.startTime;
          this.emit('browser-stopped', {
            ...info,
            duration
          });

          this.activeBrowsers.delete(pid);
        }
      }

      // Emit periodic update
      this.emit('browsers-update', {
        count: this.activeBrowsers.size,
        browsers: Array.from(this.activeBrowsers.values())
      });

    } catch (error) {
      console.error('[ProcessLevelDetector] Scan error:', error);
    }
  }

  identifyBrowser(proc) {
    const name = proc.name.toLowerCase();
    const path = (proc.path || '').toLowerCase();

    for (const [browser, patterns] of Object.entries(this.patterns)) {
      const match = patterns.some(p => {
        const pattern = p.toLowerCase();
        return name.includes(pattern) || path.includes(pattern);
      });

      if (match) {
        return {
          name: browser,
          processName: proc.name,
          executable: proc.path
        };
      }
    }

    return null;
  }

  isBrowserActive() {
    return this.activeBrowsers.size > 0;
  }

  getActiveBrowsers() {
    return Array.from(this.activeBrowsers.values());
  }

  getUsageData(childId) {
    // In basic mode, we only know total browser time
    // Actual time tracking done by BrowserQuotaManager

    return {
      mode: 'basic',
      browsersDetected: this.getActiveBrowsers().map(b => b.name),
      currentlyActive: this.isBrowserActive(),
      detailAvailable: false
    };
  }
}

module.exports = ProcessLevelDetector;
```

### BrowserPatterns Utility

```javascript
// src/utils/BrowserPatterns.js

class BrowserPatterns {
  static getPatterns() {
    return {
      chrome: [
        'chrome.exe',
        'chrome',
        'Google Chrome',
        'Chromium',
        'google-chrome',
        'google-chrome-stable'
      ],
      firefox: [
        'firefox.exe',
        'firefox',
        'Firefox',
        'Mozilla Firefox'
      ],
      safari: [
        'Safari',
        'safari'
      ],
      edge: [
        'msedge.exe',
        'msedge',
        'Microsoft Edge',
        'microsoft-edge'
      ],
      brave: [
        'brave.exe',
        'brave',
        'Brave Browser',
        'brave-browser'
      ],
      opera: [
        'opera.exe',
        'opera',
        'Opera'
      ],
      vivaldi: [
        'vivaldi.exe',
        'vivaldi',
        'Vivaldi'
      ]
    };
  }

  static getAllPatterns() {
    const patterns = this.getPatterns();
    return Object.values(patterns).flat();
  }

  static getBrowserName(processName) {
    const patterns = this.getPatterns();
    const name = processName.toLowerCase();

    for (const [browser, patterns] of Object.entries(patterns)) {
      if (patterns.some(p => name.includes(p.toLowerCase()))) {
        return browser;
      }
    }

    return null;
  }
}

module.exports = BrowserPatterns;
```

---

## Enhanced Mode Implementation

### ExtensionDetector

```javascript
// src/detectors/ExtensionDetector.js

const EventEmitter = require('events');
const net = require('net');
const fs = require('fs').promises;
const path = require('path');

class ExtensionDetector extends EventEmitter {
  constructor(context) {
    super();
    this.context = context;
    this.connectedExtensions = new Map(); // browser → connection
    this.server = null;
    this.socketPath = this.getSocketPath();
    this.activityBuffer = [];
  }

  getMode() {
    return 'enhanced';
  }

  getCapabilities() {
    return {
      browserDetection: true,
      totalTimeTracking: true,
      perSiteTracking: true,
      categoryClassification: true,
      idleDetection: true,
      realTimeBlocking: true
    };
  }

  async start() {
    console.log('[ExtensionDetector] Starting enhanced mode monitoring');

    // Start IPC server for native messaging host
    await this.startServer();

    // Check for existing extensions
    await this.detectExtensions();
  }

  async stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }

    // Close all extension connections
    for (const conn of this.connectedExtensions.values()) {
      conn.destroy();
    }
    this.connectedExtensions.clear();
  }

  async startServer() {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        this.handleConnection(socket);
      });

      this.server.on('error', (err) => {
        console.error('[ExtensionDetector] Server error:', err);
        reject(err);
      });

      this.server.listen(this.socketPath, () => {
        console.log('[ExtensionDetector] Server listening on:', this.socketPath);
        resolve();
      });
    });
  }

  handleConnection(socket) {
    console.log('[ExtensionDetector] Extension connected');

    let buffer = '';

    socket.on('data', (data) => {
      buffer += data.toString();

      // Process complete messages (newline-delimited JSON)
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.trim()) {
          try {
            const message = JSON.parse(line);
            this.handleExtensionMessage(message, socket);
          } catch (error) {
            console.error('[ExtensionDetector] Invalid JSON:', error);
          }
        }
      }
    });

    socket.on('end', () => {
      console.log('[ExtensionDetector] Extension disconnected');
      // Remove from connected map
      for (const [browser, conn] of this.connectedExtensions.entries()) {
        if (conn === socket) {
          this.connectedExtensions.delete(browser);
          break;
        }
      }
    });

    socket.on('error', (err) => {
      console.error('[ExtensionDetector] Socket error:', err);
    });
  }

  handleExtensionMessage(message, socket) {
    console.log('[ExtensionDetector] Message from extension:', message.type);

    switch (message.type) {
      case 'handshake':
        // Extension connecting
        this.connectedExtensions.set(message.browser, socket);
        this.sendToExtension(socket, {
          type: 'handshake_ack',
          capabilities: this.getCapabilities()
        });
        this.emit('extension-connected', { browser: message.browser });
        break;

      case 'activity_report':
        // Activity data from extension
        this.processActivityReport(message.data, message.browser);
        break;

      case 'browser_started':
        this.emit('browser-started', {
          name: message.browser,
          extensionAvailable: true
        });
        break;

      case 'browser_stopped':
        this.emit('browser-stopped', {
          name: message.browser,
          duration: message.duration
        });
        break;

      case 'tab_changed':
        // Real-time tab change notification
        this.emit('tab-changed', message.data);
        break;

      case 'idle_state':
        this.emit('idle-state-changed', {
          browser: message.browser,
          idle: message.idle
        });
        break;

      default:
        console.warn('[ExtensionDetector] Unknown message type:', message.type);
    }
  }

  processActivityReport(data, browser) {
    // data.history = [{ url: 'youtube.com', duration: 1800, category: 'video' }, ...]
    // data.currentTab = 'roblox.com'

    this.activityBuffer.push({
      browser,
      timestamp: Date.now(),
      ...data
    });

    // Emit activity update
    this.emit('activity-report', {
      browser,
      history: data.history,
      currentTab: data.currentTab
    });
  }

  getUsageData(childId) {
    // Aggregate activity from buffer
    const history = this.activityBuffer.flatMap(report => report.history || []);

    // Group by domain
    const siteStats = {};
    for (const entry of history) {
      if (!siteStats[entry.url]) {
        siteStats[entry.url] = {
          domain: entry.url,
          totalTime: 0,
          category: entry.category || 'other',
          visits: 0
        };
      }

      siteStats[entry.url].totalTime += entry.duration;
      siteStats[entry.url].visits += 1;
    }

    // Sort by time
    const topSites = Object.values(siteStats)
      .sort((a, b) => b.totalTime - a.totalTime)
      .slice(0, 20);

    // Category breakdown
    const categoryStats = {};
    for (const site of topSites) {
      if (!categoryStats[site.category]) {
        categoryStats[site.category] = 0;
      }
      categoryStats[site.category] += site.totalTime;
    }

    return {
      mode: 'enhanced',
      detailAvailable: true,
      topSites,
      categoryBreakdown: categoryStats,
      totalSites: Object.keys(siteStats).length
    };
  }

  sendToExtension(socket, message) {
    const json = JSON.stringify(message) + '\n';
    socket.write(json);
  }

  async blockSite(url) {
    // Send block command to all connected extensions
    for (const socket of this.connectedExtensions.values()) {
      this.sendToExtension(socket, {
        type: 'block_site',
        url
      });
    }
  }

  async blockCategory(category) {
    for (const socket of this.connectedExtensions.values()) {
      this.sendToExtension(socket, {
        type: 'block_category',
        category
      });
    }
  }

  async detectExtensions() {
    // Check if native messaging host installed
    const hostInstalled = await this.isNativeHostInstalled();

    if (!hostInstalled) {
      console.warn('[ExtensionDetector] Native messaging host not installed');
      this.emit('native-host-missing');
      return false;
    }

    // Extensions will connect automatically if installed
    return true;
  }

  async isNativeHostInstalled() {
    // Check for native messaging host manifest
    const manifestPaths = this.getNativeHostManifestPaths();

    for (const manifestPath of manifestPaths) {
      try {
        await fs.access(manifestPath);
        return true;
      } catch {
        continue;
      }
    }

    return false;
  }

  getNativeHostManifestPaths() {
    const platform = process.platform;
    const home = process.env.HOME || process.env.USERPROFILE;

    if (platform === 'win32') {
      return [
        path.join(home, 'AppData\\Local\\Google\\Chrome\\User Data\\NativeMessagingHosts\\com.allow2.automate.browser.json')
      ];
    } else if (platform === 'darwin') {
      return [
        path.join(home, 'Library/Application Support/Google/Chrome/NativeMessagingHosts/com.allow2.automate.browser.json'),
        path.join(home, 'Library/Application Support/Mozilla/NativeMessagingHosts/com.allow2.automate.browser.json')
      ];
    } else {
      return [
        path.join(home, '.config/google-chrome/NativeMessagingHosts/com.allow2.automate.browser.json'),
        path.join(home, '.mozilla/native-messaging-hosts/com.allow2.automate.browser.json')
      ];
    }
  }

  getSocketPath() {
    if (process.platform === 'win32') {
      return '\\\\.\\pipe\\allow2automate-browser';
    } else {
      return '/tmp/allow2automate-browser.sock';
    }
  }

  isBrowserActive() {
    return this.connectedExtensions.size > 0;
  }

  getActiveBrowsers() {
    return Array.from(this.connectedExtensions.keys()).map(browser => ({
      name: browser,
      extensionAvailable: true
    }));
  }
}

module.exports = ExtensionDetector;
```

### DetectorFactory

```javascript
// src/detectors/DetectorFactory.js

const ProcessLevelDetector = require('./ProcessLevelDetector');
const ExtensionDetector = require('./ExtensionDetector');

class DetectorFactory {
  constructor(context) {
    this.context = context;
  }

  async createDetector() {
    // Try enhanced mode first
    const extensionDetector = new ExtensionDetector(this.context);
    const hasExtension = await extensionDetector.detectExtensions();

    if (hasExtension) {
      console.log('[DetectorFactory] Using enhanced mode (extension available)');
      return extensionDetector;
    }

    // Fallback to basic mode
    console.log('[DetectorFactory] Using basic mode (extension not available)');
    return new ProcessLevelDetector(this.context);
  }
}

module.exports = DetectorFactory;
```

---

## Data Flow

### Basic Mode Data Flow

```
1. User opens Chrome
      │
      ▼
2. ProcessLevelDetector scans processes (every 5s)
      │
      ▼
3. Detects "chrome.exe" → emit('browser-started')
      │
      ▼
4. BrowserQuotaManager starts timer
      │
      ▼
5. Every 5 seconds:
   - Check if Chrome still running
   - Increment internet time counter
   - Check against quota (e.g., 120 minutes)
      │
      ▼
6. At 15 minutes remaining:
   - emit('quota-warning', { remaining: 15, type: 'internet' })
   - ActionExecutor shows notification
      │
      ▼
7. At quota exhaustion:
   - emit('quota-exhausted', { type: 'internet' })
   - ActionExecutor blocks browser launch
   - Kills running browser processes
```

### Enhanced Mode Data Flow

```
1. User opens Chrome with extension installed
      │
      ▼
2. Extension: background.js initializes
      │
      ▼
3. Extension connects to native messaging host
      │
      ▼
4. Native host forwards to ExtensionDetector (via Unix socket)
      │
      ▼
5. ExtensionDetector: emit('extension-connected', { browser: 'chrome' })
      │
      ▼
6. User visits youtube.com:
   - Extension tracks: { url: 'youtube.com', startTime: ... }
      │
      ▼
7. User stays on YouTube for 15 minutes:
   - Extension accumulates time
   - Classifies as category: 'video'
      │
      ▼
8. Every 30 seconds, extension sends activity report:
   {
     type: 'activity_report',
     data: {
       history: [
         { url: 'youtube.com', duration: 900, category: 'video' }
       ],
       currentTab: 'youtube.com'
     }
   }
      │
      ▼
9. ExtensionDetector receives report:
   - emit('activity-report', { ... })
      │
      ▼
10. BrowserQuotaManager processes:
    - Check category quota: video = 90 min max, used = 75 min
    - 15 minutes remaining → emit('quota-warning')
      │
      ▼
11. At category quota exhaustion:
    - emit('quota-exhausted', { type: 'category', category: 'video' })
    - ActionExecutor calls extensionDetector.blockCategory('video')
      │
      ▼
12. Extension receives block command:
    - Checks current tab: youtube.com (video category)
    - Redirects to blocked.html
    - Shows: "Video time exhausted"
```

---

## API Design

### BrowserQuotaManager

```javascript
// src/controllers/BrowserQuotaManager.js

class BrowserQuotaManager extends EventEmitter {
  constructor(config, detector, allow2Client) {
    super();
    this.config = config;
    this.detector = detector;
    this.allow2Client = allow2Client;

    this.usage = new Map(); // childId → UsageData
    this.intervals = [];
  }

  async start() {
    // Listen to detector events
    this.detector.on('browser-started', (data) => {
      this.handleBrowserStarted(data);
    });

    this.detector.on('browser-stopped', (data) => {
      this.handleBrowserStopped(data);
    });

    if (this.detector.getMode() === 'enhanced') {
      this.detector.on('activity-report', (data) => {
        this.handleActivityReport(data);
      });
    }

    // Update usage every 5 seconds
    const updateInterval = setInterval(() => {
      this.updateUsage();
    }, 5000);

    // Check quotas every 30 seconds
    const checkInterval = setInterval(() => {
      this.checkQuotas();
    }, 30000);

    this.intervals.push(updateInterval, checkInterval);
  }

  async stop() {
    this.intervals.forEach(clearInterval);
    this.intervals = [];
  }

  handleBrowserStarted(data) {
    console.log('[QuotaManager] Browser started:', data.name);

    // Get current user from session monitor
    const session = this.getActiveSession();
    if (!session) return;

    const childId = session.childId;

    if (!this.usage.has(childId)) {
      this.usage.set(childId, {
        internetTime: 0,
        siteHistory: [],
        categoryUsage: {},
        lastUpdate: Date.now(),
        browserActive: true
      });
    } else {
      const usage = this.usage.get(childId);
      usage.browserActive = true;
      usage.lastUpdate = Date.now();
    }
  }

  handleBrowserStopped(data) {
    console.log('[QuotaManager] Browser stopped:', data.name, 'duration:', data.duration);

    const session = this.getActiveSession();
    if (!session) return;

    const usage = this.usage.get(session.childId);
    if (usage) {
      usage.browserActive = false;
    }
  }

  handleActivityReport(data) {
    // Enhanced mode: detailed activity data
    const session = this.getActiveSession();
    if (!session) return;

    const usage = this.usage.get(session.childId);
    if (!usage) return;

    // Merge history
    usage.siteHistory.push(...data.history);

    // Update category usage
    for (const entry of data.history) {
      const category = entry.category || 'other';
      usage.categoryUsage[category] = (usage.categoryUsage[category] || 0) + entry.duration;
    }
  }

  updateUsage() {
    const session = this.getActiveSession();
    if (!session) return;

    const usage = this.usage.get(session.childId);
    if (!usage) return;

    const now = Date.now();
    const elapsed = now - usage.lastUpdate;

    if (usage.browserActive) {
      // Add time to internet quota
      usage.internetTime += elapsed / 1000; // Convert to seconds
    }

    usage.lastUpdate = now;
  }

  async checkQuotas() {
    for (const [childId, usage] of this.usage.entries()) {
      const config = this.config.children[childId];
      if (!config) continue;

      // Check internet time quota
      const internetMinutes = usage.internetTime / 60;
      const internetQuota = config.internetTimeDaily || Infinity;
      const internetRemaining = internetQuota - internetMinutes;

      if (internetRemaining <= 0) {
        this.emit('quota-exhausted', {
          childId,
          type: 'internet',
          used: internetMinutes,
          quota: internetQuota
        });
      } else if (internetRemaining <= 5 && !usage.warned5) {
        this.emit('quota-warning', {
          childId,
          type: 'internet',
          remaining: internetRemaining
        });
        usage.warned5 = true;
      } else if (internetRemaining <= 15 && !usage.warned15) {
        this.emit('quota-warning', {
          childId,
          type: 'internet',
          remaining: internetRemaining
        });
        usage.warned15 = true;
      }

      // Check category quotas (enhanced mode)
      if (config.categoryQuotas && this.detector.getMode() === 'enhanced') {
        for (const [category, quota] of Object.entries(config.categoryQuotas)) {
          if (quota === null) continue; // Unlimited

          const categorySeconds = usage.categoryUsage[category] || 0;
          const categoryMinutes = categorySeconds / 60;
          const categoryRemaining = quota - categoryMinutes;

          if (categoryRemaining <= 0) {
            this.emit('quota-exhausted', {
              childId,
              type: 'category',
              category,
              used: categoryMinutes,
              quota
            });
          }
        }
      }
    }
  }

  getUsageReport(childId) {
    const usage = this.usage.get(childId);
    if (!usage) return null;

    const detectorData = this.detector.getUsageData(childId);

    return {
      internetTime: Math.round(usage.internetTime / 60), // minutes
      browserActive: usage.browserActive,
      ...detectorData
    };
  }

  getActiveSession() {
    // Get from session monitor (injected)
    return this.context.services.sessionMonitor.getCurrentSession();
  }
}

module.exports = BrowserQuotaManager;
```

### ActionExecutor

```javascript
// src/controllers/ActionExecutor.js

class ActionExecutor {
  constructor(detector, config) {
    this.detector = detector;
    this.config = config;
  }

  async showWarning(data) {
    const { remaining, type, category } = data;

    let message;
    if (type === 'internet') {
      message = `You have ${Math.round(remaining)} minutes of internet time remaining.`;
    } else if (type === 'category') {
      message = `You have ${Math.round(remaining)} minutes of ${category} time remaining.`;
    }

    // Show OS notification
    await this.showNotification({
      title: 'Time Warning',
      message,
      urgency: remaining <= 5 ? 'critical' : 'normal'
    });
  }

  async blockBrowsers() {
    console.log('[ActionExecutor] Blocking all browsers');

    if (this.detector.getMode() === 'enhanced') {
      // Send block command to extension
      await this.detector.blockAllSites();
    }

    // Also block at process level
    const browsers = this.detector.getActiveBrowsers();
    for (const browser of browsers) {
      await this.killBrowser(browser.pid);
    }

    // Prevent new browser launches
    await this.preventBrowserLaunch();
  }

  async blockCategory(category) {
    console.log('[ActionExecutor] Blocking category:', category);

    if (this.detector.getMode() === 'enhanced') {
      await this.detector.blockCategory(category);
    }
  }

  async killBrowser(pid) {
    // Use platform-specific kill
    const platform = require('../utils/Platform').getPlatform();
    await platform.killProcess(pid, 'SIGTERM');
  }

  async preventBrowserLaunch() {
    // Use OS-level blocking (from OS plugin)
    const platform = require('../utils/Platform').getPlatform();
    const browserPatterns = require('../utils/BrowserPatterns').getAllPatterns();

    await platform.blockApplications(browserPatterns);
  }

  async showNotification(options) {
    // Use platform-specific notification
    const platform = require('../utils/Platform').getPlatform();
    await platform.showNotification(options);
  }
}

module.exports = ActionExecutor;
```

---

## State Management

### Configuration Schema

```javascript
{
  // Child settings
  children: {
    123: {
      // Basic internet quota
      internetTimeDaily: 120,  // minutes

      // Enhanced mode: category quotas
      categoryQuotas: {
        social: 60,      // 1 hour
        video: 90,       // 1.5 hours
        gaming: 60,      // 1 hour
        education: null  // unlimited
      },

      // Enhanced mode: site-specific rules
      siteRules: [
        {
          domain: "youtube.com",
          maxDailyMinutes: 60,
          allowedTimeRanges: ["16:00-20:00"]
        },
        {
          domain: "instagram.com",
          blocked: true
        }
      ],

      // Schedule-based restrictions
      internetSchedule: {
        weekdays: {
          allowed: "15:00-21:00",
          blocked: "21:00-06:00"
        }
      },

      // Warnings
      warningMinutes: [15, 5, 1],
      gracePeriod: 60
    }
  },

  // Global settings
  idleTimeout: 300,  // 5 minutes
  pauseQuotaWhenIdle: true,
  mode: 'auto'  // 'auto', 'basic', 'enhanced'
}
```

### Database Schema

```sql
-- Browser usage tracking
CREATE TABLE browser_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  browser TEXT NOT NULL,
  duration INTEGER NOT NULL,  -- seconds
  mode TEXT NOT NULL,  -- 'basic' or 'enhanced'
  created_at INTEGER NOT NULL
);

-- Site history (enhanced mode only)
CREATE TABLE site_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  domain TEXT NOT NULL,
  duration INTEGER NOT NULL,  -- seconds
  category TEXT,
  created_at INTEGER NOT NULL
);

-- Category usage (enhanced mode only)
CREATE TABLE category_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  category TEXT NOT NULL,
  duration INTEGER NOT NULL,  -- seconds
  created_at INTEGER NOT NULL
);

-- Indexes
CREATE INDEX idx_usage_child_date ON browser_usage(child_id, date);
CREATE INDEX idx_site_child_date ON site_history(child_id, date);
CREATE INDEX idx_category_child_date ON category_usage(child_id, date);
```

---

## Error Handling

```javascript
class ErrorHandler {
  constructor(statusUpdate) {
    this.statusUpdate = statusUpdate;
  }

  handle(error, context) {
    console.error(`[WebBrowsers] Error in ${context}:`, error);

    if (error.code === 'EXTENSION_NOT_FOUND') {
      this.statusUpdate({
        status: 'warning',
        message: 'Browser extension not installed. Using basic mode.',
        action: {
          label: 'Install Extension',
          handler: 'install-extension'
        }
      });
    } else if (error.code === 'NATIVE_HOST_ERROR') {
      this.statusUpdate({
        status: 'error',
        message: 'Native messaging host error. Reinstalling...',
        details: { error: error.message }
      });

      // Auto-reinstall native host
      this.reinstallNativeHost();
    } else {
      this.statusUpdate({
        status: 'error',
        message: `Error: ${error.message}`,
        details: { context, error: error.stack }
      });
    }
  }

  async reinstallNativeHost() {
    const installer = require('../native-host/install-host');
    await installer.install();
  }
}
```

---

## Testing Strategy

### Unit Tests

```javascript
// tests/unit/ProcessLevelDetector.test.js

describe('ProcessLevelDetector', () => {
  test('identifies Chrome process correctly', async () => {
    const mockProcessMonitor = {
      getProcessList: async () => [
        { pid: 1234, name: 'chrome.exe', path: 'C:\\Program Files\\Google\\Chrome\\chrome.exe' }
      ]
    };

    const detector = new ProcessLevelDetector({ services: { processMonitor: mockProcessMonitor } });
    await detector.start();

    // Wait for scan
    await new Promise(resolve => setTimeout(resolve, 100));

    const browsers = detector.getActiveBrowsers();
    expect(browsers).toHaveLength(1);
    expect(browsers[0].name).toBe('chrome');
  });

  test('emits browser-started event', async () => {
    const detector = new ProcessLevelDetector({ services: { mockProcessMonitor } });

    const startedSpy = jest.fn();
    detector.on('browser-started', startedSpy);

    await detector.start();
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(startedSpy).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'chrome' })
    );
  });
});
```

### Integration Tests

```javascript
// tests/integration/end-to-end.test.js

describe('End-to-End Browser Tracking', () => {
  test('tracks internet time from browser open to quota exhaustion', async () => {
    // Setup
    const plugin = await createTestPlugin({
      internetTimeDaily: 1  // 1 minute quota for fast test
    });

    // Start browser
    await launchTestBrowser('chrome');

    // Wait 30 seconds
    await sleep(30000);
    expect(plugin.getUsage().internetTime).toBeGreaterThan(25); // ~30 seconds

    // Wait for quota exhaustion
    await sleep(40000); // Total >60 seconds

    // Verify quota exhausted event
    expect(plugin.events).toContainEqual({
      type: 'quota-exhausted',
      data: { type: 'internet' }
    });

    // Verify browser blocked
    const browserRunning = await checkBrowserRunning('chrome');
    expect(browserRunning).toBe(false);
  });
});
```

---

## Deployment

### Package Structure

```
@allow2/allow2automate-webbrowsers-1.0.0.tgz
├── package.json
├── index.js
├── README.md
├── LICENSE
├── src/ (as documented above)
├── extension/
├── native-host/
├── docs/
└── tests/
```

### Installation Steps

1. **Plugin Installation**
   ```bash
   npm install @allow2/allow2automate-webbrowsers
   ```

2. **Basic Mode** (auto-enabled)
   - No additional steps
   - Works immediately

3. **Enhanced Mode** (optional)
   - Parent clicks "Enable Detailed Tracking" in UI
   - Wizard guides through extension installation
   - Native messaging host auto-installed

### Dependencies

```json
{
  "dependencies": {
    "sqlite3": "^5.1.0",
    "ws": "^8.0.0"
  },
  "devDependencies": {
    "jest": "^29.0.0",
    "eslint": "^8.0.0"
  }
}
```

---

## Performance Considerations

1. **Polling Intervals**: Balance responsiveness vs CPU
   - Process scan: 5 seconds
   - Usage update: 5 seconds
   - Quota check: 30 seconds
   - Extension reports: 30 seconds

2. **Memory Management**: Limit data retention
   - Activity buffer: Keep last 1000 entries
   - Database: Auto-delete data >30 days

3. **Extension Optimization**:
   - Passive listeners (no polling)
   - Batch data transmission
   - Debounce tab changes

---

**Next**: See BROWSER_EXTENSION.md for extension implementation details
**Next**: See PRIVACY.md for privacy policy and data handling
