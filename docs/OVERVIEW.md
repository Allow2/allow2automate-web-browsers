# Allow2Automate Web Browsers Plugin - Overview

**Version:** 1.0.0
**Status:** Design Phase
**Recommended Approach:** Hybrid (Process-Level + Optional Extension)

---

## Executive Summary

The **allow2automate-webbrowsers** plugin enables parents to monitor and control internet usage through browser activity tracking. It implements a **hybrid approach** that combines simple process-level browser detection (basic mode) with an optional browser extension for detailed tracking (enhanced mode).

## Purpose

This plugin addresses the core parental control need: **managing internet time**. Unlike the allow2automate-os plugin which tracks overall computer usage, this plugin specifically focuses on browser activity and internet consumption.

### Key Differentiation

- **allow2automate-os**: Tracks computer time, session management, application blocking
- **allow2automate-webbrowsers**: Tracks internet time, per-site usage, category-based limits

### Why a Separate Plugin?

1. **Focused Functionality**: Specialized browser tracking logic
2. **Optional Enhancement**: Families can choose basic or detailed tracking
3. **Privacy Control**: Separate plugin makes privacy implications clear
4. **Modular Design**: Can be enabled/disabled independently
5. **Future Extensions**: Foundation for web filtering, safe search features

---

## Core Features

### Basic Mode (Process-Level Detection)

**Available to all users immediately, no setup required**

✅ **Browser Detection**
- Identifies when Chrome, Firefox, Safari, Edge, Brave, Opera are running
- Distinguishes between browsers vs other applications
- Cross-platform support (Windows, macOS, Linux)

✅ **Internet Time Tracking**
- Tracks total time with browser open
- Separate quota from "computer time"
- Counts time across all browsers combined

✅ **Browser Blocking**
- Prevents browser launch when internet quota exhausted
- Shows notification explaining quota reached
- Allows parent to grant temporary access

✅ **Warnings**
- 15-minute warning before quota expires
- 5-minute warning before quota expires
- Persistent notification with countdown

✅ **Basic Reporting**
- Total internet time per day/week
- Which browsers were used
- Time-of-day usage patterns

### Enhanced Mode (Browser Extension)

**Optional upgrade for detailed tracking and control**

✅ **Per-Site Time Tracking**
- Records time spent on each website (domain-level)
- Top sites report (e.g., "3 hours on YouTube")
- Timeline of browsing activity

✅ **Category Classification**
- Automatically categorizes websites:
  - Social Media (Facebook, Instagram, TikTok)
  - Video Streaming (YouTube, Netflix, Twitch)
  - Gaming (Roblox, Minecraft, Steam)
  - Education (Khan Academy, Coursera, School sites)
  - News, Shopping, Other
- Parent sets limits per category (e.g., "1 hour social media/day")

✅ **Real-Time Site Blocking**
- Block specific websites instantly
- Redirect to "blocked" page with explanation
- Temporary parent override via PIN

✅ **Idle Detection**
- Distinguishes between active browsing and idle browser window
- Pauses quota when user idle >5 minutes
- Resume tracking when user returns

✅ **Advanced Reporting**
- Detailed browsing reports
- Category breakdown (pie chart)
- Time spent per site (bar chart)
- Export to CSV for analysis

---

## How It Works

### Basic Mode Architecture

```
┌────────────────────────────────────────────────────────┐
│      Allow2Automate Application (Main Process)         │
│  ┌──────────────────────────────────────────────────┐  │
│  │      WebBrowsers Plugin (Process Detector)        │  │
│  │                                                    │  │
│  │  Every 5 seconds:                                 │  │
│  │  1. Get process list from OS                      │  │
│  │  2. Filter for browser processes                  │  │
│  │  3. If browser running → count time               │  │
│  │  4. Check against internet quota                  │  │
│  │  5. Show warnings if approaching limit            │  │
│  │  6. Block browser launch if quota exhausted       │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────┐
│              Operating System Process List             │
│  chrome.exe, firefox.exe, msedge.exe, etc.            │
└────────────────────────────────────────────────────────┘
```

**Example Basic Mode Flow:**

1. **Child logs in to computer** → OS plugin detects user "bobby"
2. **Child opens Chrome** → WebBrowsers plugin detects Chrome process
3. **Timer starts** → Internet time quota counting (60 minutes allowed)
4. **Child browses for 45 minutes** → 15 minutes remaining
5. **Warning appears** → "15 minutes of internet time remaining"
6. **Child continues browsing** → 5 minutes remaining
7. **Second warning** → "5 minutes of internet time remaining"
8. **Quota exhausted** → Chrome closes with notification
9. **Child tries to re-open Chrome** → Blocked, message: "Internet time quota reached"

### Enhanced Mode Architecture

```
┌────────────────────────────────────────────────────────────┐
│         Chrome/Firefox/Edge Browser                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │    Allow2Automate Extension                          │  │
│  │                                                        │  │
│  │  • Tracks active tab URL                             │  │
│  │  • Records time per domain                           │  │
│  │  • Classifies websites by category                   │  │
│  │  • Detects idle state                                │  │
│  │  • Sends reports every 30 seconds                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                         │                                   │
│                  Native Messaging API                       │
└─────────────────────────┼──────────────────────────────────┘
                          │ (JSON messages)
                          ▼
┌────────────────────────────────────────────────────────────┐
│        Native Messaging Host (Node.js process)              │
│  • Receives extension data                                 │
│  • Forwards to WebBrowsers plugin                          │
│  • Sends commands back to extension                        │
└─────────────────────────┼──────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│      Allow2Automate WebBrowsers Plugin                      │
│  • Processes per-site data                                 │
│  • Applies category quotas                                 │
│  • Generates detailed reports                              │
│  • Sends block commands to extension                       │
└────────────────────────────────────────────────────────────┘
```

**Example Enhanced Mode Flow:**

1. **Child opens Chrome** → Extension detects and starts monitoring
2. **Child visits YouTube.com** → Extension records: site="youtube.com", category="video", start_time=10:00
3. **Child watches videos for 30 minutes** → Extension tracks active tab time
4. **Child switches to Discord** → Extension records: youtube duration=30min, discord start_time=10:30
5. **Parent has set: "Social media = 1 hour/day"** → Discord counts toward social quota
6. **After 1 hour on Discord/Instagram combined** → Plugin detects category quota exhausted
7. **Extension receives block command** → Next Discord/Instagram visit shows "Social media time exhausted"
8. **Child switches to Khan Academy** → Education category, no limit, allowed

---

## Real-World Use Cases

### Use Case 1: Simple Internet Time Limits (Basic Mode)

**Scenario:** Parent wants to limit internet to 2 hours/day

**Implementation:**
- Enable WebBrowsers plugin in basic mode
- Set internet quota: 120 minutes/day
- Plugin tracks browser running time
- Warns at 15 and 5 minutes
- Blocks browsers when quota reached

**Parent Experience:**
- One-time setup: "Internet quota = 2 hours/day"
- No extension installation needed
- Daily report: "Bobby used 2 hours internet today"

**Child Experience:**
- Browses normally
- Gets warnings when time running out
- Browser blocked when quota reached
- Can request more time from parent

### Use Case 2: Category-Based Limits (Enhanced Mode)

**Scenario:** Parent allows unlimited education, but limits social media to 1 hour/day

**Implementation:**
- Install browser extension (one-time)
- Set category quotas:
  - Social Media: 60 minutes/day
  - Video: 90 minutes/day
  - Gaming: 60 minutes/day
  - Education: Unlimited
- Extension tracks per-site and classifies

**Parent Experience:**
- Detailed report: "Bobby spent 1h on Instagram, 2h on Khan Academy, 30m on YouTube"
- Can adjust limits per category
- Sees top sites visited

**Child Experience:**
- Browses education sites freely
- Gets warnings for social media quota
- Social media sites blocked when quota reached
- Other sites still accessible

### Use Case 3: Homework Time Internet Rules

**Scenario:** During homework time (3pm-6pm), allow only educational sites

**Implementation:**
- Schedule-based rule: 3pm-6pm, weekdays
- Enhanced mode with category blocking
- Block categories: social, gaming, video
- Allow category: education

**Execution:**
- At 3pm, extension receives schedule update
- Child tries to visit YouTube → Blocked, "Not allowed during homework time"
- Child visits Khan Academy → Allowed
- At 6pm, restrictions lift automatically

### Use Case 4: Bedtime Internet Shutdown

**Scenario:** No internet after 9pm on school nights

**Implementation:**
- Bedtime rule: 21:00, Mon-Fri
- Basic mode sufficient (block all browsers)

**Execution:**
- At 8:45pm, warning: "Internet will be unavailable in 15 minutes"
- At 9pm, all browsers blocked
- Child can still use computer for offline work
- Internet unblocked at 6am next morning

### Use Case 5: Safe Browsing for Young Children

**Scenario:** Parent wants to review all sites visited by 8-year-old

**Implementation:**
- Enhanced mode with full logging
- Weekly activity report emailed to parent
- Parent reviews report every Sunday

**Parent Experience:**
- Email: "Sarah's browsing this week: YouTube (4h), PBS Kids (2h), Roblox (1h)"
- Can identify concerning sites
- Adjust quotas based on actual usage

---

## Privacy Considerations

### Basic Mode Privacy

**Data Collected:**
- Browser process names (e.g., "chrome.exe")
- Start/stop times
- Total duration

**Data NOT Collected:**
- URLs or websites visited
- Page content
- Search queries
- Passwords or form data
- Bookmarks or history

**Privacy Level:** ⭐⭐⭐⭐⭐ Excellent

### Enhanced Mode Privacy

**Data Collected:**
- Domain names visited (e.g., "youtube.com", not full URL)
- Time spent per domain
- Website categories
- Active vs idle time

**Data NOT Collected:**
- Full URLs (e.g., youtube.com/watch?v=xyz123)
- Page content or text
- Search queries or form inputs
- Passwords or credentials
- Images, videos, or downloads
- Email or message content

**Data Storage:**
- All data stored locally on device
- Encrypted database
- No cloud sync by default
- Parent can export as CSV
- Can be deleted at any time

**Privacy Level:** ⭐⭐⭐⭐☆ Good (with explicit consent)

### Parental Consent Flow

For children under 13 (COPPA compliance):

1. **Parent enables WebBrowsers plugin** → Basic mode active
2. **Plugin shows: "Enable detailed tracking?"**
3. **Parent reviews enhanced mode privacy policy**
4. **Parent explicitly consents or declines**
5. **If consent given:** Extension installation wizard starts
6. **If declined:** Stays in basic mode

Consent can be revoked at any time, returning to basic mode.

---

## Technical Requirements

### System Requirements

**Operating Systems:**
- Windows 10/11
- macOS 11 (Big Sur) or later
- Linux (Ubuntu 20.04+, Fedora 35+)

**Supported Browsers:**

| Browser | Basic Mode | Enhanced Mode |
|---------|------------|---------------|
| Google Chrome | ✅ | ✅ |
| Mozilla Firefox | ✅ | ✅ (separate extension) |
| Microsoft Edge | ✅ | ✅ (same as Chrome) |
| Safari | ✅ | ⚠️ Limited support |
| Brave | ✅ | ✅ |
| Opera | ✅ | ✅ |

### Performance Impact

**Basic Mode:**
- CPU Usage: <0.5%
- Memory: <10MB
- Disk I/O: Minimal (log writes every 5 minutes)
- Network: API calls every 60 seconds

**Enhanced Mode:**
- CPU Usage: <1% (per browser)
- Memory: <30MB (per browser)
- Disk I/O: Minimal (batch writes every 30 seconds)
- Network: API calls every 30 seconds

---

## Installation & Setup

### Basic Mode Setup (5 minutes)

1. Install Allow2Automate application (if not already installed)
2. Enable WebBrowsers plugin in settings
3. Map child's OS account to Allow2 child profile
4. Set internet time quota (e.g., 2 hours/day)
5. Save settings

**That's it!** Plugin immediately starts tracking browser usage.

### Enhanced Mode Setup (15 minutes)

1. Complete basic mode setup first
2. In WebBrowsers settings, click "Enable Detailed Tracking"
3. Review and accept privacy policy
4. Click "Install Browser Extension"
5. Follow wizard:
   - Opens Chrome Web Store
   - Click "Add to Chrome"
   - Confirm extension permissions
   - Extension auto-detects native host
6. Repeat for Firefox/Edge if used
7. Plugin auto-switches to enhanced mode

**Verification:**
- Green checkmark: "Enhanced mode active"
- View sample report to confirm per-site tracking

---

## Configuration Options

### Basic Mode Settings

```javascript
{
  childId: 123,
  osUsername: "bobby",

  // Internet time quota
  internetTimeDaily: 120,  // minutes
  internetTimeWeekly: 600,  // optional

  // Schedule-based internet access
  internetSchedule: {
    weekdays: {
      allowed: "15:00-21:00",  // 3pm-9pm
      blocked: "21:00-06:00"   // 9pm-6am
    },
    weekends: {
      allowed: "08:00-22:00"
    }
  },

  // Warnings
  warningMinutes: [15, 5, 1],
  gracePeriod: 60  // seconds before blocking
}
```

### Enhanced Mode Settings (Additional)

```javascript
{
  // Category quotas
  categoryQuotas: {
    social: 60,       // 1 hour social media
    video: 90,        // 1.5 hours video
    gaming: 60,       // 1 hour gaming
    education: null   // unlimited
  },

  // Site-specific rules
  siteRules: [
    {
      domain: "youtube.com",
      maxDailyMinutes: 60,
      allowedTimeRanges: ["16:00-20:00"]
    },
    {
      domain: "instagram.com",
      blocked: true,
      reason: "Age-inappropriate"
    }
  ],

  // Idle detection
  idleTimeout: 300,  // 5 minutes
  pauseQuotaWhenIdle: true,

  // Privacy
  logFullUrls: false,  // Only log domains
  retainHistoryDays: 30,
  autoDeleteOldData: true
}
```

---

## Reporting & Dashboard

### Basic Mode Reports

**Daily Summary:**
- Total internet time: 2 hours 15 minutes
- Browsers used: Chrome (1h 30m), Firefox (45m)
- Peak usage: 4pm-6pm

**Weekly Summary:**
- Total internet time: 14 hours
- Average per day: 2 hours
- Trend: Up 10% from last week

### Enhanced Mode Reports

**Detailed Daily Report:**
- Top sites:
  1. YouTube: 1 hour 15 minutes (Video)
  2. Roblox: 45 minutes (Gaming)
  3. Khan Academy: 30 minutes (Education)
- Category breakdown:
  - Video: 40%
  - Gaming: 30%
  - Education: 20%
  - Other: 10%
- Timeline view: Visual chart of browsing activity

**Weekly Deep Dive:**
- Total sites visited: 47 unique domains
- Most visited: YouTube (12 visits, 5h total)
- Longest session: 2 hours on Twitch.tv
- Category trends: Gaming up 25%, Education down 10%
- Export as CSV for further analysis

---

## Roadmap & Future Features

### Version 1.0 (Current Design)
- ✅ Basic mode: Process-level browser detection
- ✅ Enhanced mode: Browser extension with per-site tracking
- ✅ Category classification
- ✅ Quota enforcement
- ✅ Cross-platform support

### Version 1.1 (Next Quarter)
- 🔄 Safari extension support (macOS)
- 🔄 Mobile browser tracking (iOS/Android)
- 🔄 AI-powered site classification
- 🔄 Parent mobile app for remote management

### Version 1.2 (Future)
- 🔮 Content filtering (block inappropriate sites)
- 🔮 Safe search enforcement (Google, Bing, YouTube)
- 🔮 Screen time suggestions based on usage patterns
- 🔮 Reward system (earn extra time by completing tasks)
- 🔮 Browser history review with privacy controls

### Version 2.0 (Long-term Vision)
- 🔮 AI content analysis (detect harmful content)
- 🔮 Social media monitoring (mentions, messages)
- 🔮 Deep learning for personalized recommendations
- 🔮 Integration with school systems (homework time automation)

---

## Comparison with Competitors

| Feature | Allow2Automate | Qustodio | Net Nanny | Bark |
|---------|----------------|----------|-----------|------|
| Basic browser detection | ✅ Free | ✅ | ✅ | ✅ |
| Per-site tracking | ✅ Optional | ✅ Paid | ✅ Paid | ✅ Paid |
| Category quotas | ✅ Optional | ✅ | ✅ | ❌ |
| Privacy-friendly mode | ✅ Yes | ❌ | ❌ | ❌ |
| No cloud required | ✅ Yes | ❌ | ❌ | ❌ |
| Cross-platform | ✅ Yes | ✅ | ⚠️ Limited | ✅ |
| Cost | Free basic | $55/yr | $90/yr | $99/yr |

**Our Advantage:** Only product with privacy-friendly basic mode that works immediately, plus optional enhanced tracking.

---

## Success Criteria

### Technical Metrics
- ✅ 95%+ browser detection accuracy (basic mode)
- ✅ 90%+ site classification accuracy (enhanced mode)
- ✅ <2% CPU usage
- ✅ <50MB memory footprint
- ✅ Zero-crash rate

### User Experience Metrics
- ✅ <5 minutes basic mode setup
- ✅ <15 minutes enhanced mode setup
- ✅ 4.5+ star rating from parents
- ✅ 80%+ parent satisfaction
- ✅ <5% support ticket rate

### Business Metrics
- ✅ 30% enhanced mode adoption within 6 months
- ✅ 50% reduction in "internet time tracking" support requests
- ✅ Foundation for premium features (web filtering, safe search)

---

## Documentation

- **FEASIBILITY.md**: Detailed analysis of all approaches
- **ARCHITECTURE.md**: Technical design and implementation details
- **BROWSER_EXTENSION.md**: Extension development guide
- **PRIVACY.md**: Privacy policy and data handling
- **USER_GUIDE.md**: Setup and usage instructions for parents
- **DEVELOPER_GUIDE.md**: Development and testing procedures

---

## Questions & Answers

**Q: Why not just use the OS plugin for browser tracking?**
A: OS plugin tracks all applications equally. This plugin specializes in browsers, enabling internet-specific quotas, category limits, and per-site tracking.

**Q: Can kids bypass this by renaming browser executables?**
A: Basic mode: Partially (we match multiple patterns). Enhanced mode: No (extension tracks regardless of process name). Combination of both makes bypass difficult.

**Q: What if child uses incognito mode?**
A: Basic mode counts incognito time (process is the same). Enhanced mode can track incognito if parent enables "incognito permission" in extension settings.

**Q: How is this different from built-in browser parental controls?**
A: Browser controls work per-browser only. Our solution works across all browsers, integrates with overall screen time limits, and syncs with Allow2 platform for household-wide control.

**Q: Can this block specific websites?**
A: Enhanced mode: Yes (real-time blocking). Basic mode: No (only blocks entire browser). Full web filtering planned for v1.2.

**Q: What about privacy?**
A: Basic mode: Zero browsing data collected. Enhanced mode: Only domains (not full URLs), with explicit parental consent. All data stored locally, not in cloud.

**Q: Does this work on mobile devices?**
A: Not yet. Mobile browser tracking planned for v1.1. Current version is desktop-only (Windows, macOS, Linux).

---

## Conclusion

The **allow2automate-webbrowsers** plugin provides flexible, privacy-respecting internet time management for families. The hybrid approach balances simplicity (basic mode) with power (enhanced mode), letting parents choose the right level of monitoring for their family's needs.

**Next Steps:**
1. Review FEASIBILITY.md for detailed approach analysis
2. Review ARCHITECTURE.md for technical implementation
3. Review PRIVACY.md for data handling policies
4. Approve approach and begin Phase 1 development

**Status:** Ready for stakeholder review and approval
