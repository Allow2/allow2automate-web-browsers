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

import BrowserPatterns from '../utils/BrowserPatterns';
import Logger from '../utils/Logger';

const log = Logger.createScoped('ProcessLevelDetector');

/**
 * ProcessLevelDetector - Basic mode browser detection.
 * Detects running browser processes using OS process monitoring.
 * Provides total browser time tracking without per-site details.
 *
 * Events:
 * - 'browser-started': Fired when a browser process is detected starting
 * - 'browser-stopped': Fired when a browser process terminates
 * - 'browsers-update': Periodic update with current browser state
 */
class ProcessLevelDetector {
    /**
     * Create a ProcessLevelDetector.
     * @param {Object} context Plugin context with services
     */
    constructor(context) {
        this.context = context;
        this.listeners = new Map();
        this.activeBrowsers = new Map(); // pid -> BrowserInfo
        this.scanInterval = null;
        this.scanIntervalMs = 5000; // Scan every 5 seconds
        this.isRunning = false;
    }

    /**
     * Get the detection mode identifier.
     * @returns {string} Mode name
     */
    getMode() {
        return 'basic';
    }

    /**
     * Get capabilities available in this detection mode.
     * @returns {Object} Capability flags
     */
    getCapabilities() {
        return {
            browserDetection: true,
            totalTimeTracking: true,
            perSiteTracking: false,
            categoryClassification: false,
            idleDetection: false,
            realTimeBlocking: false,
            extensionRequired: false
        };
    }

    /**
     * Start browser monitoring.
     */
    async start() {
        if (this.isRunning) {
            log.warn('Already running');
            return;
        }

        log.info('Starting basic mode monitoring');
        this.isRunning = true;

        // Perform initial scan
        await this.scanBrowsers();

        // Start periodic scanning
        this.scanInterval = setInterval(() => {
            this.scanBrowsers();
        }, this.scanIntervalMs);
    }

    /**
     * Stop browser monitoring.
     */
    async stop() {
        if (!this.isRunning) {
            return;
        }

        log.info('Stopping monitoring');
        this.isRunning = false;

        if (this.scanInterval) {
            clearInterval(this.scanInterval);
            this.scanInterval = null;
        }

        // Emit stopped events for all active browsers
        for (const [pid, info] of this.activeBrowsers.entries()) {
            const duration = Date.now() - info.startTime;
            this.emit('browser-stopped', {
                ...info,
                duration
            });
        }

        this.activeBrowsers.clear();
    }

    /**
     * Scan for running browser processes.
     */
    async scanBrowsers() {
        try {
            const processes = await this.getProcessList();
            const currentBrowserPids = new Set();

            for (const proc of processes) {
                const browserInfo = this.identifyBrowser(proc);

                if (browserInfo) {
                    currentBrowserPids.add(proc.pid);

                    // Check if this is a new browser process
                    if (!this.activeBrowsers.has(proc.pid)) {
                        const info = {
                            ...browserInfo,
                            pid: proc.pid,
                            startTime: Date.now()
                        };

                        this.activeBrowsers.set(proc.pid, info);
                        log.debug(`Browser started: ${browserInfo.name} (PID: ${proc.pid})`);
                        this.emit('browser-started', info);
                    }
                }
            }

            // Detect terminated browsers
            for (const [pid, info] of this.activeBrowsers.entries()) {
                if (!currentBrowserPids.has(pid)) {
                    const duration = Date.now() - info.startTime;
                    log.debug(`Browser stopped: ${info.name} (PID: ${pid}, duration: ${Math.round(duration / 1000)}s)`);

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
            log.error('Scan error', error);
        }
    }

    /**
     * Get list of running processes.
     * Uses process monitor service if available, otherwise falls back.
     * @returns {Promise<Array>} Array of process objects
     */
    async getProcessList() {
        // Try to use the process monitor service from context
        if (this.context?.services?.processMonitor) {
            return this.context.services.processMonitor.getProcessList();
        }

        // Fallback: Return empty array (will be populated by host app)
        log.warn('No process monitor available, browser detection may be limited');
        return [];
    }

    /**
     * Identify if a process is a browser.
     * @param {Object} proc Process object with name and path
     * @returns {Object|null} Browser info or null if not a browser
     */
    identifyBrowser(proc) {
        if (!proc || !proc.name) {
            return null;
        }

        const browserName = BrowserPatterns.getBrowserName(proc.name);

        if (browserName) {
            return {
                name: browserName,
                displayName: BrowserPatterns.getDisplayName(browserName),
                processName: proc.name,
                executable: proc.path || '',
                icon: BrowserPatterns.getBrowserIcon(browserName)
            };
        }

        // Try path-based detection if process name didn't match
        if (proc.path) {
            const pathBrowser = BrowserPatterns.getBrowserName(proc.path);
            if (pathBrowser) {
                return {
                    name: pathBrowser,
                    displayName: BrowserPatterns.getDisplayName(pathBrowser),
                    processName: proc.name,
                    executable: proc.path,
                    icon: BrowserPatterns.getBrowserIcon(pathBrowser)
                };
            }
        }

        return null;
    }

    /**
     * Check if any browser is currently active.
     * @returns {boolean} True if at least one browser is running
     */
    isBrowserActive() {
        return this.activeBrowsers.size > 0;
    }

    /**
     * Get list of currently active browsers.
     * @returns {Array} Array of active browser info objects
     */
    getActiveBrowsers() {
        return Array.from(this.activeBrowsers.values());
    }

    /**
     * Get unique browser types currently active.
     * @returns {Array<string>} Array of browser identifiers
     */
    getActiveBrowserTypes() {
        const types = new Set();
        for (const browser of this.activeBrowsers.values()) {
            types.add(browser.name);
        }
        return Array.from(types);
    }

    /**
     * Get usage data for a specific child.
     * In basic mode, only total browser time is available.
     * @param {string} childId Child identifier
     * @returns {Object} Usage data
     */
    getUsageData(childId) {
        return {
            mode: 'basic',
            browsersDetected: this.getActiveBrowserTypes().map(b =>
                BrowserPatterns.getDisplayName(b)
            ),
            currentlyActive: this.isBrowserActive(),
            activeCount: this.activeBrowsers.size,
            detailAvailable: false,
            message: 'Install browser extension for per-site tracking'
        };
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

    /**
     * Kill a specific browser process.
     * @param {number} pid Process ID
     */
    async killBrowser(pid) {
        if (this.context?.services?.processMonitor?.killProcess) {
            await this.context.services.processMonitor.killProcess(pid);
        } else {
            log.warn('Cannot kill process: no process monitor available');
        }
    }

    /**
     * Kill all running browser processes.
     */
    async killAllBrowsers() {
        const pids = Array.from(this.activeBrowsers.keys());
        for (const pid of pids) {
            await this.killBrowser(pid);
        }
    }
}

export default ProcessLevelDetector;
