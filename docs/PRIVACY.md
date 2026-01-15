# Privacy Policy - Allow2Automate Web Browsers Plugin

**Effective Date:** 2026-01-15
**Version:** 1.0.0
**Last Updated:** 2026-01-15

---

## Table of Contents

1. [Overview](#overview)
2. [Data Collection by Mode](#data-collection-by-mode)
3. [How We Use Your Data](#how-we-use-your-data)
4. [Data Storage & Security](#data-storage--security)
5. [Data Retention](#data-retention)
6. [Children's Privacy (COPPA)](#childrens-privacy-coppa)
7. [GDPR Compliance](#gdpr-compliance)
8. [Your Rights](#your-rights)
9. [Third-Party Services](#third-party-services)
10. [Changes to This Policy](#changes-to-this-policy)
11. [Contact Us](#contact-us)

---

## Overview

The Allow2Automate Web Browsers Plugin is designed with **privacy as a priority**. We offer two tracking modes that collect different levels of data, and parents have full control over which mode to use.

### Our Privacy Principles

1. **Transparency**: We clearly explain what data is collected and why
2. **Parental Control**: Parents decide what level of tracking to enable
3. **Local Storage**: All data stored locally on your device by default
4. **No Third-Party Sharing**: We never sell or share your data with third parties
5. **Data Minimization**: We collect only the data necessary for functionality
6. **Right to Delete**: You can delete all collected data at any time

### Two Modes, Two Privacy Levels

- **Basic Mode (Default)**: Minimal data collection, process-level only
- **Enhanced Mode (Opt-In)**: Detailed tracking with explicit parental consent

---

## Data Collection by Mode

### Basic Mode (Process-Level Detection)

**What We Collect:**

| Data Type | Example | Purpose |
|-----------|---------|---------|
| Browser process names | "chrome.exe", "firefox" | Detect when browser is running |
| Browser start/stop times | "10:00 AM - 11:30 AM" | Calculate internet time usage |
| Total duration | "90 minutes" | Enforce internet time quotas |

**What We Do NOT Collect:**

- ❌ Websites visited
- ❌ URLs or domains
- ❌ Page content
- ❌ Search queries
- ❌ Form data or passwords
- ❌ Bookmarks or history
- ❌ Downloads
- ❌ Cookies or tracking data

**Privacy Level:** ⭐⭐⭐⭐⭐ Excellent

**Use Cases:**
- "My child used the internet for 2 hours today"
- "Block browsers after 9 PM"
- "Warn when 15 minutes remaining"

### Enhanced Mode (Browser Extension)

**Requires explicit parental consent before activation**

**What We Collect:**

| Data Type | Example | Purpose | Can Opt Out? |
|-----------|---------|---------|--------------|
| Domain names | "youtube.com", "roblox.com" | Track per-site time | No* |
| Time per domain | "YouTube: 45 minutes" | Enforce per-site limits | No* |
| Website categories | "Video", "Gaming", "Social" | Apply category quotas | No* |
| Idle status | "Active" or "Idle" | Pause quota when idle | Yes** |
| Active tab | "Currently on youtube.com" | Real-time enforcement | No* |

\* Required for enhanced mode functionality
\** Can disable idle detection in settings

**What We Do NOT Collect:**

- ❌ Full URLs (only domain: "youtube.com", not "youtube.com/watch?v=xyz123")
- ❌ Page content or text
- ❌ Search queries or form inputs
- ❌ Passwords or credentials
- ❌ Email or message content
- ❌ Screenshots or recordings
- ❌ Keystrokes
- ❌ Personal information beyond domains

**Privacy Level:** ⭐⭐⭐⭐☆ Good (with consent)

**Use Cases:**
- "My child spent 1 hour on social media, 2 hours on educational sites"
- "Block YouTube specifically"
- "Limit gaming sites to 1 hour/day"
- "See top 10 sites visited this week"

---

## How We Use Your Data

### Basic Mode

1. **Internet Time Tracking**: Count total time with browser open
2. **Quota Enforcement**: Block browsers when time limit reached
3. **Warnings**: Show notifications when approaching limit
4. **Reports**: Generate simple usage reports for parents

### Enhanced Mode

1. **Per-Site Tracking**: Record time spent on each website
2. **Category Quotas**: Apply limits to specific types of sites
3. **Real-Time Blocking**: Block specific sites or categories
4. **Detailed Reports**: Generate comprehensive browsing reports
5. **Trend Analysis**: Show usage patterns over time

### What We Do NOT Do

- ❌ **Sell your data** to third parties
- ❌ **Share your data** with advertisers
- ❌ **Use your data** for marketing
- ❌ **Transfer your data** to the cloud (unless you explicitly enable sync)
- ❌ **Monitor your data** for any purpose other than parental control

---

## Data Storage & Security

### Storage Location

**By Default:**
- All data stored **locally** on your device
- Database location: `/var/lib/allow2automate/browser-usage.db` (Linux/macOS) or `%APPDATA%\Allow2Automate\browser-usage.db` (Windows)
- No cloud synchronization unless explicitly enabled

**Optional Cloud Sync:**
- If you enable "Sync across devices" in settings, data encrypted and synced via Allow2 platform
- End-to-end encryption using AES-256
- Only you and authorized family members can access

### Data Encryption

- **At Rest**: Database encrypted with AES-256
- **In Transit**: All communication over HTTPS/TLS 1.3
- **Encryption Keys**: Stored in OS secure storage (Keychain on macOS, Credential Manager on Windows)

### Security Measures

1. **Access Control**: Only parent accounts can view browsing data
2. **Tamper Protection**: Configuration files protected from modification
3. **Secure Communication**: Native messaging uses authenticated IPC
4. **Code Signing**: Extension and native host digitally signed
5. **Regular Audits**: Quarterly security reviews

---

## Data Retention

### Automatic Deletion

- **Basic Mode**: Usage data retained for **30 days** by default
- **Enhanced Mode**: Browsing history retained for **30 days** by default
- Old data automatically deleted after retention period

### Manual Deletion

Parents can delete data at any time:

1. **Delete specific child's data**: Settings → Child Profile → Delete Browsing Data
2. **Delete all data**: Settings → Privacy → Delete All Data
3. **Export before delete**: Settings → Export Data (CSV format)

### Account Deletion

If you uninstall Allow2Automate or delete a child's account:
- All associated browsing data permanently deleted within **24 hours**
- No data retained after account deletion
- Confirmation email sent to parent

---

## Children's Privacy (COPPA)

The Allow2Automate Web Browsers Plugin complies with the **Children's Online Privacy Protection Act (COPPA)** for children under 13 years old.

### Parental Consent

**Required for Enhanced Mode:**

Before collecting detailed browsing data (Enhanced Mode), we require **verifiable parental consent**:

1. Parent logs into Allow2Automate account
2. Parent reviews this privacy policy
3. Parent explicitly clicks "I consent to detailed tracking"
4. Consent logged with timestamp and IP address
5. Parent can revoke consent at any time

**Not Required for Basic Mode:**

Basic mode uses only process-level data (no browsing history), which is necessary for the service and does not require additional consent beyond service enrollment.

### Child's Rights

Even with parental consent, we:

- Collect **only the minimum data** necessary for functionality
- Do **not sell or disclose** child data to third parties
- Allow parents to **review and delete** child data at any time
- Provide **clear privacy notices** about data collection

### Age Verification

- Parents must verify they are 18+ when creating account
- Child accounts must have parent/guardian assigned
- Parent email address verified before consent accepted

---

## GDPR Compliance

For users in the European Union, we comply with the **General Data Protection Regulation (GDPR)**.

### Lawful Basis for Processing

- **Legitimate Interest**: Parental control is a legitimate interest for family safety
- **Consent**: Enhanced mode requires explicit opt-in consent
- **Contract**: Basic mode necessary for service delivery

### Your GDPR Rights

1. **Right to Access**: View all data collected about your child
2. **Right to Rectification**: Correct inaccurate data
3. **Right to Erasure**: Delete all data ("right to be forgotten")
4. **Right to Restrict Processing**: Disable tracking temporarily
5. **Right to Data Portability**: Export data in standard format (CSV/JSON)
6. **Right to Object**: Object to processing (equivalent to disabling plugin)
7. **Right to Lodge Complaint**: Contact your local data protection authority

### Data Controller

**Allow2Automate (Parent Application)**
- Email: privacy@allow2automate.com
- Address: [Company Address]
- Data Protection Officer: [DPO Email]

### Data Transfers

- Data stored locally by default (no international transfer)
- If cloud sync enabled, data transferred to AWS US-East servers (Privacy Shield certified)
- EU data can be stored in EU-only servers (contact support to enable)

---

## Your Rights

### For Parents

**You have the right to:**

1. **Choose tracking mode**: Basic or Enhanced
2. **View all data**: See everything collected about your child
3. **Export data**: Download CSV or JSON reports
4. **Delete data**: Remove some or all browsing history
5. **Revoke consent**: Disable Enhanced mode at any time
6. **Configure retention**: Set custom data retention period (7-90 days)
7. **Disable plugin**: Turn off browser tracking completely

**How to exercise your rights:**
- In-app: Settings → Privacy & Data
- Email: privacy@allow2automate.com
- Response time: Within 30 days

### For Children

**If you are a child using this plugin:**

- Your parent or guardian has enabled monitoring of your internet usage
- This is for your safety and to help manage screen time
- You can ask your parent to show you what data is collected
- If you have concerns, talk to your parent or guardian

---

## Third-Party Services

### Services We Use

| Service | Purpose | Data Shared | Privacy Policy |
|---------|---------|-------------|----------------|
| Allow2 API | Quota synchronization | Child ID, usage totals (time only) | [Allow2 Privacy Policy] |
| Chrome Web Store | Extension distribution | None (extension installed locally) | [Google Privacy Policy] |
| Firefox Add-ons | Extension distribution | None (extension installed locally) | [Mozilla Privacy Policy] |

### Services We Do NOT Use

- ❌ Analytics (e.g., Google Analytics)
- ❌ Advertising networks
- ❌ Social media plugins
- ❌ Third-party tracking
- ❌ Data brokers

---

## Changes to This Policy

### Notification of Changes

If we make **material changes** to this privacy policy:

1. Email notification sent to parent email address
2. In-app notification displayed
3. 30-day notice before changes take effect
4. Option to review and re-consent if Enhanced mode affected

### Non-Material Changes

For minor clarifications or updates:
- "Last Updated" date changed at top of policy
- No notification required

### Version History

- v1.0.0 (2026-01-15): Initial policy

---

## Contact Us

### Privacy Questions or Concerns

**Email**: privacy@allow2automate.com
**Subject**: Web Browsers Plugin Privacy Inquiry

**Response Time**: Within 5 business days

### Data Requests

To exercise your privacy rights (access, delete, export):

1. **In-App**: Settings → Privacy & Data → Request Data
2. **Email**: privacy@allow2automate.com with subject "Data Request"
3. **Include**: Account email, child name, request type

### Security Issues

If you discover a security vulnerability:

**Email**: security@allow2automate.com
**Subject**: Security Issue - Web Browsers Plugin

We will respond within 48 hours and address confirmed issues immediately.

---

## Appendix: Technical Details

### Data Collection Summary Table

| Data Type | Basic Mode | Enhanced Mode | Encrypted? | Shared? |
|-----------|-----------|---------------|------------|---------|
| Browser process name | ✅ | ✅ | ✅ | ❌ |
| Browser running time | ✅ | ✅ | ✅ | ❌ |
| Domain names | ❌ | ✅ | ✅ | ❌ |
| Time per domain | ❌ | ✅ | ✅ | ❌ |
| Website categories | ❌ | ✅ | ✅ | ❌ |
| Idle status | ❌ | ✅ | ✅ | ❌ |
| Full URLs | ❌ | ❌ | N/A | ❌ |
| Page content | ❌ | ❌ | N/A | ❌ |
| Personal info | ❌ | ❌ | N/A | ❌ |

### Browser Extension Permissions

**Chrome/Edge Extension Permissions:**

| Permission | Purpose | Data Access |
|-----------|---------|-------------|
| `tabs` | Track active tab | URL, title of tabs |
| `activeTab` | Identify current tab | Current tab only |
| `idle` | Detect user idle | Idle status only |
| `nativeMessaging` | Communicate with app | Messages only |
| `storage` | Save state | Extension data only |
| `<all_urls>` | Monitor all sites | Domain names only |

**Why `<all_urls>` is required:**

This permission appears alarming but is necessary to:
- Detect which website is active (domain only)
- Block specific sites when quota exhausted
- Does NOT grant access to page content

### Data Minimization Techniques

1. **Domain-Only Logging**: Store "youtube.com", not "youtube.com/watch?v=xyz123&t=45"
2. **Aggregation**: Store total time, not individual visits
3. **Sampling**: Check active tab every 5 seconds, not continuously
4. **Lazy Loading**: Only load historical data when parent views reports
5. **Auto-Pruning**: Delete old data automatically

---

## Consent Form Template

**Parent Consent for Enhanced Browser Tracking**

I, [Parent Name], as the parent/guardian of [Child Name], have read and understood the Allow2Automate Web Browsers Plugin Privacy Policy dated 2026-01-15.

**I understand that Enhanced Mode will collect:**
- Domain names of websites visited (e.g., "youtube.com")
- Time spent on each website
- Website categories (social media, gaming, education, etc.)
- Browser idle status

**I understand that this data will be:**
- Stored locally on my device (encrypted)
- Used only for parental control and time management
- Visible to me and other authorized parents
- NOT shared with third parties
- Retained for 30 days unless I change settings
- Deletable at any time

**I consent to this data collection for my child's account.**

☐ Yes, I consent to Enhanced Mode tracking
☐ No, keep Basic Mode only

**Parent Signature:** ___________________________
**Date:** ___________________________
**IP Address:** [Auto-recorded]
**Timestamp:** [Auto-recorded]

---

## FAQ

**Q: Can my child see what data is collected?**
A: Yes. Parents can show children the usage reports. Children cannot access data directly.

**Q: Can my child delete their browsing history?**
A: No. Only parents can delete data to prevent circumventing controls.

**Q: Does the extension read my passwords?**
A: Absolutely not. We only track domain names and time, never page content or form data.

**Q: What if I uninstall the browser extension?**
A: The plugin will automatically switch to Basic Mode. You'll still get internet time tracking, just without per-site details.

**Q: Can I review data before it's logged?**
A: No, data is logged automatically for accuracy. However, you can delete any data after collection.

**Q: Is data synchronized between devices?**
A: Only if you enable "Sync across devices" in settings. Otherwise, data stays local.

**Q: What happens if I sell my computer?**
A: Delete all data via Settings → Privacy → Delete All Data before selling. Data is permanently erased.

**Q: Can law enforcement access this data?**
A: We do not have access to your local data. If served with a valid warrant, we can only provide data you've synced to our servers (if sync enabled).

**Q: Is this compliant with school privacy policies?**
A: Yes, this is a parental control tool for home use. Schools should use their own monitoring tools. Check your school's acceptable use policy.

---

**Last Review Date:** 2026-01-15
**Next Review Date:** 2027-01-15

For the most current version of this policy, visit: https://allow2automate.com/privacy/webbrowsers

---

**Acknowledgment:**

By using the Allow2Automate Web Browsers Plugin, you acknowledge that you have read, understood, and agree to this Privacy Policy.

- For **Basic Mode**: Acknowledgment through service enrollment
- For **Enhanced Mode**: Explicit consent required (see form above)
