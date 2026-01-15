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
 * CategoryPatterns - Website category mappings and patterns.
 * Used by WebsiteClassifier to categorize websites.
 */
class CategoryPatterns {
    /**
     * Get all category definitions with their patterns.
     * @returns {Object} Map of category to domain patterns
     */
    static getPatterns() {
        return {
            social: {
                displayName: 'Social Media',
                icon: 'people',
                domains: [
                    'facebook.com',
                    'instagram.com',
                    'twitter.com',
                    'x.com',
                    'tiktok.com',
                    'snapchat.com',
                    'linkedin.com',
                    'pinterest.com',
                    'reddit.com',
                    'tumblr.com',
                    'discord.com',
                    'discord.gg',
                    'whatsapp.com',
                    'telegram.org',
                    'messenger.com',
                    'threads.net',
                    'mastodon.social',
                    'bsky.app'
                ]
            },
            video: {
                displayName: 'Video Streaming',
                icon: 'play_circle',
                domains: [
                    'youtube.com',
                    'youtu.be',
                    'netflix.com',
                    'hulu.com',
                    'disneyplus.com',
                    'primevideo.com',
                    'amazon.com/gp/video',
                    'twitch.tv',
                    'vimeo.com',
                    'dailymotion.com',
                    'crunchyroll.com',
                    'peacocktv.com',
                    'max.com',
                    'hbomax.com',
                    'paramountplus.com',
                    'pluto.tv',
                    'tubi.tv',
                    'funimation.com',
                    'rumble.com'
                ]
            },
            gaming: {
                displayName: 'Gaming',
                icon: 'sports_esports',
                domains: [
                    'roblox.com',
                    'minecraft.net',
                    'steampowered.com',
                    'steam.com',
                    'epicgames.com',
                    'origin.com',
                    'ea.com',
                    'ubisoft.com',
                    'blizzard.com',
                    'battle.net',
                    'xbox.com',
                    'playstation.com',
                    'nintendo.com',
                    'itch.io',
                    'gog.com',
                    'kongregate.com',
                    'newgrounds.com',
                    'poki.com',
                    'coolmathgames.com',
                    'miniclip.com',
                    'addictinggames.com',
                    'y8.com',
                    'friv.com',
                    'crazygames.com',
                    'chess.com',
                    'lichess.org'
                ]
            },
            education: {
                displayName: 'Education',
                icon: 'school',
                domains: [
                    'khanacademy.org',
                    'coursera.org',
                    'edx.org',
                    'udemy.com',
                    'udacity.com',
                    'skillshare.com',
                    'duolingo.com',
                    'quizlet.com',
                    'brainpop.com',
                    'ixl.com',
                    'prodigygame.com',
                    'splashlearn.com',
                    'abcmouse.com',
                    'pbskids.org',
                    'natgeokids.com',
                    'coolmath.com',
                    'mathway.com',
                    'wolframalpha.com',
                    'wikipedia.org',
                    'britannica.com',
                    'scholastic.com',
                    'readingiq.com',
                    'epic.com',
                    'starfall.com',
                    'typingclub.com',
                    'codecademy.com',
                    'scratch.mit.edu',
                    'code.org',
                    'brilliant.org',
                    'masterclass.com',
                    'linkedin.com/learning',
                    'classroom.google.com',
                    'canvas.instructure.com',
                    'blackboard.com',
                    'moodle.org'
                ]
            },
            news: {
                displayName: 'News',
                icon: 'article',
                domains: [
                    'cnn.com',
                    'bbc.com',
                    'bbc.co.uk',
                    'nytimes.com',
                    'washingtonpost.com',
                    'theguardian.com',
                    'reuters.com',
                    'apnews.com',
                    'npr.org',
                    'abcnews.go.com',
                    'nbcnews.com',
                    'cbsnews.com',
                    'foxnews.com',
                    'usatoday.com',
                    'wsj.com',
                    'bloomberg.com',
                    'huffpost.com',
                    'politico.com',
                    'axios.com',
                    'news.google.com'
                ]
            },
            shopping: {
                displayName: 'Shopping',
                icon: 'shopping_cart',
                domains: [
                    'amazon.com',
                    'ebay.com',
                    'etsy.com',
                    'walmart.com',
                    'target.com',
                    'bestbuy.com',
                    'aliexpress.com',
                    'wish.com',
                    'shein.com',
                    'wayfair.com',
                    'overstock.com',
                    'newegg.com',
                    'zappos.com',
                    'nordstrom.com',
                    'macys.com',
                    'kohls.com',
                    'costco.com',
                    'homedepot.com',
                    'lowes.com',
                    'ikea.com'
                ]
            },
            productivity: {
                displayName: 'Productivity',
                icon: 'work',
                domains: [
                    'google.com/docs',
                    'docs.google.com',
                    'sheets.google.com',
                    'slides.google.com',
                    'drive.google.com',
                    'office.com',
                    'office365.com',
                    'microsoft365.com',
                    'onedrive.live.com',
                    'notion.so',
                    'notion.com',
                    'evernote.com',
                    'trello.com',
                    'asana.com',
                    'monday.com',
                    'slack.com',
                    'zoom.us',
                    'teams.microsoft.com',
                    'dropbox.com',
                    'box.com',
                    'airtable.com',
                    'figma.com',
                    'canva.com',
                    'miro.com'
                ]
            },
            music: {
                displayName: 'Music',
                icon: 'music_note',
                domains: [
                    'spotify.com',
                    'open.spotify.com',
                    'music.apple.com',
                    'music.amazon.com',
                    'pandora.com',
                    'soundcloud.com',
                    'tidal.com',
                    'deezer.com',
                    'music.youtube.com',
                    'bandcamp.com',
                    'audiomack.com',
                    'mixcloud.com'
                ]
            },
            sports: {
                displayName: 'Sports',
                icon: 'sports',
                domains: [
                    'espn.com',
                    'nfl.com',
                    'nba.com',
                    'mlb.com',
                    'nhl.com',
                    'fifa.com',
                    'premierleague.com',
                    'sports.yahoo.com',
                    'bleacherreport.com',
                    'cbssports.com',
                    'foxsports.com',
                    'nbcsports.com',
                    'theathletic.com',
                    'goal.com',
                    'skysports.com'
                ]
            },
            search: {
                displayName: 'Search Engines',
                icon: 'search',
                domains: [
                    'google.com',
                    'bing.com',
                    'yahoo.com',
                    'duckduckgo.com',
                    'ecosia.org',
                    'brave.com/search',
                    'search.brave.com',
                    'yandex.com',
                    'baidu.com',
                    'ask.com'
                ]
            },
            adult: {
                displayName: 'Adult Content',
                icon: 'block',
                domains: [
                    // Intentionally minimal - real implementation would use
                    // comprehensive database or third-party classification
                ]
            }
        };
    }

    /**
     * Get list of all category identifiers.
     * @returns {Array<string>} Category identifiers
     */
    static getCategories() {
        return Object.keys(this.getPatterns());
    }

    /**
     * Get display information for a category.
     * @param {string} categoryId Category identifier
     * @returns {Object} Category display info
     */
    static getCategoryInfo(categoryId) {
        const patterns = this.getPatterns();
        const category = patterns[categoryId];

        if (!category) {
            return {
                id: categoryId,
                displayName: categoryId.charAt(0).toUpperCase() + categoryId.slice(1),
                icon: 'web',
                domains: []
            };
        }

        return {
            id: categoryId,
            displayName: category.displayName,
            icon: category.icon,
            domains: category.domains
        };
    }

    /**
     * Get domains for a specific category.
     * @param {string} categoryId Category identifier
     * @returns {Array<string>} Domain patterns
     */
    static getDomains(categoryId) {
        const patterns = this.getPatterns();
        return patterns[categoryId]?.domains || [];
    }

    /**
     * Get all domains with their categories.
     * @returns {Object} Map of domain to category
     */
    static getDomainCategoryMap() {
        const patterns = this.getPatterns();
        const map = {};

        for (const [category, info] of Object.entries(patterns)) {
            for (const domain of info.domains) {
                map[domain] = category;
            }
        }

        return map;
    }

    /**
     * Check if a category is considered "restricted" (needs special handling).
     * @param {string} categoryId Category identifier
     * @returns {boolean} True if restricted
     */
    static isRestricted(categoryId) {
        const restricted = ['adult', 'gambling'];
        return restricted.includes(categoryId);
    }

    /**
     * Get default quota values for categories (in minutes).
     * @returns {Object} Map of category to default quota
     */
    static getDefaultQuotas() {
        return {
            social: 60,      // 1 hour
            video: 90,       // 1.5 hours
            gaming: 60,      // 1 hour
            education: null, // Unlimited
            news: null,      // Unlimited
            shopping: 30,    // 30 minutes
            productivity: null, // Unlimited
            music: null,     // Unlimited
            sports: 60,      // 1 hour
            search: null,    // Unlimited
            adult: 0,        // Blocked
            other: null      // Unlimited
        };
    }
}

export default CategoryPatterns;
