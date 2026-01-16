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
 * Show Warning Action
 *
 * This action script is DEPLOYED TO THE AGENT via PLUGIN_EXTENSIONS.
 * It is triggered by the parent when browser quota is running low
 * to warn the user before blocking.
 *
 * The script function is serialized and sent to the agent, where it runs
 * in a sandboxed environment when triggered with arguments from the parent.
 */
export default {
    id: 'show-warning',
    platforms: ['win32', 'darwin', 'linux'],

    /**
     * Script that runs ON THE AGENT to show quota warning
     * This function is serialized and executed in the agent's sandbox
     *
     * @param {Object} args - Arguments from parent
     * @param {string} args.message - Warning message to display
     * @param {number} args.remaining - Minutes remaining
     * @param {string} args.type - Type of quota (internet, category)
     * @param {string} args.urgency - Urgency level (normal, high, critical)
     * @returns {Object} Result of the action
     */
    script: function(args) {
        const { exec } = require('child_process');
        const os = require('os');

        const { message, remaining, type, urgency = 'normal' } = args || {};

        // Build warning message
        let displayMessage = message;
        if (!displayMessage) {
            if (type === 'internet') {
                displayMessage = `You have ${Math.round(remaining)} minutes of internet time remaining.`;
            } else if (type === 'category') {
                displayMessage = `You have ${Math.round(remaining)} minutes remaining for this type of browsing.`;
            } else {
                displayMessage = `${Math.round(remaining)} minutes remaining.`;
            }
        }

        // Add urgency-based prefix
        if (urgency === 'critical' && remaining <= 1) {
            displayMessage = 'FINAL WARNING: ' + displayMessage;
        } else if (urgency === 'high' && remaining <= 5) {
            displayMessage = 'WARNING: ' + displayMessage;
        }

        /**
         * Show notification on current platform
         */
        function showNotification(title, body, isUrgent) {
            const platform = process.platform;

            try {
                if (platform === 'win32') {
                    // Windows toast notification via PowerShell
                    const psScript = `
                        Add-Type -AssemblyName System.Windows.Forms
                        $balloon = New-Object System.Windows.Forms.NotifyIcon
                        $balloon.Icon = [System.Drawing.SystemIcons]::Warning
                        $balloon.BalloonTipIcon = 'Warning'
                        $balloon.BalloonTipTitle = '${title.replace(/'/g, "''")}'
                        $balloon.BalloonTipText = '${body.replace(/'/g, "''")}'
                        $balloon.Visible = $true
                        $balloon.ShowBalloonTip(10000)
                        Start-Sleep -Seconds 2
                        $balloon.Dispose()
                    `;

                    exec(`powershell -Command "${psScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, {
                        windowsHide: true
                    });
                } else if (platform === 'darwin') {
                    // macOS notification with sound if urgent
                    const soundOption = isUrgent ? ' sound name "Basso"' : '';
                    exec(`osascript -e 'display notification "${body.replace(/"/g, '\\"')}" with title "${title.replace(/"/g, '\\"')}"${soundOption}'`);
                } else {
                    // Linux notification using notify-send
                    const urgencyLevel = isUrgent ? '-u critical' : '-u normal';
                    exec(`notify-send ${urgencyLevel} -t 10000 "${title}" "${body}"`);
                }

                return true;
            } catch (error) {
                console.error('[ShowWarning] Notification failed:', error.message);
                return false;
            }
        }

        /**
         * Play warning sound (optional)
         */
        function playWarningSound() {
            const platform = process.platform;

            try {
                if (platform === 'win32') {
                    // Windows system sound
                    exec('powershell -Command "[System.Media.SystemSounds]::Exclamation.Play()"', {
                        windowsHide: true
                    });
                } else if (platform === 'darwin') {
                    // macOS system sound
                    exec('afplay /System/Library/Sounds/Basso.aiff &');
                } else {
                    // Linux beep (may not work on all systems)
                    exec('paplay /usr/share/sounds/freedesktop/stereo/message.oga &');
                }
            } catch (error) {
                // Sound is optional, don't fail
            }
        }

        // Determine urgency
        const isUrgent = urgency === 'critical' || urgency === 'high' || remaining <= 5;

        // Show notification
        const notificationShown = showNotification(
            'Allow2 - Internet Time',
            displayMessage,
            isUrgent
        );

        // Play sound for urgent warnings
        if (isUrgent) {
            playWarningSound();
        }

        return {
            success: notificationShown,
            timestamp: Date.now(),
            hostname: os.hostname(),
            message: displayMessage,
            remaining,
            urgency,
            type
        };
    }
};
