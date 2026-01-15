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
 * QuotaEnforcer
 *
 * Parent-side component that checks quotas and triggers blocking actions.
 * This runs in the Allow2Automate parent application, NOT on agents.
 *
 * IMPORTANT: Quotas are EXTERNALLY MANAGED on Allow2 platform.
 * This class ALWAYS checks with Allow2 API before making decisions.
 * It NEVER relies on cached quota information for enforcement.
 *
 * Responsibilities:
 * - Check quotas with Allow2 API
 * - Emit events when blocking or warnings are needed
 * - Track warning state to avoid duplicate warnings
 */
class QuotaEnforcer extends EventEmitter {
    /**
     * @param {Object} state - Plugin state reference
     * @param {Object} allow2Client - Allow2 API client
     * @param {Object} context - Plugin context for status updates
     */
    constructor(state, allow2Client, context) {
        super();
        this.state = state;
        this.allow2Client = allow2Client;
        this.context = context;

        // Track warning states: childId -> { warned15: bool, warned5: bool, warned1: bool }
        this.warningStates = new Map();

        // Short-lived cache for quota checks (max 5 seconds to avoid hammering API)
        this.quotaCache = new Map();
        this.cacheTTL = 5000;

        // Periodic quota check interval
        this.checkInterval = null;
        this.setupPeriodicCheck();
    }

    /**
     * Update state reference
     */
    updateState(newState) {
        this.state = newState;
    }

    /**
     * Check quota for a child from Allow2 API
     * ALWAYS fetches fresh data - never relies on stale cache for decisions
     *
     * @param {string} agentId - Agent where browser was detected
     * @param {string} childId - Child identifier
     * @param {string} activityType - Type of activity (default: 'internet')
     */
    async checkQuota(agentId, childId, activityType = 'internet') {
        if (!this.allow2Client) {
            console.warn('[QuotaEnforcer] No Allow2 client available');
            return;
        }

        // Get fresh allowance from Allow2 (never trust cached values for enforcement)
        const allowance = await this.fetchAllowance(childId, activityType);

        if (!allowance) {
            console.error('[QuotaEnforcer] Failed to get allowance from Allow2');
            return;
        }

        // Handle immediate blocking conditions
        if (allowance.is_banned || allowance.is_activity_blocked) {
            console.log(`[QuotaEnforcer] Child ${childId} is banned or activity blocked`);
            this.emit('block-browsers', {
                agentId,
                childId,
                reason: allowance.ban_reason || 'Activity is blocked'
            });
            return;
        }

        // Check if not allowed
        if (!allowance.allowed) {
            console.log(`[QuotaEnforcer] Child ${childId} internet time not allowed`);
            this.emit('block-browsers', {
                agentId,
                childId,
                reason: 'Internet time not allowed'
            });
            return;
        }

        // Check remaining time
        const remainingSeconds = allowance.remaining_seconds;

        // -1 means unlimited
        if (remainingSeconds === -1) {
            return; // Unlimited - no action needed
        }

        const remainingMinutes = remainingSeconds / 60;

        // Quota exhausted
        if (remainingSeconds <= 0) {
            console.log(`[QuotaEnforcer] Quota exhausted for child ${childId}`);
            this.emit('block-browsers', {
                agentId,
                childId,
                reason: 'Daily internet time exhausted'
            });
            return;
        }

        // Check for warnings (using configurable thresholds)
        const warningMinutes = this.state.settings?.warningMinutes || [15, 5, 1];
        const warningState = this.getWarningState(childId);

        for (const threshold of warningMinutes.sort((a, b) => b - a)) {
            const warningKey = `warned${threshold}`;

            if (remainingMinutes <= threshold && !warningState[warningKey]) {
                // Trigger warning
                const urgency = threshold <= 1 ? 'critical' :
                               threshold <= 5 ? 'high' : 'normal';

                console.log(`[QuotaEnforcer] Warning ${childId}: ${remainingMinutes} minutes remaining`);

                this.emit('show-warning', {
                    agentId,
                    childId,
                    remaining: remainingMinutes,
                    type: activityType,
                    urgency
                });

                // Mark warning as shown
                warningState[warningKey] = true;
                this.warningStates.set(childId, warningState);
                break; // Only show one warning at a time
            }
        }
    }

    /**
     * Fetch allowance from Allow2 API
     * Uses short-lived cache to avoid excessive API calls
     */
    async fetchAllowance(childId, activityType) {
        const cacheKey = `${childId}:${activityType}`;
        const cached = this.quotaCache.get(cacheKey);

        // Use cache if fresh (< 5 seconds old)
        if (cached && (Date.now() - cached.timestamp) < this.cacheTTL) {
            return cached.allowance;
        }

        try {
            const allowance = await this.allow2Client.checkActivity({
                child_id: childId,
                activity_type: activityType,
                log_usage: false,  // Don't consume quota for checks
                check_only: true
            });

            // Cache the result
            this.quotaCache.set(cacheKey, {
                allowance,
                timestamp: Date.now()
            });

            return allowance;
        } catch (error) {
            console.error('[QuotaEnforcer] Error fetching allowance:', error);
            return null;
        }
    }

    /**
     * Get warning state for a child
     */
    getWarningState(childId) {
        if (!this.warningStates.has(childId)) {
            this.warningStates.set(childId, {});
        }
        return this.warningStates.get(childId);
    }

    /**
     * Reset warning state for a child (e.g., on daily reset)
     */
    resetWarningState(childId) {
        this.warningStates.delete(childId);
    }

    /**
     * Clear quota cache (e.g., when external change is detected)
     */
    clearCache() {
        this.quotaCache.clear();
    }

    /**
     * Setup periodic quota checking for all active sessions
     */
    setupPeriodicCheck() {
        const checkIntervalMs = this.state.settings?.quotaCheckInterval || 30000;

        this.checkInterval = setInterval(async () => {
            await this.checkAllActiveChildren();
        }, checkIntervalMs);
    }

    /**
     * Check quotas for all children with active browser sessions
     */
    async checkAllActiveChildren() {
        const activeChildren = new Set();

        // Collect all children with active sessions from state
        for (const [agentId, agentData] of Object.entries(this.state.agents || {})) {
            if (agentData.childId && agentData.browsers?.length > 0) {
                activeChildren.add({
                    agentId,
                    childId: agentData.childId
                });
            }
        }

        // Check quota for each active child
        for (const { agentId, childId } of activeChildren) {
            await this.checkQuota(agentId, childId, 'internet');
        }
    }

    /**
     * Handle external Allow2 state change
     * Called when Allow2 notifies of quota/ban changes
     */
    async handleExternalChange(childId, newState) {
        // Clear cache for this child
        const cacheKey = `${childId}:internet`;
        this.quotaCache.delete(cacheKey);

        // Find all agents linked to this child
        for (const [agentId, agentData] of Object.entries(this.state.agents || {})) {
            if (agentData.childId === childId) {
                // Re-check quota with fresh data
                await this.checkQuota(agentId, childId, 'internet');
            }
        }
    }

    /**
     * Force block browsers for a child (manual override)
     */
    async forceBlock(childId, reason) {
        for (const [agentId, agentData] of Object.entries(this.state.agents || {})) {
            if (agentData.childId === childId) {
                this.emit('block-browsers', {
                    agentId,
                    childId,
                    reason: reason || 'Manual block'
                });
            }
        }
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }

        this.quotaCache.clear();
        this.warningStates.clear();
    }
}

module.exports = QuotaEnforcer;
