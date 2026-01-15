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
 * Logger utility for the Web Browsers plugin.
 * Provides consistent logging format with log levels.
 */
class Logger {
    static LOG_LEVELS = {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3
    };

    static currentLevel = Logger.LOG_LEVELS.INFO;
    static prefix = '[WebBrowsers]';

    /**
     * Set the current log level.
     * @param {string} level Log level name (DEBUG, INFO, WARN, ERROR)
     */
    static setLevel(level) {
        const upperLevel = level.toUpperCase();
        if (Logger.LOG_LEVELS[upperLevel] !== undefined) {
            Logger.currentLevel = Logger.LOG_LEVELS[upperLevel];
        }
    }

    /**
     * Set the log prefix.
     * @param {string} prefix Prefix to use in log messages
     */
    static setPrefix(prefix) {
        Logger.prefix = prefix;
    }

    /**
     * Log a debug message.
     * @param {string} component Component name
     * @param {string} message Log message
     * @param {Object} data Optional data to log
     */
    static debug(component, message, data = null) {
        if (Logger.currentLevel <= Logger.LOG_LEVELS.DEBUG) {
            const formattedMessage = `${Logger.prefix}[${component}] ${message}`;
            if (data) {
                console.debug(formattedMessage, data);
            } else {
                console.debug(formattedMessage);
            }
        }
    }

    /**
     * Log an info message.
     * @param {string} component Component name
     * @param {string} message Log message
     * @param {Object} data Optional data to log
     */
    static info(component, message, data = null) {
        if (Logger.currentLevel <= Logger.LOG_LEVELS.INFO) {
            const formattedMessage = `${Logger.prefix}[${component}] ${message}`;
            if (data) {
                console.log(formattedMessage, data);
            } else {
                console.log(formattedMessage);
            }
        }
    }

    /**
     * Log a warning message.
     * @param {string} component Component name
     * @param {string} message Log message
     * @param {Object} data Optional data to log
     */
    static warn(component, message, data = null) {
        if (Logger.currentLevel <= Logger.LOG_LEVELS.WARN) {
            const formattedMessage = `${Logger.prefix}[${component}] ${message}`;
            if (data) {
                console.warn(formattedMessage, data);
            } else {
                console.warn(formattedMessage);
            }
        }
    }

    /**
     * Log an error message.
     * @param {string} component Component name
     * @param {string} message Log message
     * @param {Error|Object} error Optional error object
     */
    static error(component, message, error = null) {
        if (Logger.currentLevel <= Logger.LOG_LEVELS.ERROR) {
            const formattedMessage = `${Logger.prefix}[${component}] ${message}`;
            if (error) {
                console.error(formattedMessage, error);
            } else {
                console.error(formattedMessage);
            }
        }
    }

    /**
     * Create a scoped logger for a specific component.
     * @param {string} component Component name
     * @returns {Object} Scoped logger object
     */
    static createScoped(component) {
        return {
            debug: (message, data) => Logger.debug(component, message, data),
            info: (message, data) => Logger.info(component, message, data),
            warn: (message, data) => Logger.warn(component, message, data),
            error: (message, error) => Logger.error(component, message, error)
        };
    }
}

export default Logger;
