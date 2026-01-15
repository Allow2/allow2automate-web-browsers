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

const log = Logger.createScoped('ExtensionDetector');

/**
 * ExtensionDetector - Enhanced mode browser detection.
 * Communicates with browser extensions via native messaging for detailed tracking.
 * Provides per-site tracking, category classification, and real-time blocking.
 *
 * Events:
 * - 'browser-started': Fired when extension connects
 * - 'browser-stopped': Fired when extension disconnects
 * - 'activity-report': Periodic activity data from extension
 * - 'tab-changed': Real-time tab change notification
 * - 'idle-state-changed': User idle state change
 * - 'extension-connected': Extension established connection
 * - 'extension-disconnected': Extension lost connection
 */
class ExtensionDetector {
    /**
     * Create an ExtensionDetector.
     * @param {Object} context Plugin context with services
     */
    constructor(context) {
        this.context = context;
        this.listeners = new Map();
        this.connectedExtensions = new Map(); // browser -> connectionInfo
        this.activityBuffer = [];
        this.isRunning = false;
        this.ipcHandlersRegistered = false;
    }

    /**
     * Get the detection mode identifier.
     * @returns {string} Mode name
     */
    getMode() {
        return 'enhanced';
    }

    /**
     * Get capabilities available in this detection mode.
     * @returns {Object} Capability flags
     */
    getCapabilities() {
        return {
            browserDetection: true,
            totalTimeTracking: true,
            perSiteTracking: true,
            categoryClassification: true,
            idleDetection: true,
            realTimeBlocking: true,
            extensionRequired: true
        };
    }

    /**
     * Start enhanced mode monitoring.
     */
    async start() {
        if (this.isRunning) {
            log.warn('Already running');
            return;
        }

        log.info('Starting enhanced mode monitoring');
        this.isRunning = true;

        // Register IPC handlers for extension communication
        this.registerIpcHandlers();

        // Check for existing extension connections
        await this.checkExtensions();
    }

    /**
     * Stop enhanced mode monitoring.
     */
    async stop() {
        if (!this.isRunning) {
            return;
        }

        log.info('Stopping monitoring');
        this.isRunning = false;

        // Emit disconnection events
        for (const [browser, info] of this.connectedExtensions.entries()) {
            this.emit('browser-stopped', {
                name: browser,
                duration: Date.now() - info.connectedAt
            });
        }

        this.connectedExtensions.clear();
        this.activityBuffer = [];
    }

    /**
     * Register IPC handlers for extension communication.
     */
    registerIpcHandlers() {
        if (this.ipcHandlersRegistered || !this.context?.ipcMain) {
            return;
        }

        const { ipcMain } = this.context;

        // Handle extension handshake
        ipcMain.handle('webBrowsers:extensionConnect', async (event, data) => {
            return this.handleExtensionConnect(data);
        });

        // Handle activity report from extension
        ipcMain.handle('webBrowsers:activityReport', async (event, data) => {
            return this.handleActivityReport(data);
        });

        // Handle tab change notification
        ipcMain.handle('webBrowsers:tabChanged', async (event, data) => {
            return this.handleTabChanged(data);
        });

        // Handle idle state change
        ipcMain.handle('webBrowsers:idleState', async (event, data) => {
            return this.handleIdleState(data);
        });

        // Handle extension disconnect
        ipcMain.handle('webBrowsers:extensionDisconnect', async (event, data) => {
            return this.handleExtensionDisconnect(data);
        });

        this.ipcHandlersRegistered = true;
        log.debug('IPC handlers registered');
    }

    /**
     * Handle extension connection request.
     * @param {Object} data Connection data from extension
     * @returns {Object} Connection response
     */
    handleExtensionConnect(data) {
        const { browser, version, extensionId } = data;

        log.info(`Extension connected: ${browser} v${version}`);

        this.connectedExtensions.set(browser, {
            version,
            extensionId,
            connectedAt: Date.now(),
            lastActivity: Date.now()
        });

        this.emit('extension-connected', { browser, version });
        this.emit('browser-started', {
            name: browser,
            extensionAvailable: true
        });

        return {
            success: true,
            capabilities: this.getCapabilities(),
            config: this.getExtensionConfig()
        };
    }

    /**
     * Handle activity report from extension.
     * @param {Object} data Activity data
     */
    handleActivityReport(data) {
        const { browser, history, currentTab, timestamp } = data;

        // Update last activity time
        const conn = this.connectedExtensions.get(browser);
        if (conn) {
            conn.lastActivity = Date.now();
        }

        // Buffer activity data
        this.activityBuffer.push({
            browser,
            timestamp,
            history: history || [],
            currentTab
        });

        // Limit buffer size
        if (this.activityBuffer.length > 1000) {
            this.activityBuffer = this.activityBuffer.slice(-500);
        }

        // Emit activity report event
        this.emit('activity-report', {
            browser,
            history,
            currentTab
        });

        return { success: true };
    }

    /**
     * Handle tab change notification.
     * @param {Object} data Tab change data
     */
    handleTabChanged(data) {
        const { browser, url, title, category } = data;

        this.emit('tab-changed', {
            browser,
            url,
            title,
            category,
            timestamp: Date.now()
        });

        return { success: true };
    }

    /**
     * Handle idle state change.
     * @param {Object} data Idle state data
     */
    handleIdleState(data) {
        const { browser, idle, idleTime } = data;

        this.emit('idle-state-changed', {
            browser,
            idle,
            idleTime
        });

        return { success: true };
    }

    /**
     * Handle extension disconnect.
     * @param {Object} data Disconnect data
     */
    handleExtensionDisconnect(data) {
        const { browser, reason } = data;

        log.info(`Extension disconnected: ${browser} (${reason})`);

        const conn = this.connectedExtensions.get(browser);
        if (conn) {
            this.emit('browser-stopped', {
                name: browser,
                duration: Date.now() - conn.connectedAt
            });
            this.emit('extension-disconnected', { browser, reason });
        }

        this.connectedExtensions.delete(browser);

        return { success: true };
    }

    /**
     * Get configuration for extension.
     * @returns {Object} Extension configuration
     */
    getExtensionConfig() {
        return {
            reportInterval: 30000, // Report every 30 seconds
            trackIdleState: true,
            idleThreshold: 300, // 5 minutes
            sendTabChanges: true
        };
    }

    /**
     * Check for existing extension connections.
     */
    async checkExtensions() {
        // Extensions will connect via IPC when they're ready
        // This method is a placeholder for any initial checks
        log.debug('Checking for extension connections...');
    }

    /**
     * Check if extension mode is available.
     * @returns {Promise<boolean>} True if extensions can be used
     */
    async checkAvailable() {
        // In a real implementation, this would check for native messaging host
        // For now, return true if any extensions are connected
        return this.connectedExtensions.size > 0;
    }

    /**
     * Check if any browser is currently active (extension connected).
     * @returns {boolean} True if at least one extension is connected
     */
    isBrowserActive() {
        return this.connectedExtensions.size > 0;
    }

    /**
     * Get list of browsers with connected extensions.
     * @returns {Array} Array of browser info objects
     */
    getActiveBrowsers() {
        return Array.from(this.connectedExtensions.entries()).map(([browser, info]) => ({
            name: browser,
            extensionAvailable: true,
            connectedAt: info.connectedAt,
            lastActivity: info.lastActivity
        }));
    }

    /**
     * Get detailed usage data for a specific child.
     * @param {string} childId Child identifier
     * @returns {Object} Detailed usage data
     */
    getUsageData(childId) {
        // Aggregate activity from buffer
        const history = this.activityBuffer.flatMap(report => report.history || []);

        // Group by domain
        const siteStats = {};
        for (const entry of history) {
            const domain = entry.url || entry.domain;
            if (!domain) continue;

            if (!siteStats[domain]) {
                siteStats[domain] = {
                    domain,
                    totalTime: 0,
                    category: entry.category || 'other',
                    visits: 0
                };
            }

            siteStats[domain].totalTime += entry.duration || 0;
            siteStats[domain].visits += 1;
        }

        // Sort by time spent
        const topSites = Object.values(siteStats)
            .sort((a, b) => b.totalTime - a.totalTime)
            .slice(0, 20);

        // Category breakdown
        const categoryStats = {};
        for (const site of Object.values(siteStats)) {
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
            totalSites: Object.keys(siteStats).length,
            extensionsConnected: Array.from(this.connectedExtensions.keys())
        };
    }

    /**
     * Send command to block a specific site.
     * @param {string} url URL or domain to block
     */
    async blockSite(url) {
        for (const browser of this.connectedExtensions.keys()) {
            this.sendToExtension(browser, {
                type: 'block_site',
                url
            });
        }
    }

    /**
     * Send command to block a category.
     * @param {string} category Category to block
     */
    async blockCategory(category) {
        for (const browser of this.connectedExtensions.keys()) {
            this.sendToExtension(browser, {
                type: 'block_category',
                category
            });
        }
    }

    /**
     * Send command to block all sites.
     */
    async blockAllSites() {
        for (const browser of this.connectedExtensions.keys()) {
            this.sendToExtension(browser, {
                type: 'block_all'
            });
        }
    }

    /**
     * Send command to unblock.
     * @param {Object} params Unblock parameters
     */
    async unblock(params = {}) {
        for (const browser of this.connectedExtensions.keys()) {
            this.sendToExtension(browser, {
                type: 'unblock',
                ...params
            });
        }
    }

    /**
     * Send message to extension.
     * @param {string} browser Browser identifier
     * @param {Object} message Message to send
     */
    sendToExtension(browser, message) {
        // In a real implementation, this would use native messaging
        // For now, use IPC if available
        if (this.context?.webContents) {
            this.context.webContents.send(`webBrowsers:toExtension:${browser}`, message);
        }
        log.debug(`Sent to ${browser}:`, message);
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

export default ExtensionDetector;
