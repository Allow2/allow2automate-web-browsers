// Copyright [2025] [Allow2 Pty Ltd]
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

/**
 * Browser Detector Monitor
 *
 * This monitor script is DEPLOYED TO THE AGENT via PLUGIN_EXTENSIONS.
 * It runs periodically on the agent machine to detect running browser processes.
 *
 * The script function is serialized and sent to the agent, where it runs
 * in a sandboxed environment with access to Node.js built-in modules.
 */
export default {
    id: 'browser-detector',
    interval: 10000,  // Check every 10 seconds (configurable from parent)
    platforms: ['win32', 'darwin', 'linux'],

    /**
     * Script that runs ON THE AGENT to detect browsers
     * This function is serialized and executed in the agent's sandbox
     *
     * @returns {Object} Browser detection data to send to parent
     */
    script: function() {
        const { execSync } = require('child_process');
        const os = require('os');

        // Browser process patterns by platform
        const browserPatterns = {
            win32: {
                chrome: ['chrome.exe'],
                firefox: ['firefox.exe'],
                edge: ['msedge.exe'],
                brave: ['brave.exe'],
                opera: ['opera.exe'],
                vivaldi: ['vivaldi.exe']
            },
            darwin: {
                chrome: ['Google Chrome', 'chrome'],
                firefox: ['firefox', 'Firefox'],
                safari: ['Safari'],
                edge: ['Microsoft Edge'],
                brave: ['Brave Browser'],
                opera: ['Opera'],
                vivaldi: ['Vivaldi'],
                arc: ['Arc']
            },
            linux: {
                chrome: ['chrome', 'google-chrome', 'chromium', 'chromium-browser'],
                firefox: ['firefox', 'firefox-esr'],
                edge: ['microsoft-edge', 'msedge'],
                brave: ['brave', 'brave-browser'],
                opera: ['opera'],
                vivaldi: ['vivaldi']
            }
        };

        /**
         * Get list of running processes for the current platform
         */
        function getProcessList() {
            const platform = process.platform;
            let processes = [];

            try {
                if (platform === 'win32') {
                    // Windows: Use WMIC or tasklist
                    const output = execSync('wmic process get name,processid /format:csv', {
                        encoding: 'utf8',
                        timeout: 5000,
                        windowsHide: true
                    });

                    const lines = output.split('\n').filter(line => line.trim());
                    for (const line of lines.slice(1)) { // Skip header
                        const parts = line.split(',');
                        if (parts.length >= 3) {
                            processes.push({
                                name: parts[1]?.trim(),
                                pid: parseInt(parts[2]?.trim(), 10)
                            });
                        }
                    }
                } else if (platform === 'darwin') {
                    // macOS: Use ps command
                    const output = execSync('ps -axco pid,comm', {
                        encoding: 'utf8',
                        timeout: 5000
                    });

                    const lines = output.split('\n').filter(line => line.trim());
                    for (const line of lines.slice(1)) { // Skip header
                        const match = line.trim().match(/^(\d+)\s+(.+)$/);
                        if (match) {
                            processes.push({
                                pid: parseInt(match[1], 10),
                                name: match[2].trim()
                            });
                        }
                    }
                } else {
                    // Linux: Use ps command
                    const output = execSync('ps -eo pid,comm --no-headers', {
                        encoding: 'utf8',
                        timeout: 5000
                    });

                    const lines = output.split('\n').filter(line => line.trim());
                    for (const line of lines) {
                        const match = line.trim().match(/^(\d+)\s+(.+)$/);
                        if (match) {
                            processes.push({
                                pid: parseInt(match[1], 10),
                                name: match[2].trim()
                            });
                        }
                    }
                }
            } catch (error) {
                console.error('[BrowserDetector] Error getting process list:', error.message);
            }

            return processes;
        }

        /**
         * Identify browsers from process list
         */
        function detectBrowsers(processes) {
            const platform = process.platform;
            const patterns = browserPatterns[platform] || browserPatterns.linux;
            const detected = [];

            for (const proc of processes) {
                const procName = proc.name?.toLowerCase() || '';

                for (const [browser, browserNames] of Object.entries(patterns)) {
                    const isMatch = browserNames.some(name =>
                        procName === name.toLowerCase() ||
                        procName.includes(name.toLowerCase())
                    );

                    if (isMatch) {
                        // Check if this browser is already detected
                        if (!detected.find(d => d.browser === browser)) {
                            detected.push({
                                browser,
                                processName: proc.name,
                                pid: proc.pid,
                                detectedAt: Date.now()
                            });
                        }
                    }
                }
            }

            return detected;
        }

        /**
         * Get current active user
         */
        function getActiveUser() {
            try {
                const userInfo = os.userInfo();
                return userInfo.username;
            } catch (error) {
                return 'unknown';
            }
        }

        // Execute detection
        const processes = getProcessList();
        const activeBrowsers = detectBrowsers(processes);

        // Return data to be sent to parent
        return {
            timestamp: Date.now(),
            hostname: os.hostname(),
            username: getActiveUser(),
            platform: process.platform,
            browsersActive: activeBrowsers.length > 0,
            browsers: activeBrowsers,
            browserCount: activeBrowsers.length,
            detectedBrowserNames: activeBrowsers.map(b => b.browser)
        };
    }
};
