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
 * AgentBrowserManager
 *
 * Parent-side component that manages browser monitoring on agents.
 * This runs in the Allow2Automate parent application, NOT on agents.
 *
 * Responsibilities:
 * - Trigger actions on agents (kill browsers, show warnings)
 * - Manage scheduled shutdown times for offline resilience
 * - Track pending actions and their responses
 */
class AgentBrowserManager {
    /**
     * @param {Object} agentService - Agent service for communication
     * @param {Object} state - Plugin state reference
     * @param {Object} context - Plugin context
     */
    constructor(agentService, state, context) {
        this.agentService = agentService;
        this.state = state;
        this.context = context;

        // Pending shutdown schedules: agentId -> { shutdownTime, reason, timerId }
        this.pendingShutdowns = new Map();

        // Plugin ID for action triggers
        this.pluginId = 'allow2automate-web-browsers';
    }

    /**
     * Update state reference
     */
    updateState(newState) {
        this.state = newState;
    }

    /**
     * Trigger kill-browsers action on an agent
     *
     * @param {string} agentId - Agent identifier
     * @param {string} reason - Reason for killing browsers
     * @param {string[]} browsers - Optional specific browsers to kill
     */
    async triggerKillBrowsers(agentId, reason, browsers = null) {
        console.log(`[AgentBrowserManager] Triggering kill-browsers on ${agentId}: ${reason}`);

        // Cancel any pending scheduled shutdown
        this.cancelScheduledShutdown(agentId);

        try {
            await this.agentService.triggerAction(agentId, {
                pluginId: this.pluginId,
                actionId: 'kill-browsers',
                arguments: {
                    browsers,
                    reason,
                    gracePeriod: this.state.settings?.gracePeriod || 0
                }
            });

            // Log the action
            this.logAction(agentId, 'kill-browsers', { reason, browsers });

            return true;
        } catch (error) {
            console.error(`[AgentBrowserManager] Error triggering kill-browsers:`, error);
            return false;
        }
    }

    /**
     * Trigger show-warning action on an agent
     *
     * @param {string} agentId - Agent identifier
     * @param {Object} warningData - Warning data
     */
    async triggerWarning(agentId, warningData) {
        const { remaining, type, message, urgency } = warningData;

        console.log(`[AgentBrowserManager] Showing warning on ${agentId}: ${remaining} minutes remaining`);

        try {
            await this.agentService.triggerAction(agentId, {
                pluginId: this.pluginId,
                actionId: 'show-warning',
                arguments: {
                    message,
                    remaining,
                    type,
                    urgency: urgency || (remaining <= 5 ? 'high' : 'normal')
                }
            });

            return true;
        } catch (error) {
            console.error(`[AgentBrowserManager] Error triggering warning:`, error);
            return false;
        }
    }

    /**
     * Schedule a browser shutdown at a specific time
     * This supports offline resilience - agent will execute at scheduled time
     * even if network connection is lost.
     *
     * @param {string} agentId - Agent identifier
     * @param {number} shutdownTime - Unix timestamp for shutdown
     * @param {string} reason - Reason for shutdown
     * @param {number[]} warningIntervals - Minutes before shutdown to warn
     */
    async scheduleShutdown(agentId, shutdownTime, reason, warningIntervals = [10, 5, 2, 1]) {
        console.log(`[AgentBrowserManager] Scheduling shutdown for ${agentId} at ${new Date(shutdownTime).toISOString()}`);

        // Cancel any existing scheduled shutdown
        this.cancelScheduledShutdown(agentId);

        // Store shutdown info
        this.pendingShutdowns.set(agentId, {
            shutdownTime,
            reason,
            warningIntervals,
            scheduledAt: Date.now()
        });

        try {
            // Send schedule to agent for offline resilience
            await this.agentService.triggerAction(agentId, {
                pluginId: this.pluginId,
                actionId: 'schedule-shutdown',
                arguments: {
                    shutdownTime,
                    reason,
                    warningIntervals
                }
            });

            return true;
        } catch (error) {
            console.error(`[AgentBrowserManager] Error scheduling shutdown:`, error);
            // Even if agent communication fails, we'll track locally
            // and try to enforce on next heartbeat
            return false;
        }
    }

    /**
     * Update scheduled shutdown time
     * Called periodically to adjust shutdown time based on actual usage
     *
     * @param {string} agentId - Agent identifier
     * @param {number} newShutdownTime - New shutdown timestamp
     */
    async updateScheduledShutdown(agentId, newShutdownTime) {
        const pending = this.pendingShutdowns.get(agentId);
        if (!pending) {
            return;
        }

        pending.shutdownTime = newShutdownTime;

        try {
            await this.agentService.triggerAction(agentId, {
                pluginId: this.pluginId,
                actionId: 'update-shutdown',
                arguments: {
                    shutdownTime: newShutdownTime
                }
            });
        } catch (error) {
            console.error(`[AgentBrowserManager] Error updating shutdown:`, error);
        }
    }

    /**
     * Cancel a scheduled shutdown
     *
     * @param {string} agentId - Agent identifier
     */
    async cancelScheduledShutdown(agentId) {
        const pending = this.pendingShutdowns.get(agentId);
        if (!pending) {
            return;
        }

        console.log(`[AgentBrowserManager] Cancelling scheduled shutdown for ${agentId}`);

        this.pendingShutdowns.delete(agentId);

        try {
            await this.agentService.triggerAction(agentId, {
                pluginId: this.pluginId,
                actionId: 'cancel-shutdown',
                arguments: {}
            });
        } catch (error) {
            console.error(`[AgentBrowserManager] Error cancelling shutdown:`, error);
        }
    }

    /**
     * Get scheduled shutdown info for an agent
     */
    getScheduledShutdown(agentId) {
        return this.pendingShutdowns.get(agentId) || null;
    }

    /**
     * Get all pending shutdowns
     */
    getAllScheduledShutdowns() {
        const shutdowns = [];
        for (const [agentId, info] of this.pendingShutdowns.entries()) {
            shutdowns.push({
                agentId,
                ...info
            });
        }
        return shutdowns;
    }

    /**
     * Calculate shutdown time based on remaining quota
     *
     * @param {number} remainingSeconds - Remaining quota in seconds
     * @returns {number} Unix timestamp for shutdown
     */
    calculateShutdownTime(remainingSeconds) {
        return Date.now() + (remainingSeconds * 1000);
    }

    /**
     * Log action for audit trail
     */
    logAction(agentId, actionId, data) {
        const hostname = this.state.agents[agentId]?.hostname || agentId;

        if (this.context.logActivity) {
            this.context.logActivity({
                type: `browser_${actionId}`,
                message: `Browser action ${actionId} on ${hostname}`,
                timestamp: Date.now(),
                severity: actionId === 'kill-browsers' ? 'warning' : 'info',
                data
            });
        }
    }

    /**
     * Handle action response from agent
     */
    handleActionResponse(agentId, response) {
        console.log(`[AgentBrowserManager] Action response from ${agentId}:`, response);

        if (response.actionId === 'kill-browsers') {
            // Clear pending shutdown if browsers were killed
            this.pendingShutdowns.delete(agentId);
        }
    }

    /**
     * Get agent status summary
     */
    getAgentStatus(agentId) {
        const agentData = this.state.agents[agentId];
        const pendingShutdown = this.pendingShutdowns.get(agentId);

        return {
            id: agentId,
            hostname: agentData?.hostname,
            platform: agentData?.platform,
            enabled: agentData?.enabled,
            childId: agentData?.childId,
            browsers: agentData?.browsers || [],
            lastSeen: agentData?.lastSeen,
            pendingShutdown: pendingShutdown ? {
                shutdownTime: pendingShutdown.shutdownTime,
                reason: pendingShutdown.reason,
                timeRemaining: Math.max(0, pendingShutdown.shutdownTime - Date.now())
            } : null
        };
    }

    /**
     * Get all agent statuses
     */
    getAllAgentStatuses() {
        const statuses = [];
        for (const agentId of Object.keys(this.state.agents || {})) {
            statuses.push(this.getAgentStatus(agentId));
        }
        return statuses;
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        // Cancel all pending shutdowns locally
        this.pendingShutdowns.clear();
    }
}

module.exports = AgentBrowserManager;
