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

const EventEmitter = require('events');

/**
 * BrowserTimeTracker
 *
 * Parent-side component that tracks browser usage time for each child.
 * This runs in the Allow2Automate parent application, NOT on agents.
 *
 * Responsibilities:
 * - Track browser session start/end times
 * - Calculate total usage per child
 * - Report usage to Allow2 API
 * - Emit events for quota checking
 */
class BrowserTimeTracker extends EventEmitter {
    /**
     * @param {Object} state - Plugin state reference
     * @param {Object} allow2Client - Allow2 API client
     */
    constructor(state, allow2Client) {
        super();
        this.state = state;
        this.allow2Client = allow2Client;

        // Active sessions: agentId -> { childId, startTime, browsers, lastUpdate }
        this.activeSessions = new Map();

        // Usage logging interval (log to Allow2 every 5 minutes)
        this.logIntervalMs = 5 * 60 * 1000;
        this.logIntervals = new Map();

        // Daily reset check
        this.resetCheckInterval = null;
        this.setupDailyReset();
    }

    /**
     * Update state reference (called when state changes externally)
     */
    updateState(newState) {
        this.state = newState;
    }

    /**
     * Record browser activity from agent
     * Called when browser detection data arrives from an agent
     *
     * @param {string} agentId - Agent identifier
     * @param {string} childId - Child identifier
     * @param {Array} browsers - Array of detected browsers
     */
    async recordActivity(agentId, childId, browsers) {
        const now = Date.now();

        // Check if session already exists
        const existingSession = this.activeSessions.get(agentId);

        if (existingSession) {
            // Update existing session
            const elapsed = now - existingSession.lastUpdate;
            existingSession.lastUpdate = now;
            existingSession.browsers = browsers;

            // Accumulate local usage
            existingSession.accumulatedSeconds += Math.floor(elapsed / 1000);

            // Update child usage in state
            this.updateChildUsage(childId, Math.floor(elapsed / 1000));
        } else {
            // Start new session
            const session = {
                childId,
                startTime: now,
                lastUpdate: now,
                browsers,
                accumulatedSeconds: 0,
                logged: false
            };
            this.activeSessions.set(agentId, session);

            // Start periodic logging for this session
            this.startLoggingInterval(agentId, childId);

            this.emit('session-started', {
                agentId,
                childId,
                browsers,
                timestamp: now
            });
        }
    }

    /**
     * End a browser session for an agent
     *
     * @param {string} agentId - Agent identifier
     * @param {string} childId - Child identifier (for verification)
     */
    async endSession(agentId, childId) {
        const session = this.activeSessions.get(agentId);

        if (!session) {
            return; // No active session
        }

        // Calculate final duration
        const now = Date.now();
        const elapsed = now - session.lastUpdate;
        const totalSeconds = session.accumulatedSeconds + Math.floor(elapsed / 1000);
        const sessionDuration = Math.floor((now - session.startTime) / 1000);

        // Log final usage to Allow2
        if (totalSeconds > 0 && this.allow2Client) {
            await this.logUsageToAllow2(childId, totalSeconds);
        }

        // Update child usage in state
        this.updateChildUsage(childId, Math.floor(elapsed / 1000));

        // Stop logging interval
        this.stopLoggingInterval(agentId);

        // Remove session
        this.activeSessions.delete(agentId);

        this.emit('session-ended', {
            agentId,
            childId,
            duration: sessionDuration,
            timestamp: now
        });
    }

    /**
     * End all sessions for an agent (e.g., when agent is unlinked)
     */
    async endAllSessions(agentId) {
        const session = this.activeSessions.get(agentId);
        if (session) {
            await this.endSession(agentId, session.childId);
        }
    }

    /**
     * Update child's usage in state
     */
    updateChildUsage(childId, seconds) {
        if (!this.state.children[childId]) {
            this.state.children[childId] = {
                usageToday: 0,
                lastReset: Date.now()
            };
        }

        this.state.children[childId].usageToday += seconds;

        this.emit('usage-recorded', {
            childId,
            duration: seconds,
            totalToday: this.state.children[childId].usageToday
        });
    }

    /**
     * Log usage to Allow2 API
     * This consumes quota on the Allow2 platform
     */
    async logUsageToAllow2(childId, durationSeconds) {
        if (!this.allow2Client) {
            console.warn('[BrowserTimeTracker] No Allow2 client available');
            return null;
        }

        try {
            const result = await this.allow2Client.checkActivity({
                child_id: childId,
                activity_type: 'internet',
                duration_seconds: durationSeconds,
                log_usage: true,  // This consumes quota
                metadata: {
                    source: 'allow2automate-web-browsers',
                    category: 'browser'
                }
            });

            console.log(`[BrowserTimeTracker] Logged ${durationSeconds}s for child ${childId}`);

            this.emit('usage-logged', {
                childId,
                duration: durationSeconds,
                remaining: result?.remaining_seconds,
                allowed: result?.allowed
            });

            return result;
        } catch (error) {
            console.error('[BrowserTimeTracker] Error logging usage to Allow2:', error);
            return null;
        }
    }

    /**
     * Start periodic usage logging interval for a session
     */
    startLoggingInterval(agentId, childId) {
        // Clear any existing interval
        this.stopLoggingInterval(agentId);

        // Log usage every 5 minutes
        const interval = setInterval(async () => {
            const session = this.activeSessions.get(agentId);
            if (!session || session.accumulatedSeconds === 0) {
                return;
            }

            // Log accumulated usage
            const secondsToLog = session.accumulatedSeconds;
            session.accumulatedSeconds = 0;
            session.logged = true;

            await this.logUsageToAllow2(childId, secondsToLog);
        }, this.logIntervalMs);

        this.logIntervals.set(agentId, interval);
    }

    /**
     * Stop logging interval for an agent
     */
    stopLoggingInterval(agentId) {
        const interval = this.logIntervals.get(agentId);
        if (interval) {
            clearInterval(interval);
            this.logIntervals.delete(agentId);
        }
    }

    /**
     * Get all sessions for a child
     */
    getChildSessions(childId) {
        const sessions = [];
        for (const [agentId, session] of this.activeSessions.entries()) {
            if (session.childId === childId) {
                sessions.push({
                    agentId,
                    startTime: session.startTime,
                    duration: Math.floor((Date.now() - session.startTime) / 1000),
                    browsers: session.browsers
                });
            }
        }
        return sessions;
    }

    /**
     * Get usage summary for a child
     */
    getUsageSummary(childId) {
        const childData = this.state.children[childId];
        if (!childData) {
            return {
                usageToday: 0,
                activeSessions: 0,
                lastReset: null
            };
        }

        const activeSessions = this.getChildSessions(childId);

        return {
            usageToday: childData.usageToday,
            usageTodayMinutes: Math.floor(childData.usageToday / 60),
            activeSessions: activeSessions.length,
            sessions: activeSessions,
            lastReset: childData.lastReset
        };
    }

    /**
     * Setup daily usage reset check
     */
    setupDailyReset() {
        // Check for daily reset every minute
        this.resetCheckInterval = setInterval(() => {
            this.checkDailyReset();
        }, 60 * 1000);

        // Initial check
        this.checkDailyReset();
    }

    /**
     * Check if daily usage should be reset
     */
    checkDailyReset() {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

        for (const [childId, childData] of Object.entries(this.state.children)) {
            if (childData.lastReset < todayStart) {
                // Reset usage for new day
                console.log(`[BrowserTimeTracker] Resetting daily usage for child ${childId}`);
                childData.usageToday = 0;
                childData.lastReset = Date.now();

                this.emit('daily-reset', { childId });
            }
        }
    }

    /**
     * Check current allowance without logging usage
     * Use this for quota checks and warnings
     */
    async checkAllowance(childId) {
        if (!this.allow2Client) {
            return null;
        }

        try {
            const result = await this.allow2Client.checkActivity({
                child_id: childId,
                activity_type: 'internet',
                log_usage: false,  // Don't consume quota
                check_only: true
            });

            return result;
        } catch (error) {
            console.error('[BrowserTimeTracker] Error checking allowance:', error);
            return null;
        }
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        // Stop all logging intervals
        for (const agentId of this.logIntervals.keys()) {
            this.stopLoggingInterval(agentId);
        }

        // Stop daily reset check
        if (this.resetCheckInterval) {
            clearInterval(this.resetCheckInterval);
            this.resetCheckInterval = null;
        }

        // Clear active sessions
        this.activeSessions.clear();
    }
}

module.exports = BrowserTimeTracker;
