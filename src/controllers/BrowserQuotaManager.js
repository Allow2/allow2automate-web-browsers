// Copyright [2021] [Allow2 Pty Ltd]
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict';

import Logger from '../utils/Logger';
import WebsiteClassifier from '../classifiers/WebsiteClassifier';

const log = Logger.createScoped('BrowserQuotaManager');

/**
 * BrowserQuotaManager - Tracks browser usage and enforces quotas.
 * Works with both basic and enhanced mode detectors.
 *
 * Events:
 * - 'quota-warning': Approaching quota limit
 * - 'quota-exhausted': Quota has been reached
 * - 'usage-update': Periodic usage update
 */
class BrowserQuotaManager {
    /**
     * Create a BrowserQuotaManager.
     * @param {Object} config Plugin configuration
     * @param {Object} detector Active browser detector
     * @param {Object} context Plugin context
     */
    constructor(config, detector, context) {
        this.config = config || {};
        this.detector = detector;
        this.context = context;
        this.listeners = new Map();

        // Usage tracking per child
        this.usage = new Map(); // childId -> UsageData

        // Timing
        this.intervals = [];
        this.isRunning = false;

        // Services
        this.classifier = new WebsiteClassifier();

        // Warning thresholds (minutes remaining)
        this.warningThresholds = [15, 5, 1];
    }

    /**
     * Start quota monitoring.
     */
    async start() {
        if (this.isRunning) {
            return;
        }

        log.info('Starting quota monitoring');
        this.isRunning = true;

        // Listen to detector events
        this.setupDetectorListeners();

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

    /**
     * Stop quota monitoring.
     */
    async stop() {
        if (!this.isRunning) {
            return;
        }

        log.info('Stopping quota monitoring');
        this.isRunning = false;

        // Clear intervals
        this.intervals.forEach(interval => clearInterval(interval));
        this.intervals = [];
    }

    /**
     * Setup listeners for detector events.
     */
    setupDetectorListeners() {
        if (!this.detector) {
            return;
        }

        this.detector.on('browser-started', (data) => {
            this.handleBrowserStarted(data);
        });

        this.detector.on('browser-stopped', (data) => {
            this.handleBrowserStopped(data);
        });

        // Enhanced mode events
        if (this.detector.getMode() === 'enhanced' || this.detector.getMode() === 'hybrid') {
            this.detector.on('activity-report', (data) => {
                this.handleActivityReport(data);
            });
        }
    }

    /**
     * Handle browser started event.
     * @param {Object} data Browser info
     */
    handleBrowserStarted(data) {
        log.debug(`Browser started: ${data.name}`);

        const session = this.getActiveSession();
        if (!session) {
            return;
        }

        const childId = session.childId;
        this.ensureUsageData(childId);

        const usage = this.usage.get(childId);
        usage.browserActive = true;
        usage.lastUpdate = Date.now();
        usage.activeBrowsers.add(data.name);
    }

    /**
     * Handle browser stopped event.
     * @param {Object} data Browser info with duration
     */
    handleBrowserStopped(data) {
        log.debug(`Browser stopped: ${data.name}, duration: ${Math.round(data.duration / 1000)}s`);

        const session = this.getActiveSession();
        if (!session) {
            return;
        }

        const usage = this.usage.get(session.childId);
        if (usage) {
            usage.activeBrowsers.delete(data.name);
            usage.browserActive = usage.activeBrowsers.size > 0;
        }
    }

    /**
     * Handle activity report from enhanced mode.
     * @param {Object} data Activity data with site history
     */
    handleActivityReport(data) {
        const session = this.getActiveSession();
        if (!session) {
            return;
        }

        const usage = this.usage.get(session.childId);
        if (!usage) {
            return;
        }

        // Merge history
        if (data.history && Array.isArray(data.history)) {
            for (const entry of data.history) {
                // Classify if not already classified
                if (!entry.category) {
                    const classification = this.classifier.classify(entry.url);
                    entry.category = classification.category;
                }

                usage.siteHistory.push(entry);

                // Update category usage
                const category = entry.category || 'other';
                const duration = entry.duration || 0;
                usage.categoryUsage[category] = (usage.categoryUsage[category] || 0) + duration;
            }
        }

        // Limit history size
        if (usage.siteHistory.length > 1000) {
            usage.siteHistory = usage.siteHistory.slice(-500);
        }
    }

    /**
     * Update usage counters.
     */
    updateUsage() {
        const session = this.getActiveSession();
        if (!session) {
            return;
        }

        const usage = this.usage.get(session.childId);
        if (!usage) {
            return;
        }

        const now = Date.now();
        const elapsed = (now - usage.lastUpdate) / 1000; // seconds

        if (usage.browserActive) {
            // Add time to internet quota
            usage.internetTime += elapsed;
        }

        usage.lastUpdate = now;

        // Emit usage update
        this.emit('usage-update', {
            childId: session.childId,
            internetTime: usage.internetTime,
            browserActive: usage.browserActive,
            activeBrowsers: Array.from(usage.activeBrowsers)
        });
    }

    /**
     * Check quotas and emit warnings/exhaustion events.
     */
    async checkQuotas() {
        for (const [childId, usage] of this.usage.entries()) {
            const childConfig = this.getChildConfig(childId);
            if (!childConfig) {
                continue;
            }

            // Check internet time quota
            await this.checkInternetQuota(childId, usage, childConfig);

            // Check category quotas (enhanced mode only)
            if (this.detector.getMode() === 'enhanced' || this.detector.getMode() === 'hybrid') {
                await this.checkCategoryQuotas(childId, usage, childConfig);
            }
        }
    }

    /**
     * Check internet time quota for a child.
     * @param {string} childId Child identifier
     * @param {Object} usage Usage data
     * @param {Object} config Child configuration
     */
    async checkInternetQuota(childId, usage, config) {
        const internetMinutes = usage.internetTime / 60;
        const internetQuota = config.internetTimeDaily;

        if (!internetQuota || internetQuota === null) {
            return; // Unlimited
        }

        const remaining = internetQuota - internetMinutes;

        if (remaining <= 0) {
            if (!usage.exhaustedInternet) {
                usage.exhaustedInternet = true;
                this.emit('quota-exhausted', {
                    childId,
                    type: 'internet',
                    used: Math.round(internetMinutes),
                    quota: internetQuota
                });
            }
        } else {
            usage.exhaustedInternet = false;

            // Check warning thresholds
            for (const threshold of this.warningThresholds) {
                const warnKey = `warned_internet_${threshold}`;
                if (remaining <= threshold && !usage[warnKey]) {
                    usage[warnKey] = true;
                    this.emit('quota-warning', {
                        childId,
                        type: 'internet',
                        remaining: Math.round(remaining),
                        threshold
                    });
                }
            }
        }
    }

    /**
     * Check category quotas for a child.
     * @param {string} childId Child identifier
     * @param {Object} usage Usage data
     * @param {Object} config Child configuration
     */
    async checkCategoryQuotas(childId, usage, config) {
        const categoryQuotas = config.categoryQuotas;
        if (!categoryQuotas) {
            return;
        }

        for (const [category, quota] of Object.entries(categoryQuotas)) {
            if (quota === null || quota === undefined) {
                continue; // Unlimited
            }

            const categorySeconds = usage.categoryUsage[category] || 0;
            const categoryMinutes = categorySeconds / 60;
            const remaining = quota - categoryMinutes;

            const exhaustedKey = `exhausted_${category}`;
            const warnedKey = `warned_${category}`;

            if (remaining <= 0) {
                if (!usage[exhaustedKey]) {
                    usage[exhaustedKey] = true;
                    this.emit('quota-exhausted', {
                        childId,
                        type: 'category',
                        category,
                        used: Math.round(categoryMinutes),
                        quota
                    });
                }
            } else {
                usage[exhaustedKey] = false;

                // Warning at 5 minutes for categories
                if (remaining <= 5 && !usage[warnedKey]) {
                    usage[warnedKey] = true;
                    this.emit('quota-warning', {
                        childId,
                        type: 'category',
                        category,
                        remaining: Math.round(remaining)
                    });
                }
            }
        }
    }

    /**
     * Ensure usage data exists for a child.
     * @param {string} childId Child identifier
     */
    ensureUsageData(childId) {
        if (!this.usage.has(childId)) {
            this.usage.set(childId, {
                internetTime: 0,
                siteHistory: [],
                categoryUsage: {},
                lastUpdate: Date.now(),
                browserActive: false,
                activeBrowsers: new Set()
            });
        }
    }

    /**
     * Get current active session.
     * @returns {Object|null} Session object or null
     */
    getActiveSession() {
        if (this.context?.services?.sessionMonitor) {
            return this.context.services.sessionMonitor.getCurrentSession();
        }

        // Fallback: return default session for testing
        return this.config.defaultSession || null;
    }

    /**
     * Get configuration for a specific child.
     * @param {string} childId Child identifier
     * @returns {Object|null} Child configuration
     */
    getChildConfig(childId) {
        if (this.config.children && this.config.children[childId]) {
            return this.config.children[childId];
        }
        return this.config.defaultChildConfig || null;
    }

    /**
     * Update configuration.
     * @param {Object} newConfig New configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        log.debug('Configuration updated');
    }

    /**
     * Get usage report for a child.
     * @param {string} childId Child identifier
     * @returns {Object|null} Usage report
     */
    getUsageReport(childId) {
        const usage = this.usage.get(childId);
        if (!usage) {
            return null;
        }

        const config = this.getChildConfig(childId);
        const internetQuota = config?.internetTimeDaily || null;

        const report = {
            internetTime: Math.round(usage.internetTime / 60), // minutes
            internetQuota,
            internetRemaining: internetQuota
                ? Math.max(0, internetQuota - usage.internetTime / 60)
                : null,
            browserActive: usage.browserActive,
            activeBrowsers: Array.from(usage.activeBrowsers),
            mode: this.detector?.getMode() || 'unknown'
        };

        // Enhanced mode additions
        if (this.detector?.getMode() === 'enhanced' || this.detector?.getMode() === 'hybrid') {
            const categoryStats = this.classifier.getCategoryStats(usage.siteHistory);

            report.categoryUsage = usage.categoryUsage;
            report.categoryStats = categoryStats;
            report.topSites = this.getTopSites(usage.siteHistory);
        }

        return report;
    }

    /**
     * Get top sites from history.
     * @param {Array} history Site history
     * @returns {Array} Top sites sorted by time
     */
    getTopSites(history) {
        const siteMap = {};

        for (const entry of history) {
            const domain = entry.url || entry.domain;
            if (!domain) continue;

            if (!siteMap[domain]) {
                siteMap[domain] = {
                    domain,
                    totalTime: 0,
                    visits: 0,
                    category: entry.category || 'other'
                };
            }

            siteMap[domain].totalTime += entry.duration || 0;
            siteMap[domain].visits += 1;
        }

        return Object.values(siteMap)
            .sort((a, b) => b.totalTime - a.totalTime)
            .slice(0, 20);
    }

    /**
     * Reset usage for a child (e.g., at midnight).
     * @param {string} childId Child identifier
     */
    resetUsage(childId) {
        this.usage.delete(childId);
        log.info(`Usage reset for child: ${childId}`);
    }

    /**
     * Reset all usage data.
     */
    resetAllUsage() {
        this.usage.clear();
        log.info('All usage data reset');
    }

    /**
     * Register an event listener.
     * @param {string} event Event name
     * @param {Function} callback Callback function
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    /**
     * Remove an event listener.
     * @param {string} event Event name
     * @param {Function} callback Callback function
     */
    off(event, callback) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index !== -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    /**
     * Emit an event to all listeners.
     * @param {string} event Event name
     * @param {Object} data Event data
     */
    emit(event, data) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            for (const callback of callbacks) {
                try {
                    callback(data);
                } catch (error) {
                    log.error(`Error in ${event} listener`, error);
                }
            }
        }
    }
}

export default BrowserQuotaManager;
