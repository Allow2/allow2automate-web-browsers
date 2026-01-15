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

/**
 * Browser detection patterns for cross-platform browser identification.
 * Used by ProcessLevelDetector for basic mode browser detection.
 */
class BrowserPatterns {
    /**
     * Get browser detection patterns organized by browser name.
     * Patterns include process names, app names, and executables.
     * @returns {Object} Map of browser name to array of detection patterns
     */
    static getPatterns() {
        return {
            chrome: [
                'chrome.exe',
                'chrome',
                'Google Chrome',
                'Google Chrome Helper',
                'Chromium',
                'chromium',
                'chromium-browser',
                'google-chrome',
                'google-chrome-stable'
            ],
            firefox: [
                'firefox.exe',
                'firefox',
                'Firefox',
                'Mozilla Firefox',
                'firefox-esr'
            ],
            safari: [
                'Safari',
                'safari',
                'Safari Web Content',
                'Safari Networking',
                'com.apple.Safari'
            ],
            edge: [
                'msedge.exe',
                'msedge',
                'Microsoft Edge',
                'microsoft-edge',
                'microsoft-edge-stable',
                'MicrosoftEdge'
            ],
            brave: [
                'brave.exe',
                'brave',
                'Brave Browser',
                'Brave-Browser',
                'brave-browser'
            ],
            opera: [
                'opera.exe',
                'opera',
                'Opera',
                'Opera Internet Browser',
                'opera-stable'
            ],
            vivaldi: [
                'vivaldi.exe',
                'vivaldi',
                'Vivaldi',
                'vivaldi-stable'
            ],
            arc: [
                'Arc',
                'arc',
                'Arc Helper'
            ]
        };
    }

    /**
     * Get flattened array of all browser detection patterns.
     * @returns {Array<string>} All detection patterns
     */
    static getAllPatterns() {
        const patterns = this.getPatterns();
        return Object.values(patterns).flat();
    }

    /**
     * Get display name for a browser identifier.
     * @param {string} browserId Browser identifier (e.g., 'chrome')
     * @returns {string} Display name (e.g., 'Google Chrome')
     */
    static getDisplayName(browserId) {
        const displayNames = {
            chrome: 'Google Chrome',
            firefox: 'Mozilla Firefox',
            safari: 'Safari',
            edge: 'Microsoft Edge',
            brave: 'Brave',
            opera: 'Opera',
            vivaldi: 'Vivaldi',
            arc: 'Arc'
        };
        return displayNames[browserId] || browserId;
    }

    /**
     * Identify browser from process name.
     * @param {string} processName Name of the process
     * @returns {string|null} Browser identifier or null if not a browser
     */
    static getBrowserName(processName) {
        if (!processName) return null;

        const patterns = this.getPatterns();
        const name = processName.toLowerCase();

        for (const [browser, browserPatterns] of Object.entries(patterns)) {
            const match = browserPatterns.some(p =>
                name === p.toLowerCase() ||
                name.includes(p.toLowerCase())
            );

            if (match) {
                return browser;
            }
        }

        return null;
    }

    /**
     * Check if a process name is a browser.
     * @param {string} processName Name of the process
     * @returns {boolean} True if process is a browser
     */
    static isBrowser(processName) {
        return this.getBrowserName(processName) !== null;
    }

    /**
     * Get browser icon identifier for UI.
     * @param {string} browserId Browser identifier
     * @returns {string} Icon identifier
     */
    static getBrowserIcon(browserId) {
        const icons = {
            chrome: 'chrome',
            firefox: 'firefox',
            safari: 'safari',
            edge: 'edge',
            brave: 'brave',
            opera: 'opera',
            vivaldi: 'vivaldi',
            arc: 'arc'
        };
        return icons[browserId] || 'web';
    }

    /**
     * Get list of all supported browser identifiers.
     * @returns {Array<string>} Browser identifiers
     */
    static getSupportedBrowsers() {
        return Object.keys(this.getPatterns());
    }

    /**
     * Check if browser supports enhanced mode (extension).
     * @param {string} browserId Browser identifier
     * @returns {boolean} True if browser supports extensions
     */
    static supportsEnhancedMode(browserId) {
        const supported = ['chrome', 'firefox', 'edge', 'brave', 'opera', 'vivaldi'];
        return supported.includes(browserId);
    }
}

export default BrowserPatterns;
