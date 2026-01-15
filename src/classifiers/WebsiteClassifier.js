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

import CategoryPatterns from './CategoryPatterns';
import Logger from '../utils/Logger';

const log = Logger.createScoped('WebsiteClassifier');

/**
 * WebsiteClassifier - Classifies websites into categories.
 * Used in enhanced mode for category-based quota enforcement.
 */
class WebsiteClassifier {
    constructor() {
        this.domainCategoryMap = CategoryPatterns.getDomainCategoryMap();
        this.customRules = new Map();
        this.cache = new Map();
        this.cacheMaxSize = 1000;
    }

    /**
     * Classify a URL or domain into a category.
     * @param {string} urlOrDomain URL or domain to classify
     * @returns {Object} Classification result
     */
    classify(urlOrDomain) {
        if (!urlOrDomain) {
            return this.createResult('other', 0);
        }

        // Extract domain from URL
        const domain = this.extractDomain(urlOrDomain);

        if (!domain) {
            return this.createResult('other', 0);
        }

        // Check cache first
        if (this.cache.has(domain)) {
            return this.cache.get(domain);
        }

        // Check custom rules first (user overrides)
        if (this.customRules.has(domain)) {
            const result = this.createResult(this.customRules.get(domain), 1.0);
            this.addToCache(domain, result);
            return result;
        }

        // Check exact domain match
        let result = this.matchDomain(domain);

        if (!result) {
            // Try parent domain (e.g., subdomain.example.com -> example.com)
            const parentDomain = this.getParentDomain(domain);
            if (parentDomain) {
                result = this.matchDomain(parentDomain);
            }
        }

        if (!result) {
            // Try pattern matching
            result = this.matchPattern(domain);
        }

        if (!result) {
            result = this.createResult('other', 0);
        }

        this.addToCache(domain, result);
        return result;
    }

    /**
     * Extract domain from URL.
     * @param {string} urlOrDomain URL or domain string
     * @returns {string|null} Extracted domain or null
     */
    extractDomain(urlOrDomain) {
        try {
            // If it looks like a URL, parse it
            if (urlOrDomain.includes('://')) {
                const url = new URL(urlOrDomain);
                return url.hostname.toLowerCase();
            }

            // If it starts with www., remove it for matching
            let domain = urlOrDomain.toLowerCase().trim();
            if (domain.startsWith('www.')) {
                domain = domain.substring(4);
            }

            // Remove trailing slashes and paths
            domain = domain.split('/')[0];

            return domain;
        } catch (error) {
            // If parsing fails, try to clean it up manually
            let domain = urlOrDomain.toLowerCase().trim();
            domain = domain.replace(/^(https?:\/\/)?(www\.)?/, '');
            domain = domain.split('/')[0];
            domain = domain.split('?')[0];
            return domain || null;
        }
    }

    /**
     * Get parent domain (remove first subdomain).
     * @param {string} domain Domain to process
     * @returns {string|null} Parent domain or null
     */
    getParentDomain(domain) {
        const parts = domain.split('.');
        if (parts.length > 2) {
            return parts.slice(1).join('.');
        }
        return null;
    }

    /**
     * Match domain against known patterns.
     * @param {string} domain Domain to match
     * @returns {Object|null} Classification result or null
     */
    matchDomain(domain) {
        const category = this.domainCategoryMap[domain];
        if (category) {
            return this.createResult(category, 1.0);
        }
        return null;
    }

    /**
     * Match domain using pattern heuristics.
     * @param {string} domain Domain to match
     * @returns {Object|null} Classification result or null
     */
    matchPattern(domain) {
        // Gaming patterns
        if (domain.includes('game') || domain.includes('play') ||
            domain.endsWith('.gg') || domain.includes('arcade')) {
            return this.createResult('gaming', 0.7);
        }

        // Education patterns
        if (domain.endsWith('.edu') || domain.includes('learn') ||
            domain.includes('course') || domain.includes('school') ||
            domain.includes('academy')) {
            return this.createResult('education', 0.7);
        }

        // News patterns
        if (domain.includes('news') || domain.includes('daily') ||
            domain.includes('times') || domain.includes('post') ||
            domain.includes('herald') || domain.includes('tribune')) {
            return this.createResult('news', 0.6);
        }

        // Shopping patterns
        if (domain.includes('shop') || domain.includes('store') ||
            domain.includes('buy') || domain.includes('market')) {
            return this.createResult('shopping', 0.6);
        }

        // Video patterns
        if (domain.includes('video') || domain.includes('stream') ||
            domain.includes('watch') || domain.includes('tv')) {
            return this.createResult('video', 0.6);
        }

        // Social patterns
        if (domain.includes('social') || domain.includes('chat') ||
            domain.includes('forum') || domain.includes('community')) {
            return this.createResult('social', 0.5);
        }

        return null;
    }

    /**
     * Create a classification result object.
     * @param {string} category Category identifier
     * @param {number} confidence Confidence score (0-1)
     * @returns {Object} Classification result
     */
    createResult(category, confidence) {
        const info = CategoryPatterns.getCategoryInfo(category);
        return {
            category,
            displayName: info.displayName,
            icon: info.icon,
            confidence,
            isRestricted: CategoryPatterns.isRestricted(category)
        };
    }

    /**
     * Add result to cache.
     * @param {string} domain Domain key
     * @param {Object} result Classification result
     */
    addToCache(domain, result) {
        // Limit cache size
        if (this.cache.size >= this.cacheMaxSize) {
            // Remove oldest entries (first 100)
            const keys = Array.from(this.cache.keys()).slice(0, 100);
            for (const key of keys) {
                this.cache.delete(key);
            }
        }

        this.cache.set(domain, result);
    }

    /**
     * Add a custom classification rule.
     * @param {string} domain Domain to classify
     * @param {string} category Category to assign
     */
    addCustomRule(domain, category) {
        const cleanDomain = this.extractDomain(domain);
        if (cleanDomain) {
            this.customRules.set(cleanDomain, category);
            this.cache.delete(cleanDomain); // Clear cache for this domain
            log.info(`Added custom rule: ${cleanDomain} -> ${category}`);
        }
    }

    /**
     * Remove a custom classification rule.
     * @param {string} domain Domain to remove rule for
     */
    removeCustomRule(domain) {
        const cleanDomain = this.extractDomain(domain);
        if (cleanDomain) {
            this.customRules.delete(cleanDomain);
            this.cache.delete(cleanDomain);
        }
    }

    /**
     * Get all custom rules.
     * @returns {Object} Map of domain to category
     */
    getCustomRules() {
        return Object.fromEntries(this.customRules);
    }

    /**
     * Clear the classification cache.
     */
    clearCache() {
        this.cache.clear();
        log.debug('Classification cache cleared');
    }

    /**
     * Batch classify multiple URLs.
     * @param {Array<string>} urls URLs to classify
     * @returns {Array<Object>} Classification results
     */
    classifyBatch(urls) {
        return urls.map(url => ({
            url,
            ...this.classify(url)
        }));
    }

    /**
     * Get category statistics from usage data.
     * @param {Array<Object>} usageData Array of {url, duration} objects
     * @returns {Object} Category statistics
     */
    getCategoryStats(usageData) {
        const stats = {};

        for (const entry of usageData) {
            const result = this.classify(entry.url || entry.domain);
            const category = result.category;

            if (!stats[category]) {
                stats[category] = {
                    category,
                    displayName: result.displayName,
                    totalTime: 0,
                    siteCount: 0,
                    sites: []
                };
            }

            stats[category].totalTime += entry.duration || 0;
            stats[category].siteCount += 1;

            // Track top sites per category
            const siteDomain = this.extractDomain(entry.url || entry.domain);
            const existingSite = stats[category].sites.find(s => s.domain === siteDomain);

            if (existingSite) {
                existingSite.time += entry.duration || 0;
            } else if (stats[category].sites.length < 10) {
                stats[category].sites.push({
                    domain: siteDomain,
                    time: entry.duration || 0
                });
            }
        }

        // Sort sites within each category by time
        for (const stat of Object.values(stats)) {
            stat.sites.sort((a, b) => b.time - a.time);
        }

        return stats;
    }
}

export default WebsiteClassifier;
