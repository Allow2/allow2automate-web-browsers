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

import ProcessLevelDetector from './ProcessLevelDetector';
import ExtensionDetector from './ExtensionDetector';
import Logger from '../utils/Logger';

const log = Logger.createScoped('DetectorFactory');

/**
 * DetectorFactory - Creates and manages browser detectors.
 * Automatically selects between basic (process-level) and enhanced (extension) modes.
 */
class DetectorFactory {
    /**
     * Create a DetectorFactory.
     * @param {Object} context Plugin context with services
     */
    constructor(context) {
        this.context = context;
        this.processDetector = null;
        this.extensionDetector = null;
        this.activeDetector = null;
        this.mode = 'auto'; // 'auto', 'basic', or 'enhanced'
    }

    /**
     * Set the preferred detection mode.
     * @param {string} mode Detection mode ('auto', 'basic', 'enhanced')
     */
    setMode(mode) {
        if (['auto', 'basic', 'enhanced'].includes(mode)) {
            this.mode = mode;
            log.info(`Detection mode set to: ${mode}`);
        } else {
            log.warn(`Invalid mode: ${mode}, using 'auto'`);
            this.mode = 'auto';
        }
    }

    /**
     * Create and return the appropriate detector.
     * @returns {Promise<Object>} The created detector
     */
    async createDetector() {
        // Always create process-level detector as fallback
        this.processDetector = new ProcessLevelDetector(this.context);

        // Create extension detector
        this.extensionDetector = new ExtensionDetector(this.context);

        if (this.mode === 'basic') {
            log.info('Using basic mode (forced)');
            this.activeDetector = this.processDetector;
            return this.processDetector;
        }

        if (this.mode === 'enhanced') {
            log.info('Using enhanced mode (forced)');
            this.activeDetector = this.extensionDetector;
            return this.extensionDetector;
        }

        // Auto mode: Try enhanced first, fallback to basic
        try {
            const hasExtension = await this.extensionDetector.checkAvailable();

            if (hasExtension) {
                log.info('Using enhanced mode (extension available)');
                this.activeDetector = this.extensionDetector;
                return this.extensionDetector;
            }
        } catch (error) {
            log.warn('Error checking extension availability', error);
        }

        // Fallback to basic mode
        log.info('Using basic mode (extension not available)');
        this.activeDetector = this.processDetector;
        return this.processDetector;
    }

    /**
     * Get the currently active detector.
     * @returns {Object|null} Active detector or null if not created
     */
    getActiveDetector() {
        return this.activeDetector;
    }

    /**
     * Get the process-level detector instance.
     * @returns {ProcessLevelDetector|null} Process detector or null
     */
    getProcessDetector() {
        return this.processDetector;
    }

    /**
     * Get the extension detector instance.
     * @returns {ExtensionDetector|null} Extension detector or null
     */
    getExtensionDetector() {
        return this.extensionDetector;
    }

    /**
     * Check if enhanced mode is available.
     * @returns {Promise<boolean>} True if enhanced mode can be used
     */
    async isEnhancedModeAvailable() {
        if (!this.extensionDetector) {
            return false;
        }
        return this.extensionDetector.checkAvailable();
    }

    /**
     * Switch to enhanced mode if available.
     * @returns {Promise<boolean>} True if switch was successful
     */
    async switchToEnhanced() {
        if (!this.extensionDetector) {
            this.extensionDetector = new ExtensionDetector(this.context);
        }

        const available = await this.extensionDetector.checkAvailable();

        if (available) {
            // Stop current detector if running
            if (this.activeDetector && this.activeDetector !== this.extensionDetector) {
                await this.activeDetector.stop();
            }

            this.activeDetector = this.extensionDetector;
            await this.activeDetector.start();

            log.info('Switched to enhanced mode');
            return true;
        }

        log.warn('Cannot switch to enhanced mode: extension not available');
        return false;
    }

    /**
     * Switch to basic mode.
     * @returns {Promise<boolean>} True if switch was successful
     */
    async switchToBasic() {
        if (!this.processDetector) {
            this.processDetector = new ProcessLevelDetector(this.context);
        }

        // Stop current detector if running
        if (this.activeDetector && this.activeDetector !== this.processDetector) {
            await this.activeDetector.stop();
        }

        this.activeDetector = this.processDetector;
        await this.activeDetector.start();

        log.info('Switched to basic mode');
        return true;
    }

    /**
     * Create a hybrid detector that uses both modes.
     * Process detection for all browsers, extension for detailed tracking.
     * @returns {Object} Hybrid detector wrapper
     */
    createHybridDetector() {
        const factory = this;

        return {
            mode: 'hybrid',

            async start() {
                // Start both detectors
                await factory.processDetector.start();

                if (factory.extensionDetector) {
                    await factory.extensionDetector.start();
                }
            },

            async stop() {
                await factory.processDetector.stop();

                if (factory.extensionDetector) {
                    await factory.extensionDetector.stop();
                }
            },

            getMode() {
                return 'hybrid';
            },

            getCapabilities() {
                // Merge capabilities
                const basicCaps = factory.processDetector.getCapabilities();
                const enhancedCaps = factory.extensionDetector?.getCapabilities() || {};

                return {
                    ...basicCaps,
                    ...enhancedCaps,
                    hybridMode: true
                };
            },

            isBrowserActive() {
                return factory.processDetector.isBrowserActive();
            },

            getActiveBrowsers() {
                // Merge browser info from both sources
                const processBrowsers = factory.processDetector.getActiveBrowsers();
                const extensionBrowsers = factory.extensionDetector?.getActiveBrowsers() || [];

                // Add extension info to process browsers
                return processBrowsers.map(browser => {
                    const extInfo = extensionBrowsers.find(e => e.name === browser.name);
                    return {
                        ...browser,
                        extensionAvailable: !!extInfo,
                        extensionInfo: extInfo || null
                    };
                });
            },

            getUsageData(childId) {
                const basicData = factory.processDetector.getUsageData(childId);
                const enhancedData = factory.extensionDetector?.getUsageData(childId);

                if (enhancedData?.detailAvailable) {
                    return {
                        ...basicData,
                        ...enhancedData,
                        mode: 'hybrid'
                    };
                }

                return basicData;
            },

            on(event, callback) {
                factory.processDetector.on(event, callback);
                if (factory.extensionDetector) {
                    factory.extensionDetector.on(event, callback);
                }
            },

            off(event, callback) {
                factory.processDetector.off(event, callback);
                if (factory.extensionDetector) {
                    factory.extensionDetector.off(event, callback);
                }
            }
        };
    }
}

export default DetectorFactory;
