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

// Import UI components
import TabContent from './components/TabContent';

// Import parent-side controllers
import BrowserTimeTracker from './parent/BrowserTimeTracker';
import QuotaEnforcer from './parent/QuotaEnforcer';
import AgentBrowserManager from './parent/AgentBrowserManager';

// Import monitor and action definitions for agent deployment
import browserDetectorMonitor from './monitors/browser-detector';
import killBrowsersAction from './actions/kill-browsers';
import showWarningAction from './actions/show-warning';

/**
 * Web Browsers Plugin Factory
 * Monitors browser usage on agent devices and enforces internet time quotas
 * via the Allow2 Agent System using PLUGIN_EXTENSIONS deployment.
 *
 * Architecture:
 * - Parent-side: Decision logic, time tracking, quota checking
 * - Agent-side: Browser detection monitors, blocking actions (deployed via PLUGIN_EXTENSIONS)
 *
 * @param {Object} context - Allow2Automate plugin context
 */
function plugin(context) {
    let state = null;
    let agentService = null;
    let allow2Client = null;

    // Parent-side controllers
    let timeTracker = null;
    let quotaEnforcer = null;
    let agentManager = null;

    const webBrowsers = {};

    /**
     * onLoad - Initialize plugin when Allow2Automate starts
     * @param {Object} loadState - Persisted state from previous session
     */
    webBrowsers.onLoad = async function(loadState) {
        console.log('[WebBrowsers Plugin] Loading...', loadState);

        // Restore persisted state
        state = loadState || {
            agents: {},           // agentId -> { childId, enabled, lastSeen, browsers }
            children: {},         // childId -> { usageToday, lastReset }
            violations: [],       // Recent violations
            browserSessions: {},  // agentId -> { startTime, browsers, childId }
            settings: {
                checkInterval: 10000,    // 10 seconds for browser detection
                quotaCheckInterval: 30000, // 30 seconds for quota checks
                killOnViolation: true,
                warningMinutes: [15, 5, 1],
                gracePeriod: 60,        // 60 seconds grace period
                notifyParent: true
            },
            lastSync: null
        };

        // Get services from context
        agentService = context.services?.agent;
        allow2Client = context.services?.allow2Client || context.allow2;

        if (!agentService) {
            console.error('[WebBrowsers Plugin] Agent service not available - plugin will not function');
            context.statusUpdate({
                status: 'error',
                message: 'Agent service not available',
                timestamp: Date.now()
            });
            return;
        }

        // Initialize parent-side controllers
        timeTracker = new BrowserTimeTracker(state, allow2Client);
        quotaEnforcer = new QuotaEnforcer(state, allow2Client, context);
        agentManager = new AgentBrowserManager(agentService, state, context);

        // Wire up event handlers between controllers
        setupControllerEvents();

        // Get all registered agents and deploy monitors/actions
        try {
            const agents = await agentService.listAgents();
            console.log(`[WebBrowsers Plugin] Found ${agents.length} agents`);

            // Deploy browser monitoring to each agent
            for (const agent of agents) {
                await deployToAgent(agent);
            }
        } catch (error) {
            console.error('[WebBrowsers Plugin] Error listing agents:', error);
        }

        // Setup event listeners for agent events
        setupEventListeners();

        // Setup IPC handlers for renderer communication
        setupIPCHandlers(context);

        console.log('[WebBrowsers Plugin] Loaded successfully');
        context.statusUpdate({
            status: 'ready',
            message: 'Browser monitoring active',
            timestamp: Date.now()
        });
    };

    /**
     * Deploy browser monitoring to an agent
     * This uses PLUGIN_EXTENSIONS to deploy monitor and action scripts
     */
    async function deployToAgent(agent) {
        const pluginId = 'allow2automate-web-browsers';

        try {
            // Deploy browser detector monitor
            await agentService.deployMonitor(agent.id, {
                pluginId,
                monitorId: browserDetectorMonitor.id,
                script: browserDetectorMonitor.script.toString(),
                interval: state.settings.checkInterval,
                platforms: browserDetectorMonitor.platforms
            });

            // Deploy kill-browsers action
            await agentService.deployAction(agent.id, {
                pluginId,
                actionId: killBrowsersAction.id,
                script: killBrowsersAction.script.toString(),
                platforms: killBrowsersAction.platforms
            });

            // Deploy show-warning action
            await agentService.deployAction(agent.id, {
                pluginId,
                actionId: showWarningAction.id,
                script: showWarningAction.script.toString(),
                platforms: showWarningAction.platforms
            });

            // Initialize agent in state
            if (!state.agents[agent.id]) {
                state.agents[agent.id] = {
                    id: agent.id,
                    hostname: agent.hostname,
                    platform: agent.platform,
                    enabled: true,
                    childId: null,
                    lastSeen: Date.now(),
                    browsers: []
                };
            }

            console.log(`[WebBrowsers Plugin] Deployed to agent ${agent.hostname}`);
            context.configurationUpdate(state);

        } catch (error) {
            console.error(`[WebBrowsers Plugin] Error deploying to ${agent.hostname}:`, error);
        }
    }

    /**
     * Setup event handlers between controllers
     */
    function setupControllerEvents() {
        // When quota enforcer determines blocking is needed
        quotaEnforcer.on('block-browsers', async (data) => {
            const { agentId, childId, reason } = data;
            await agentManager.triggerKillBrowsers(agentId, reason);
        });

        // When quota enforcer determines warning is needed
        quotaEnforcer.on('show-warning', async (data) => {
            const { agentId, childId, remaining, type } = data;
            await agentManager.triggerWarning(agentId, {
                remaining,
                type,
                message: `${Math.round(remaining)} minutes of internet time remaining`
            });
        });

        // When time tracker records usage
        timeTracker.on('usage-recorded', (data) => {
            console.log(`[WebBrowsers Plugin] Usage recorded for child ${data.childId}: ${data.duration}s`);
        });
    }

    /**
     * Setup event listeners for agent events
     */
    function setupEventListeners() {
        // Listen for Allow2 state changes
        if (allow2Client && allow2Client.on) {
            allow2Client.on('stateChange', async (childId, newState) => {
                console.log(`[WebBrowsers Plugin] Allow2 state change for child ${childId}`, newState);

                // Check all agents linked to this child
                const childAgents = Object.entries(state.agents)
                    .filter(([_, a]) => a.childId === childId)
                    .map(([id, _]) => id);

                for (const agentId of childAgents) {
                    await quotaEnforcer.checkQuota(agentId, childId, 'internet');
                }
            });
        }

        // Listen for new agents
        if (agentService) {
            agentService.on('agentDiscovered', async (agent) => {
                console.log(`[WebBrowsers Plugin] New agent discovered: ${agent.hostname}`);
                await deployToAgent(agent);
            });

            // Listen for agent data (browser detection results)
            agentService.on('pluginData', async (data) => {
                if (data.pluginId === 'allow2automate-web-browsers') {
                    await handleBrowserData(data.agentId, data.data);
                }
            });

            // Listen for action responses
            agentService.on('actionResponse', (data) => {
                if (data.pluginId === 'allow2automate-web-browsers') {
                    handleActionResponse(data);
                }
            });
        }
    }

    /**
     * Handle browser detection data from agent
     */
    async function handleBrowserData(agentId, data) {
        const agentState = state.agents[agentId];
        if (!agentState) return;

        const { browsersActive, browsers, timestamp, hostname, username } = data;

        // Update agent state
        agentState.lastSeen = timestamp || Date.now();
        agentState.browsers = browsers || [];

        const childId = agentState.childId;
        if (!childId) {
            // Agent not linked to a child, just track data
            context.configurationUpdate(state);
            return;
        }

        if (browsersActive) {
            // Browser activity detected - track time
            await timeTracker.recordActivity(agentId, childId, browsers);

            // Check quota
            await quotaEnforcer.checkQuota(agentId, childId, 'internet');

            // Notify renderer of activity
            if (context.sendToRenderer) {
                context.sendToRenderer('browserActivity', {
                    agentId,
                    hostname,
                    browsers,
                    childId,
                    timestamp: Date.now()
                });
            }
        } else {
            // No browsers active - end session if there was one
            await timeTracker.endSession(agentId, childId);
        }

        context.configurationUpdate(state);
    }

    /**
     * Handle action response from agent
     */
    function handleActionResponse(data) {
        console.log(`[WebBrowsers Plugin] Action response:`, data);

        if (data.actionId === 'kill-browsers' && data.status === 'success') {
            // Record violation
            const violation = {
                agentId: data.agentId,
                timestamp: data.executedAt || Date.now(),
                hostname: state.agents[data.agentId]?.hostname,
                reason: data.arguments?.reason || 'Quota exceeded',
                browsersKilled: data.output?.killed || []
            };

            state.violations.unshift(violation);
            if (state.violations.length > 100) {
                state.violations = state.violations.slice(0, 100);
            }

            // Notify parent
            if (state.settings.notifyParent && context.sendToRenderer) {
                context.sendToRenderer('browserViolation', violation);
            }

            // Log activity
            if (context.logActivity) {
                context.logActivity({
                    type: 'browser_blocked',
                    message: `Browsers were blocked on ${violation.hostname}`,
                    timestamp: violation.timestamp,
                    severity: 'warning'
                });
            }

            context.configurationUpdate(state);
        }
    }

    /**
     * Setup IPC handlers for renderer communication
     */
    function setupIPCHandlers(context) {
        // Get agents
        context.ipcMain.handle('webBrowsers:getAgents', async (event) => {
            try {
                const agents = await agentService.listAgents();
                return [null, {
                    agents: agents.map(a => ({
                        id: a.id,
                        hostname: a.hostname,
                        platform: a.platform,
                        online: a.online,
                        childId: state.agents[a.id]?.childId,
                        enabled: state.agents[a.id]?.enabled,
                        browsers: state.agents[a.id]?.browsers || [],
                        lastSeen: state.agents[a.id]?.lastSeen
                    }))
                }];
            } catch (error) {
                return [error];
            }
        });

        // Link agent to child
        context.ipcMain.handle('webBrowsers:linkAgent', async (event, { agentId, childId }) => {
            try {
                if (!state.agents[agentId]) {
                    state.agents[agentId] = { id: agentId };
                }

                state.agents[agentId].childId = childId;
                state.agents[agentId].enabled = true;

                // Initialize child tracking if needed
                if (!state.children[childId]) {
                    state.children[childId] = {
                        usageToday: 0,
                        lastReset: Date.now()
                    };
                }

                context.configurationUpdate(state);
                return [null, { success: true }];
            } catch (error) {
                return [error];
            }
        });

        // Unlink agent
        context.ipcMain.handle('webBrowsers:unlinkAgent', async (event, { agentId }) => {
            try {
                if (state.agents[agentId]) {
                    state.agents[agentId].childId = null;
                    state.agents[agentId].enabled = false;
                }

                // End any active session
                await timeTracker.endAllSessions(agentId);

                context.configurationUpdate(state);
                return [null, { success: true }];
            } catch (error) {
                return [error];
            }
        });

        // Get usage report
        context.ipcMain.handle('webBrowsers:getUsage', async (event, { childId }) => {
            try {
                const childData = state.children[childId];
                if (!childData) {
                    return [null, { usage: null }];
                }

                return [null, {
                    usage: {
                        usageToday: childData.usageToday,
                        lastReset: childData.lastReset,
                        sessions: timeTracker.getChildSessions(childId)
                    }
                }];
            } catch (error) {
                return [error];
            }
        });

        // Get violations
        context.ipcMain.handle('webBrowsers:getViolations', async (event, { limit = 50 }) => {
            try {
                return [null, { violations: state.violations.slice(0, limit) }];
            } catch (error) {
                return [error];
            }
        });

        // Clear violations
        context.ipcMain.handle('webBrowsers:clearViolations', async (event) => {
            try {
                state.violations = [];
                context.configurationUpdate(state);
                return [null, { success: true }];
            } catch (error) {
                return [error];
            }
        });

        // Get settings
        context.ipcMain.handle('webBrowsers:getSettings', async (event) => {
            try {
                return [null, { settings: state.settings }];
            } catch (error) {
                return [error];
            }
        });

        // Update settings
        context.ipcMain.handle('webBrowsers:updateSettings', async (event, { settings }) => {
            try {
                state.settings = { ...state.settings, ...settings };
                context.configurationUpdate(state);

                // Re-deploy monitors if interval changed
                if (settings.checkInterval) {
                    const agents = await agentService.listAgents();
                    for (const agent of agents) {
                        await agentService.updateMonitor(agent.id, {
                            pluginId: 'allow2automate-web-browsers',
                            monitorId: 'browser-detector',
                            interval: settings.checkInterval
                        });
                    }
                }

                return [null, { success: true }];
            } catch (error) {
                return [error];
            }
        });

        // Get status
        context.ipcMain.handle('webBrowsers:getStatus', async (event) => {
            try {
                const agents = await agentService.listAgents();
                const linkedAgents = Object.values(state.agents).filter(a => a.childId);
                const activeSessionCount = Object.keys(state.browserSessions).length;

                return [null, {
                    agentCount: agents.length,
                    activeAgents: agents.filter(a => a.online).length,
                    linkedAgents: linkedAgents.length,
                    activeSessions: activeSessionCount,
                    recentViolations: state.violations.slice(0, 10),
                    settings: state.settings,
                    lastSync: state.lastSync
                }];
            } catch (error) {
                return [error];
            }
        });

        // Manually trigger browser block (for testing/override)
        context.ipcMain.handle('webBrowsers:blockBrowsers', async (event, { agentId, reason }) => {
            try {
                await agentManager.triggerKillBrowsers(agentId, reason || 'Manual block');
                return [null, { success: true }];
            } catch (error) {
                return [error];
            }
        });
    }

    /**
     * newState - Handle configuration updates
     * @param {Object} newState - Updated state from UI
     */
    webBrowsers.newState = function(newState) {
        console.log('[WebBrowsers Plugin] State updated:', newState);
        state = newState;

        // Update controllers with new state
        if (timeTracker) timeTracker.updateState(state);
        if (quotaEnforcer) quotaEnforcer.updateState(state);
        if (agentManager) agentManager.updateState(state);
    };

    /**
     * onSetEnabled - Start/stop monitoring when plugin enabled/disabled
     * @param {boolean} enabled - Plugin enabled state
     */
    webBrowsers.onSetEnabled = async function(enabled) {
        console.log(`[WebBrowsers Plugin] ${enabled ? 'enabled' : 'disabled'}`);

        if (enabled) {
            context.statusUpdate({
                status: 'active',
                message: 'Browser monitoring active',
                timestamp: Date.now()
            });
        } else {
            // Disable monitoring on all agents
            try {
                const agents = await agentService.listAgents();
                for (const agent of agents) {
                    await agentService.updateMonitor(agent.id, {
                        pluginId: 'allow2automate-web-browsers',
                        monitorId: 'browser-detector',
                        enabled: false
                    });
                }
            } catch (error) {
                console.error('[WebBrowsers Plugin] Error disabling monitors:', error);
            }

            context.statusUpdate({
                status: 'inactive',
                message: 'Browser monitoring paused',
                timestamp: Date.now()
            });
        }

        context.configurationUpdate(state);
    };

    /**
     * onUnload - Cleanup when plugin is removed
     * @param {Function} callback - Completion callback
     */
    webBrowsers.onUnload = function(callback) {
        console.log('[WebBrowsers Plugin] Unloading...');

        // Cleanup controllers
        if (timeTracker) timeTracker.cleanup();
        if (quotaEnforcer) quotaEnforcer.cleanup();
        if (agentManager) agentManager.cleanup();

        // Remove all monitors and actions from agents
        if (agentService) {
            agentService.listAgents()
                .then(agents => {
                    const promises = agents.map(agent => {
                        return Promise.all([
                            agentService.removeMonitor(agent.id, {
                                pluginId: 'allow2automate-web-browsers',
                                monitorId: 'browser-detector'
                            }),
                            agentService.removeAction(agent.id, {
                                pluginId: 'allow2automate-web-browsers',
                                actionId: 'kill-browsers'
                            }),
                            agentService.removeAction(agent.id, {
                                pluginId: 'allow2automate-web-browsers',
                                actionId: 'show-warning'
                            })
                        ]);
                    });
                    return Promise.all(promises);
                })
                .then(() => {
                    console.log('[WebBrowsers Plugin] Unloaded successfully');
                    callback(null);
                })
                .catch(err => {
                    console.error('[WebBrowsers Plugin] Error during unload:', err);
                    callback(err);
                });
        } else {
            callback(null);
        }
    };

    return webBrowsers;
}

export { plugin, TabContent };
