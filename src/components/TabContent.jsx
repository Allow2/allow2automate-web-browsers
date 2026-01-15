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

import React, { Component } from 'react';

/**
 * TabContent - React UI component for the Web Browsers plugin.
 * Displays browser monitoring status, detected browsers, and usage information.
 */
class TabContent extends Component {
    constructor(props) {
        super(props);

        this.state = {
            status: null,
            agents: [],
            usage: null,
            settings: null,
            violations: [],
            loading: true,
            error: null
        };

        this.refreshInterval = null;
    }

    componentDidMount() {
        this.loadStatus();

        // Refresh status every 5 seconds
        this.refreshInterval = setInterval(() => {
            this.loadStatus();
        }, 5000);
    }

    componentWillUnmount() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
    }

    async loadStatus() {
        try {
            // Use IPC to get status from main process
            if (window.ipcRenderer) {
                const [err, result] = await window.ipcRenderer.invoke('webBrowsers:getStatus');
                if (err) throw new Error(err.message || 'Failed to get status');

                this.setState({
                    status: result,
                    loading: false,
                    error: null
                });

                // Load agents
                const [agentErr, agentResult] = await window.ipcRenderer.invoke('webBrowsers:getAgents');
                if (!agentErr && agentResult) {
                    this.setState({ agents: agentResult.agents || [] });
                }

                // Load violations
                const [violErr, violResult] = await window.ipcRenderer.invoke('webBrowsers:getViolations', { limit: 10 });
                if (!violErr && violResult) {
                    this.setState({ violations: violResult.violations || [] });
                }
            } else {
                // Fallback for non-Electron environments
                this.setState({
                    loading: false,
                    error: null
                });
            }
        } catch (error) {
            this.setState({
                loading: false,
                error: error.message
            });
        }
    }

    formatDuration(seconds) {
        if (!seconds && seconds !== 0) return '--';

        const hours = Math.floor(seconds / 3600);
        const mins = Math.round((seconds % 3600) / 60);

        if (hours > 0) {
            return `${hours}h ${mins}m`;
        }
        return `${mins}m`;
    }

    formatTimeAgo(timestamp) {
        if (!timestamp) return '--';

        const seconds = Math.floor((Date.now() - timestamp) / 1000);

        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    }

    renderStatusIndicator() {
        const { status } = this.state;

        if (!status) {
            return (
                <div style={styles.statusSection}>
                    <p>No status available</p>
                </div>
            );
        }

        const isActive = status.activeAgents > 0;
        const statusColor = isActive ? '#4caf50' : '#999';
        const statusText = isActive ? 'Active' : 'Inactive';

        return (
            <div style={styles.statusSection}>
                <div style={styles.statusRow}>
                    <div style={{ ...styles.statusDot, backgroundColor: statusColor }} />
                    <span style={styles.statusText}>{statusText}</span>
                </div>

                <div style={styles.statsGrid}>
                    <div style={styles.statItem}>
                        <span style={styles.statValue}>{status.agentCount || 0}</span>
                        <span style={styles.statLabel}>Agents</span>
                    </div>
                    <div style={styles.statItem}>
                        <span style={styles.statValue}>{status.activeAgents || 0}</span>
                        <span style={styles.statLabel}>Online</span>
                    </div>
                    <div style={styles.statItem}>
                        <span style={styles.statValue}>{status.linkedAgents || 0}</span>
                        <span style={styles.statLabel}>Linked</span>
                    </div>
                    <div style={styles.statItem}>
                        <span style={styles.statValue}>{status.activeSessions || 0}</span>
                        <span style={styles.statLabel}>Sessions</span>
                    </div>
                </div>
            </div>
        );
    }

    renderAgentsList() {
        const { agents } = this.state;

        if (!agents || agents.length === 0) {
            return (
                <div style={styles.agentsSection}>
                    <h3 style={styles.sectionTitle}>Agents</h3>
                    <p style={styles.noData}>No agents detected</p>
                </div>
            );
        }

        return (
            <div style={styles.agentsSection}>
                <h3 style={styles.sectionTitle}>Agents</h3>

                {agents.map(agent => (
                    <div key={agent.id} style={styles.agentRow}>
                        <div style={{
                            ...styles.onlineIndicator,
                            backgroundColor: agent.online ? '#4caf50' : '#999'
                        }} />
                        <div style={styles.agentInfo}>
                            <span style={styles.agentName}>{agent.hostname}</span>
                            <span style={styles.agentDetails}>
                                {agent.platform} | {agent.childId ? `Child: ${agent.childId}` : 'Not linked'}
                            </span>
                        </div>
                        <div style={styles.browsersList}>
                            {agent.browsers && agent.browsers.length > 0 ? (
                                agent.browsers.map((b, i) => (
                                    <span key={i} style={styles.browserBadge}>{b}</span>
                                ))
                            ) : (
                                <span style={styles.noBrowsers}>No browsers</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    renderViolations() {
        const { violations } = this.state;

        if (!violations || violations.length === 0) {
            return null;
        }

        return (
            <div style={styles.violationsSection}>
                <h3 style={styles.sectionTitle}>Recent Violations</h3>

                {violations.slice(0, 5).map((violation, index) => (
                    <div key={index} style={styles.violationRow}>
                        <span style={styles.violationIcon}>!</span>
                        <div style={styles.violationInfo}>
                            <span style={styles.violationHost}>{violation.hostname}</span>
                            <span style={styles.violationReason}>{violation.reason}</span>
                        </div>
                        <span style={styles.violationTime}>
                            {this.formatTimeAgo(violation.timestamp)}
                        </span>
                    </div>
                ))}
            </div>
        );
    }

    renderSettings() {
        const { status } = this.state;

        if (!status?.settings) {
            return null;
        }

        const settings = status.settings;

        return (
            <div style={styles.settingsSection}>
                <h3 style={styles.sectionTitle}>Settings</h3>

                <div style={styles.settingRow}>
                    <span>Check Interval:</span>
                    <span>{settings.checkInterval / 1000}s</span>
                </div>
                <div style={styles.settingRow}>
                    <span>Kill on Violation:</span>
                    <span>{settings.killOnViolation ? 'Yes' : 'No'}</span>
                </div>
                <div style={styles.settingRow}>
                    <span>Warning Minutes:</span>
                    <span>{settings.warningMinutes?.join(', ') || 'None'}</span>
                </div>
                <div style={styles.settingRow}>
                    <span>Grace Period:</span>
                    <span>{settings.gracePeriod}s</span>
                </div>
            </div>
        );
    }

    render() {
        const { plugin } = this.props;
        const { loading, error } = this.state;

        if (loading) {
            return (
                <div style={styles.container}>
                    <h2 style={styles.title}>{plugin?.name || 'Web Browsers'}</h2>
                    <p>Loading...</p>
                </div>
            );
        }

        if (error) {
            return (
                <div style={styles.container}>
                    <h2 style={styles.title}>{plugin?.name || 'Web Browsers'}</h2>
                    <p style={styles.error}>Error: {error}</p>
                </div>
            );
        }

        return (
            <div style={styles.container}>
                <h2 style={styles.title}>{plugin?.name || 'Web Browsers'}</h2>
                <p style={styles.description}>
                    Monitor browser usage and enforce internet time quotas across agents.
                </p>

                {this.renderStatusIndicator()}
                {this.renderAgentsList()}
                {this.renderViolations()}
                {this.renderSettings()}

                <div style={styles.footer}>
                    <p style={styles.footerText}>
                        Browser monitoring is deployed to agents via the Allow2 Agent System.
                    </p>
                </div>
            </div>
        );
    }
}

const styles = {
    container: {
        padding: '16px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    },
    title: {
        fontSize: '24px',
        fontWeight: '500',
        marginBottom: '8px',
        color: '#333'
    },
    description: {
        fontSize: '14px',
        color: '#666',
        marginBottom: '16px'
    },
    statusSection: {
        padding: '16px',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px',
        marginBottom: '16px'
    },
    statusRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '12px'
    },
    statusDot: {
        width: '12px',
        height: '12px',
        borderRadius: '50%'
    },
    statusText: {
        fontSize: '16px',
        fontWeight: '500'
    },
    statsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '12px'
    },
    statItem: {
        textAlign: 'center'
    },
    statValue: {
        display: 'block',
        fontSize: '24px',
        fontWeight: '600',
        color: '#1976d2'
    },
    statLabel: {
        fontSize: '12px',
        color: '#666'
    },
    agentsSection: {
        marginBottom: '16px'
    },
    sectionTitle: {
        fontSize: '16px',
        fontWeight: '500',
        marginBottom: '12px',
        color: '#333'
    },
    agentRow: {
        display: 'flex',
        alignItems: 'center',
        padding: '12px',
        backgroundColor: '#fff',
        border: '1px solid #e0e0e0',
        borderRadius: '4px',
        marginBottom: '8px'
    },
    onlineIndicator: {
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        marginRight: '12px'
    },
    agentInfo: {
        flex: 1
    },
    agentName: {
        display: 'block',
        fontWeight: '500',
        color: '#333'
    },
    agentDetails: {
        fontSize: '12px',
        color: '#666'
    },
    browsersList: {
        display: 'flex',
        gap: '4px'
    },
    browserBadge: {
        padding: '2px 8px',
        backgroundColor: '#e3f2fd',
        color: '#1976d2',
        borderRadius: '4px',
        fontSize: '12px'
    },
    noBrowsers: {
        fontSize: '12px',
        color: '#999'
    },
    violationsSection: {
        marginBottom: '16px'
    },
    violationRow: {
        display: 'flex',
        alignItems: 'center',
        padding: '8px 12px',
        backgroundColor: '#fff3e0',
        borderRadius: '4px',
        marginBottom: '4px'
    },
    violationIcon: {
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        backgroundColor: '#ff9800',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        marginRight: '12px'
    },
    violationInfo: {
        flex: 1
    },
    violationHost: {
        display: 'block',
        fontWeight: '500'
    },
    violationReason: {
        fontSize: '12px',
        color: '#666'
    },
    violationTime: {
        fontSize: '12px',
        color: '#999'
    },
    settingsSection: {
        padding: '12px',
        backgroundColor: '#fafafa',
        borderRadius: '8px',
        marginBottom: '16px'
    },
    settingRow: {
        display: 'flex',
        justifyContent: 'space-between',
        padding: '4px 0',
        fontSize: '14px'
    },
    footer: {
        marginTop: '24px',
        paddingTop: '16px',
        borderTop: '1px solid #e0e0e0'
    },
    footerText: {
        fontSize: '12px',
        color: '#999'
    },
    noData: {
        color: '#666',
        fontStyle: 'italic'
    },
    error: {
        color: '#f44336'
    }
};

export default TabContent;
