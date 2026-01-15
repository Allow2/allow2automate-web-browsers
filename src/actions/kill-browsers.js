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
 * Kill Browsers Action
 *
 * This action script is DEPLOYED TO THE AGENT via PLUGIN_EXTENSIONS.
 * It is triggered by the parent when browser quota is exhausted
 * and browsers need to be terminated.
 *
 * The script function is serialized and sent to the agent, where it runs
 * in a sandboxed environment when triggered with arguments from the parent.
 */
module.exports = {
    id: 'kill-browsers',
    platforms: ['win32', 'darwin', 'linux'],

    /**
     * Script that runs ON THE AGENT to kill browser processes
     * This function is serialized and executed in the agent's sandbox
     *
     * @param {Object} args - Arguments from parent
     * @param {string[]} args.browsers - List of browser names to kill (optional, kills all if not specified)
     * @param {string} args.reason - Reason for killing browsers
     * @param {number} args.gracePeriod - Grace period in seconds before force kill (optional)
     * @returns {Object} Result of the action
     */
    script: function(args) {
        const { execSync, exec } = require('child_process');
        const os = require('os');

        const { browsers, reason, gracePeriod = 0 } = args || {};

        // Browser process patterns by platform
        const browserProcesses = {
            win32: {
                chrome: ['chrome.exe'],
                firefox: ['firefox.exe'],
                edge: ['msedge.exe'],
                brave: ['brave.exe'],
                opera: ['opera.exe'],
                vivaldi: ['vivaldi.exe'],
                safari: []
            },
            darwin: {
                chrome: ['Google Chrome'],
                firefox: ['Firefox'],
                safari: ['Safari'],
                edge: ['Microsoft Edge'],
                brave: ['Brave Browser'],
                opera: ['Opera'],
                vivaldi: ['Vivaldi'],
                arc: ['Arc']
            },
            linux: {
                chrome: ['chrome', 'google-chrome', 'chromium'],
                firefox: ['firefox'],
                edge: ['microsoft-edge'],
                brave: ['brave'],
                opera: ['opera'],
                vivaldi: ['vivaldi'],
                safari: []
            }
        };

        /**
         * Show notification before killing (courtesy warning)
         */
        function showNotification(message) {
            const platform = process.platform;

            try {
                if (platform === 'win32') {
                    // Use PowerShell toast notification
                    const psScript = `
                        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
                        [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
                        $template = @"
                        <toast>
                            <visual>
                                <binding template="ToastText02">
                                    <text id="1">Allow2 Parental Control</text>
                                    <text id="2">${message}</text>
                                </binding>
                            </visual>
                        </toast>
"@
                        $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
                        $xml.LoadXml($template)
                        $toast = New-Object Windows.UI.Notifications.ToastNotification $xml
                        [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Allow2").Show($toast)
                    `;
                    exec(`powershell -Command "${psScript.replace(/"/g, '\\"')}"`, { windowsHide: true });
                } else if (platform === 'darwin') {
                    // macOS notification
                    exec(`osascript -e 'display notification "${message}" with title "Allow2 Parental Control"'`);
                } else {
                    // Linux notification
                    exec(`notify-send "Allow2 Parental Control" "${message}"`);
                }
            } catch (error) {
                console.error('[KillBrowsers] Notification failed:', error.message);
            }
        }

        /**
         * Kill a process by name on current platform
         */
        function killProcess(processName) {
            const platform = process.platform;
            let killed = false;

            try {
                if (platform === 'win32') {
                    execSync(`taskkill /IM "${processName}" /F`, {
                        encoding: 'utf8',
                        timeout: 10000,
                        windowsHide: true,
                        stdio: 'pipe'
                    });
                    killed = true;
                } else if (platform === 'darwin') {
                    // Try pkill first, then killall
                    try {
                        execSync(`pkill -9 "${processName}"`, {
                            encoding: 'utf8',
                            timeout: 5000,
                            stdio: 'pipe'
                        });
                        killed = true;
                    } catch (e) {
                        // pkill may fail if no matching process, try killall
                        try {
                            execSync(`killall -9 "${processName}"`, {
                                encoding: 'utf8',
                                timeout: 5000,
                                stdio: 'pipe'
                            });
                            killed = true;
                        } catch (e2) {
                            // Process may not exist
                        }
                    }
                } else {
                    // Linux
                    try {
                        execSync(`pkill -9 "${processName}"`, {
                            encoding: 'utf8',
                            timeout: 5000,
                            stdio: 'pipe'
                        });
                        killed = true;
                    } catch (e) {
                        // Process may not exist
                    }
                }
            } catch (error) {
                // Process may not be running or access denied
                console.error(`[KillBrowsers] Failed to kill ${processName}:`, error.message);
            }

            return killed;
        }

        /**
         * Kill all instances of a browser
         */
        function killBrowser(browserName) {
            const platform = process.platform;
            const processes = browserProcesses[platform]?.[browserName] || [];
            const killed = [];

            for (const proc of processes) {
                if (killProcess(proc)) {
                    killed.push(proc);
                }
            }

            return killed;
        }

        /**
         * Get list of browsers to kill
         */
        function getBrowsersToKill() {
            if (browsers && Array.isArray(browsers) && browsers.length > 0) {
                return browsers;
            }
            // Kill all browsers if none specified
            return Object.keys(browserProcesses[process.platform] || {});
        }

        // Show notification first
        const notificationMessage = reason || 'Internet time has been exhausted. Browsers are being closed.';
        showNotification(notificationMessage);

        // If grace period specified, wait before killing
        if (gracePeriod > 0) {
            // Note: In agent sandbox, setTimeout may not be available
            // The parent should handle grace period timing instead
            console.log(`[KillBrowsers] Grace period of ${gracePeriod}s would apply`);
        }

        // Kill browsers
        const browsersToKill = getBrowsersToKill();
        const results = {
            killed: [],
            failed: [],
            timestamp: Date.now(),
            hostname: os.hostname(),
            reason: reason
        };

        for (const browser of browsersToKill) {
            const killedProcesses = killBrowser(browser);
            if (killedProcesses.length > 0) {
                results.killed.push({
                    browser,
                    processes: killedProcesses
                });
            } else {
                results.failed.push(browser);
            }
        }

        return {
            success: true,
            ...results
        };
    }
};
