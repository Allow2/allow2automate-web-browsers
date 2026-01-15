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
import WebsiteClassifier from '../classifiers/WebsiteClassifier';

const log = Logger.createScoped('ReportGenerator');

/**
 * ReportGenerator - Generates usage reports for browser activity.
 */
class ReportGenerator {
    /**
     * Create a ReportGenerator.
     * @param {Object} quotaManager BrowserQuotaManager instance
     * @param {Object} detector Browser detector instance
     */
    constructor(quotaManager, detector) {
        this.quotaManager = quotaManager;
        this.detector = detector;
        this.classifier = new WebsiteClassifier();
    }

    /**
     * Generate a daily summary report.
     * @param {string} childId Child identifier
     * @param {Date} date Date for the report (default: today)
     * @returns {Object} Daily report
     */
    generateDailySummary(childId, date = new Date()) {
        const usageReport = this.quotaManager.getUsageReport(childId);

        if (!usageReport) {
            return {
                date: this.formatDate(date),
                childId,
                available: false,
                message: 'No usage data available'
            };
        }

        const report = {
            date: this.formatDate(date),
            childId,
            available: true,
            mode: usageReport.mode,

            // Basic stats
            totalInternetTime: usageReport.internetTime,
            totalInternetTimeFormatted: this.formatDuration(usageReport.internetTime * 60),
            internetQuota: usageReport.internetQuota,
            internetRemaining: usageReport.internetRemaining,
            quotaPercentUsed: usageReport.internetQuota
                ? Math.round((usageReport.internetTime / usageReport.internetQuota) * 100)
                : null,

            // Browser info
            browsersUsed: usageReport.activeBrowsers || [],
            currentlyActive: usageReport.browserActive
        };

        // Enhanced mode additions
        if (usageReport.mode === 'enhanced' || usageReport.mode === 'hybrid') {
            report.categoryBreakdown = this.formatCategoryBreakdown(usageReport.categoryStats);
            report.topSites = this.formatTopSites(usageReport.topSites);
            report.detailedAvailable = true;
        } else {
            report.detailedAvailable = false;
            report.detailedMessage = 'Install browser extension for detailed site tracking';
        }

        return report;
    }

    /**
     * Generate a weekly summary report.
     * @param {string} childId Child identifier
     * @param {Date} endDate End date for the week
     * @returns {Object} Weekly report
     */
    generateWeeklySummary(childId, endDate = new Date()) {
        // This would typically aggregate data from stored history
        // For now, return the current day's data as a placeholder
        const dailyReport = this.generateDailySummary(childId, endDate);

        return {
            period: 'week',
            endDate: this.formatDate(endDate),
            startDate: this.formatDate(new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000)),
            childId,

            // Weekly totals (placeholder - would sum actual stored data)
            totalInternetTime: dailyReport.totalInternetTime,
            averagePerDay: dailyReport.totalInternetTime, // Would calculate actual average
            peakDay: this.formatDate(endDate),

            // Category trends
            categoryTrends: dailyReport.categoryBreakdown || [],

            // Most visited sites
            topSites: dailyReport.topSites || [],

            // Summary
            summary: this.generateSummaryText(dailyReport)
        };
    }

    /**
     * Format category breakdown for reports.
     * @param {Object} categoryStats Category statistics
     * @returns {Array} Formatted category breakdown
     */
    formatCategoryBreakdown(categoryStats) {
        if (!categoryStats) {
            return [];
        }

        const total = Object.values(categoryStats).reduce((sum, stat) =>
            sum + (stat.totalTime || 0), 0
        );

        return Object.entries(categoryStats)
            .map(([category, stats]) => ({
                category,
                displayName: stats.displayName || category,
                totalTime: stats.totalTime || 0,
                totalTimeFormatted: this.formatDuration(stats.totalTime || 0),
                percentage: total > 0
                    ? Math.round(((stats.totalTime || 0) / total) * 100)
                    : 0,
                siteCount: stats.siteCount || 0,
                topSites: (stats.sites || []).slice(0, 5).map(site => ({
                    domain: site.domain,
                    time: site.time,
                    timeFormatted: this.formatDuration(site.time)
                }))
            }))
            .sort((a, b) => b.totalTime - a.totalTime);
    }

    /**
     * Format top sites for reports.
     * @param {Array} topSites Top sites array
     * @returns {Array} Formatted top sites
     */
    formatTopSites(topSites) {
        if (!topSites) {
            return [];
        }

        return topSites.slice(0, 20).map((site, index) => ({
            rank: index + 1,
            domain: site.domain,
            totalTime: site.totalTime,
            totalTimeFormatted: this.formatDuration(site.totalTime),
            visits: site.visits,
            category: site.category,
            categoryDisplayName: this.getCategoryDisplayName(site.category)
        }));
    }

    /**
     * Generate summary text for a report.
     * @param {Object} report Report data
     * @returns {string} Summary text
     */
    generateSummaryText(report) {
        const parts = [];

        if (report.totalInternetTime) {
            parts.push(`Total internet time: ${report.totalInternetTimeFormatted}`);
        }

        if (report.quotaPercentUsed !== null) {
            parts.push(`Used ${report.quotaPercentUsed}% of daily quota`);
        }

        if (report.browsersUsed && report.browsersUsed.length > 0) {
            parts.push(`Browsers: ${report.browsersUsed.join(', ')}`);
        }

        if (report.topSites && report.topSites.length > 0) {
            const topSite = report.topSites[0];
            parts.push(`Most visited: ${topSite.domain} (${topSite.totalTimeFormatted})`);
        }

        return parts.join('. ');
    }

    /**
     * Format duration in seconds to human-readable string.
     * @param {number} seconds Duration in seconds
     * @returns {string} Formatted duration
     */
    formatDuration(seconds) {
        if (!seconds || seconds <= 0) {
            return '0 minutes';
        }

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);

        if (hours > 0) {
            if (minutes > 0) {
                return `${hours}h ${minutes}m`;
            }
            return `${hours} hour${hours !== 1 ? 's' : ''}`;
        }

        return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }

    /**
     * Format date to string.
     * @param {Date} date Date to format
     * @returns {string} Formatted date
     */
    formatDate(date) {
        return date.toISOString().split('T')[0];
    }

    /**
     * Get display name for category.
     * @param {string} category Category identifier
     * @returns {string} Display name
     */
    getCategoryDisplayName(category) {
        const names = {
            social: 'Social Media',
            video: 'Video',
            gaming: 'Gaming',
            education: 'Education',
            news: 'News',
            shopping: 'Shopping',
            productivity: 'Productivity',
            music: 'Music',
            sports: 'Sports',
            search: 'Search',
            other: 'Other'
        };
        return names[category] || category;
    }

    /**
     * Export report to CSV format.
     * @param {Object} report Report to export
     * @returns {string} CSV content
     */
    exportToCSV(report) {
        const lines = [];

        // Header
        lines.push('Date,Total Internet Time (min),Quota Used %');
        lines.push(`${report.date},${report.totalInternetTime},${report.quotaPercentUsed || 'N/A'}`);

        if (report.topSites && report.topSites.length > 0) {
            lines.push('');
            lines.push('Site,Time (sec),Visits,Category');

            for (const site of report.topSites) {
                lines.push(`${site.domain},${site.totalTime},${site.visits},${site.category}`);
            }
        }

        if (report.categoryBreakdown && report.categoryBreakdown.length > 0) {
            lines.push('');
            lines.push('Category,Time (sec),Percentage');

            for (const cat of report.categoryBreakdown) {
                lines.push(`${cat.displayName},${cat.totalTime},${cat.percentage}%`);
            }
        }

        return lines.join('\n');
    }

    /**
     * Get real-time status for display.
     * @param {string} childId Child identifier
     * @returns {Object} Real-time status
     */
    getRealTimeStatus(childId) {
        const usageReport = this.quotaManager.getUsageReport(childId);

        if (!usageReport) {
            return {
                active: false,
                message: 'No active browser session'
            };
        }

        return {
            active: usageReport.browserActive,
            activeBrowsers: usageReport.activeBrowsers,
            internetTimeUsed: usageReport.internetTime,
            internetTimeRemaining: usageReport.internetRemaining,
            percentUsed: usageReport.internetQuota
                ? Math.round((usageReport.internetTime / usageReport.internetQuota) * 100)
                : null,
            mode: usageReport.mode,
            lastUpdate: new Date().toISOString()
        };
    }
}

export default ReportGenerator;
