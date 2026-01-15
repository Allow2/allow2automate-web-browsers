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
import BrowserPatterns from '../utils/BrowserPatterns';

const log = Logger.createScoped('ActionExecutor');

/**
 * ActionExecutor - Executes enforcement actions for browser control.
 * Handles warnings, notifications, and browser blocking.
 */
class ActionExecutor {
    /**
     * Create an ActionExecutor.
     * @param {Object} detector Browser detector instance
     * @param {Object} config Plugin configuration
     * @param {Object} context Plugin context
     */
    constructor(detector, config, context) {
        this.detector = detector;
        this.config = config || {};
        this.context = context;
        this.blockedCategories = new Set();
        this.browsersBlocked = false;
    }

    /**
     * Update configuration.
     * @param {Object} newConfig New configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Show a quota warning notification.
     * @param {Object} data Warning data
     */
    async showWarning(data) {
        const { remaining, type, category, threshold } = data;

        let title = 'Time Warning';
        let message;
        let urgency = 'normal';

        if (type === 'internet') {
            message = `You have ${Math.round(remaining)} minute${remaining !== 1 ? 's' : ''} of internet time remaining.`;
            if (remaining <= 5) {
                urgency = 'critical';
            }
        } else if (type === 'category') {
            const categoryName = this.getCategoryDisplayName(category);
            message = `You have ${Math.round(remaining)} minute${remaining !== 1 ? 's' : ''} of ${categoryName} time remaining.`;
        }

        await this.showNotification({
            title,
            message,
            urgency,
            icon: 'warning'
        });

        log.info(`Warning shown: ${message}`);
    }

    /**
     * Block all browsers.
     */
    async blockBrowsers() {
        log.info('Blocking all browsers');
        this.browsersBlocked = true;

        // Send block command to extension (enhanced mode)
        if (this.detector.getMode() === 'enhanced') {
            try {
                await this.detector.blockAllSites();
            } catch (error) {
                log.error('Error sending block command to extension', error);
            }
        }

        // Kill running browser processes
        try {
            const browsers = this.detector.getActiveBrowsers();
            for (const browser of browsers) {
                if (browser.pid) {
                    await this.killBrowser(browser.pid);
                }
            }
        } catch (error) {
            log.error('Error killing browsers', error);
        }

        // Show notification
        await this.showNotification({
            title: 'Internet Time Exhausted',
            message: 'Your internet time quota has been reached. Browsers are now blocked.',
            urgency: 'critical',
            icon: 'block',
            persistent: true
        });
    }

    /**
     * Unblock browsers.
     */
    async unblockBrowsers() {
        log.info('Unblocking browsers');
        this.browsersBlocked = false;

        if (this.detector.getMode() === 'enhanced') {
            try {
                await this.detector.unblock();
            } catch (error) {
                log.error('Error unblocking via extension', error);
            }
        }

        await this.showNotification({
            title: 'Browsers Unblocked',
            message: 'Internet access has been restored.',
            urgency: 'normal',
            icon: 'check_circle'
        });
    }

    /**
     * Block a specific category (enhanced mode).
     * @param {string} category Category to block
     */
    async blockCategory(category) {
        log.info(`Blocking category: ${category}`);
        this.blockedCategories.add(category);

        if (this.detector.getMode() === 'enhanced') {
            try {
                await this.detector.blockCategory(category);
            } catch (error) {
                log.error('Error blocking category via extension', error);
            }
        }

        const categoryName = this.getCategoryDisplayName(category);
        await this.showNotification({
            title: `${categoryName} Time Exhausted`,
            message: `Your ${categoryName.toLowerCase()} time quota has been reached.`,
            urgency: 'critical',
            icon: 'block'
        });
    }

    /**
     * Unblock a specific category.
     * @param {string} category Category to unblock
     */
    async unblockCategory(category) {
        log.info(`Unblocking category: ${category}`);
        this.blockedCategories.delete(category);

        if (this.detector.getMode() === 'enhanced') {
            try {
                await this.detector.unblock({ category });
            } catch (error) {
                log.error('Error unblocking category via extension', error);
            }
        }
    }

    /**
     * Block a specific site (enhanced mode).
     * @param {string} url URL or domain to block
     * @param {string} reason Reason for blocking
     */
    async blockSite(url, reason = 'Site blocked') {
        log.info(`Blocking site: ${url}`);

        if (this.detector.getMode() === 'enhanced') {
            try {
                await this.detector.blockSite(url);
            } catch (error) {
                log.error('Error blocking site via extension', error);
            }
        }
    }

    /**
     * Kill a browser process.
     * @param {number} pid Process ID
     */
    async killBrowser(pid) {
        log.debug(`Killing browser process: ${pid}`);

        if (this.context?.services?.processMonitor?.killProcess) {
            try {
                await this.context.services.processMonitor.killProcess(pid, 'SIGTERM');
            } catch (error) {
                log.error(`Error killing process ${pid}`, error);
            }
        }
    }

    /**
     * Kill all running browsers.
     */
    async killAllBrowsers() {
        const browsers = this.detector.getActiveBrowsers();

        for (const browser of browsers) {
            if (browser.pid) {
                await this.killBrowser(browser.pid);
            }
        }

        log.info('All browsers killed');
    }

    /**
     * Prevent browser launch (OS-level blocking).
     * This requires elevated privileges and OS plugin integration.
     */
    async preventBrowserLaunch() {
        log.debug('Setting up browser launch prevention');

        if (this.context?.services?.applicationBlocker) {
            const patterns = BrowserPatterns.getAllPatterns();

            try {
                await this.context.services.applicationBlocker.blockApplications(patterns);
            } catch (error) {
                log.error('Error setting up launch prevention', error);
            }
        }
    }

    /**
     * Allow browser launch.
     */
    async allowBrowserLaunch() {
        log.debug('Removing browser launch prevention');

        if (this.context?.services?.applicationBlocker) {
            const patterns = BrowserPatterns.getAllPatterns();

            try {
                await this.context.services.applicationBlocker.unblockApplications(patterns);
            } catch (error) {
                log.error('Error removing launch prevention', error);
            }
        }
    }

    /**
     * Show a system notification.
     * @param {Object} options Notification options
     */
    async showNotification(options) {
        const { title, message, urgency, icon, persistent } = options;

        log.debug(`Notification: [${title}] ${message}`);

        // Try platform notification service
        if (this.context?.services?.notifications) {
            try {
                await this.context.services.notifications.show({
                    title,
                    body: message,
                    urgency: urgency || 'normal',
                    icon: icon || 'web',
                    silent: false,
                    requireInteraction: persistent || false
                });
                return;
            } catch (error) {
                log.warn('Notification service error', error);
            }
        }

        // Fallback: Use Electron notification if available
        if (this.context?.Notification) {
            const notification = new this.context.Notification({
                title,
                body: message,
                urgency: urgency || 'normal',
                timeoutType: persistent ? 'never' : 'default'
            });
            notification.show();
        }
    }

    /**
     * Get display name for a category.
     * @param {string} category Category identifier
     * @returns {string} Display name
     */
    getCategoryDisplayName(category) {
        const displayNames = {
            social: 'Social Media',
            video: 'Video Streaming',
            gaming: 'Gaming',
            education: 'Education',
            news: 'News',
            shopping: 'Shopping',
            productivity: 'Productivity',
            music: 'Music',
            sports: 'Sports',
            search: 'Search',
            adult: 'Adult Content',
            other: 'Other'
        };

        return displayNames[category] || category.charAt(0).toUpperCase() + category.slice(1);
    }

    /**
     * Check if browsers are currently blocked.
     * @returns {boolean} True if blocked
     */
    areBrowsersBlocked() {
        return this.browsersBlocked;
    }

    /**
     * Check if a category is blocked.
     * @param {string} category Category identifier
     * @returns {boolean} True if blocked
     */
    isCategoryBlocked(category) {
        return this.blockedCategories.has(category);
    }

    /**
     * Get list of blocked categories.
     * @returns {Array<string>} Blocked category identifiers
     */
    getBlockedCategories() {
        return Array.from(this.blockedCategories);
    }

    /**
     * Grant temporary access (parent override).
     * @param {Object} options Override options
     */
    async grantTemporaryAccess(options = {}) {
        const { duration = 15, category = null } = options;

        log.info(`Granting temporary access: ${duration} minutes`);

        if (category) {
            await this.unblockCategory(category);
        } else {
            await this.unblockBrowsers();
            await this.allowBrowserLaunch();
        }

        // Schedule re-blocking
        setTimeout(async () => {
            if (category) {
                await this.blockCategory(category);
            } else {
                await this.blockBrowsers();
            }
        }, duration * 60 * 1000);

        await this.showNotification({
            title: 'Temporary Access Granted',
            message: `Internet access granted for ${duration} minutes.`,
            urgency: 'normal',
            icon: 'access_time'
        });
    }
}

export default ActionExecutor;
