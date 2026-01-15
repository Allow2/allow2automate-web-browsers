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
 * Unit tests for ProcessLevelDetector
 */

// Mock Logger
jest.mock('../src/utils/Logger', () => ({
    createScoped: () => ({
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    })
}));

// Mock BrowserPatterns
const mockBrowserPatterns = {
    getBrowserName: jest.fn(),
    getDisplayName: jest.fn(),
    getBrowserIcon: jest.fn()
};
jest.mock('../src/utils/BrowserPatterns', () => mockBrowserPatterns);

// Import after mocks are set up
const ProcessLevelDetector = require('../src/detectors/ProcessLevelDetector').default;

describe('ProcessLevelDetector', () => {
    let detector;
    let mockContext;
    let mockProcessMonitor;

    beforeEach(() => {
        jest.clearAllMocks();

        mockProcessMonitor = {
            getProcessList: jest.fn().mockResolvedValue([]),
            killProcess: jest.fn().mockResolvedValue(true)
        };

        mockContext = {
            services: {
                processMonitor: mockProcessMonitor
            }
        };

        detector = new ProcessLevelDetector(mockContext);

        // Setup default mock returns
        mockBrowserPatterns.getBrowserName.mockReturnValue(null);
        mockBrowserPatterns.getDisplayName.mockImplementation(name => name);
        mockBrowserPatterns.getBrowserIcon.mockReturnValue('web');
    });

    afterEach(async () => {
        if (detector.isRunning) {
            await detector.stop();
        }
    });

    describe('getMode', () => {
        it('should return "basic"', () => {
            expect(detector.getMode()).toBe('basic');
        });
    });

    describe('getCapabilities', () => {
        it('should return correct capabilities for basic mode', () => {
            const capabilities = detector.getCapabilities();

            expect(capabilities).toEqual({
                browserDetection: true,
                totalTimeTracking: true,
                perSiteTracking: false,
                categoryClassification: false,
                idleDetection: false,
                realTimeBlocking: false,
                extensionRequired: false
            });
        });
    });

    describe('start', () => {
        it('should start scanning', async () => {
            await detector.start();

            expect(detector.isRunning).toBe(true);
            expect(mockProcessMonitor.getProcessList).toHaveBeenCalled();
        });

        it('should not start twice', async () => {
            await detector.start();
            await detector.start();

            expect(detector.isRunning).toBe(true);
            // Should only have done initial scan once
            expect(mockProcessMonitor.getProcessList).toHaveBeenCalledTimes(1);
        });
    });

    describe('stop', () => {
        it('should stop scanning', async () => {
            await detector.start();
            await detector.stop();

            expect(detector.isRunning).toBe(false);
        });

        it('should emit browser-stopped for active browsers', async () => {
            const stoppedHandler = jest.fn();
            detector.on('browser-stopped', stoppedHandler);

            // Setup mock to return a browser
            mockProcessMonitor.getProcessList.mockResolvedValue([
                { pid: 1234, name: 'chrome.exe', path: '/usr/bin/chrome' }
            ]);
            mockBrowserPatterns.getBrowserName.mockReturnValue('chrome');

            await detector.start();

            // Should have detected Chrome
            expect(detector.isBrowserActive()).toBe(true);

            await detector.stop();

            // Should have emitted stopped event
            expect(stoppedHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'chrome',
                    pid: 1234
                })
            );
        });
    });

    describe('identifyBrowser', () => {
        it('should identify Chrome process', () => {
            mockBrowserPatterns.getBrowserName.mockReturnValue('chrome');
            mockBrowserPatterns.getDisplayName.mockReturnValue('Google Chrome');
            mockBrowserPatterns.getBrowserIcon.mockReturnValue('chrome');

            const result = detector.identifyBrowser({
                pid: 1234,
                name: 'chrome.exe',
                path: 'C:\\Program Files\\Google\\Chrome\\chrome.exe'
            });

            expect(result).toEqual({
                name: 'chrome',
                displayName: 'Google Chrome',
                processName: 'chrome.exe',
                executable: 'C:\\Program Files\\Google\\Chrome\\chrome.exe',
                icon: 'chrome'
            });
        });

        it('should return null for non-browser process', () => {
            mockBrowserPatterns.getBrowserName.mockReturnValue(null);

            const result = detector.identifyBrowser({
                pid: 5678,
                name: 'notepad.exe',
                path: 'C:\\Windows\\notepad.exe'
            });

            expect(result).toBeNull();
        });

        it('should handle null process', () => {
            const result = detector.identifyBrowser(null);
            expect(result).toBeNull();
        });

        it('should handle process without name', () => {
            const result = detector.identifyBrowser({ pid: 1234 });
            expect(result).toBeNull();
        });
    });

    describe('scanBrowsers', () => {
        it('should emit browser-started for new browser', async () => {
            const startedHandler = jest.fn();
            detector.on('browser-started', startedHandler);

            mockProcessMonitor.getProcessList.mockResolvedValue([
                { pid: 1234, name: 'chrome.exe', path: '/usr/bin/chrome' }
            ]);
            mockBrowserPatterns.getBrowserName.mockReturnValue('chrome');
            mockBrowserPatterns.getDisplayName.mockReturnValue('Google Chrome');

            await detector.scanBrowsers();

            expect(startedHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'chrome',
                    pid: 1234
                })
            );
        });

        it('should emit browser-stopped when browser terminates', async () => {
            const stoppedHandler = jest.fn();
            detector.on('browser-stopped', stoppedHandler);

            // First scan - Chrome is running
            mockProcessMonitor.getProcessList.mockResolvedValue([
                { pid: 1234, name: 'chrome.exe', path: '/usr/bin/chrome' }
            ]);
            mockBrowserPatterns.getBrowserName.mockReturnValue('chrome');

            await detector.scanBrowsers();

            // Second scan - Chrome is gone
            mockProcessMonitor.getProcessList.mockResolvedValue([]);
            mockBrowserPatterns.getBrowserName.mockReturnValue(null);

            await detector.scanBrowsers();

            expect(stoppedHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'chrome',
                    pid: 1234,
                    duration: expect.any(Number)
                })
            );
        });

        it('should emit browsers-update', async () => {
            const updateHandler = jest.fn();
            detector.on('browsers-update', updateHandler);

            mockProcessMonitor.getProcessList.mockResolvedValue([]);

            await detector.scanBrowsers();

            expect(updateHandler).toHaveBeenCalledWith({
                count: 0,
                browsers: []
            });
        });

        it('should not emit browser-started for already tracked browser', async () => {
            const startedHandler = jest.fn();
            detector.on('browser-started', startedHandler);

            mockProcessMonitor.getProcessList.mockResolvedValue([
                { pid: 1234, name: 'chrome.exe', path: '/usr/bin/chrome' }
            ]);
            mockBrowserPatterns.getBrowserName.mockReturnValue('chrome');

            await detector.scanBrowsers();
            await detector.scanBrowsers();

            // Should only have been called once
            expect(startedHandler).toHaveBeenCalledTimes(1);
        });
    });

    describe('isBrowserActive', () => {
        it('should return false when no browsers running', () => {
            expect(detector.isBrowserActive()).toBe(false);
        });

        it('should return true when browser is running', async () => {
            mockProcessMonitor.getProcessList.mockResolvedValue([
                { pid: 1234, name: 'chrome.exe', path: '/usr/bin/chrome' }
            ]);
            mockBrowserPatterns.getBrowserName.mockReturnValue('chrome');

            await detector.scanBrowsers();

            expect(detector.isBrowserActive()).toBe(true);
        });
    });

    describe('getActiveBrowsers', () => {
        it('should return empty array when no browsers', () => {
            expect(detector.getActiveBrowsers()).toEqual([]);
        });

        it('should return active browser info', async () => {
            mockProcessMonitor.getProcessList.mockResolvedValue([
                { pid: 1234, name: 'chrome.exe', path: '/usr/bin/chrome' }
            ]);
            mockBrowserPatterns.getBrowserName.mockReturnValue('chrome');
            mockBrowserPatterns.getDisplayName.mockReturnValue('Google Chrome');
            mockBrowserPatterns.getBrowserIcon.mockReturnValue('chrome');

            await detector.scanBrowsers();

            const browsers = detector.getActiveBrowsers();

            expect(browsers).toHaveLength(1);
            expect(browsers[0]).toEqual(
                expect.objectContaining({
                    name: 'chrome',
                    pid: 1234
                })
            );
        });
    });

    describe('getActiveBrowserTypes', () => {
        it('should return unique browser types', async () => {
            mockProcessMonitor.getProcessList.mockResolvedValue([
                { pid: 1234, name: 'chrome.exe', path: '/usr/bin/chrome' },
                { pid: 1235, name: 'chrome.exe', path: '/usr/bin/chrome' },
                { pid: 2000, name: 'firefox', path: '/usr/bin/firefox' }
            ]);

            // Mock getBrowserName to return different values based on name
            mockBrowserPatterns.getBrowserName.mockImplementation(name => {
                if (name.includes('chrome')) return 'chrome';
                if (name.includes('firefox')) return 'firefox';
                return null;
            });

            await detector.scanBrowsers();

            const types = detector.getActiveBrowserTypes();

            expect(types).toContain('chrome');
            expect(types).toContain('firefox');
            expect(types).toHaveLength(2);
        });
    });

    describe('getUsageData', () => {
        it('should return basic mode data', () => {
            const data = detector.getUsageData('child-123');

            expect(data.mode).toBe('basic');
            expect(data.detailAvailable).toBe(false);
        });
    });

    describe('event handling', () => {
        it('should register and call listeners', () => {
            const handler = jest.fn();

            detector.on('test-event', handler);
            detector.emit('test-event', { foo: 'bar' });

            expect(handler).toHaveBeenCalledWith({ foo: 'bar' });
        });

        it('should remove listeners', () => {
            const handler = jest.fn();

            detector.on('test-event', handler);
            detector.off('test-event', handler);
            detector.emit('test-event', { foo: 'bar' });

            expect(handler).not.toHaveBeenCalled();
        });
    });

    describe('killBrowser', () => {
        it('should call process monitor killProcess', async () => {
            await detector.killBrowser(1234);

            expect(mockProcessMonitor.killProcess).toHaveBeenCalledWith(1234);
        });
    });

    describe('killAllBrowsers', () => {
        it('should kill all active browsers', async () => {
            mockProcessMonitor.getProcessList.mockResolvedValue([
                { pid: 1234, name: 'chrome.exe', path: '/usr/bin/chrome' },
                { pid: 5678, name: 'firefox', path: '/usr/bin/firefox' }
            ]);

            mockBrowserPatterns.getBrowserName.mockReturnValue('chrome');

            await detector.scanBrowsers();
            await detector.killAllBrowsers();

            // Should have killed both
            expect(mockProcessMonitor.killProcess).toHaveBeenCalled();
        });
    });
});

describe('BrowserPatterns', () => {
    // Reset mocks for BrowserPatterns tests
    beforeEach(() => {
        jest.resetModules();
    });

    it('should correctly identify browser names', () => {
        // This would test the actual BrowserPatterns module
        // For now, we've mocked it, but in integration tests we'd test the real thing
        const BrowserPatterns = require('../src/utils/BrowserPatterns').default;

        expect(BrowserPatterns.getBrowserName).toBeDefined();
        expect(BrowserPatterns.getDisplayName).toBeDefined();
        expect(BrowserPatterns.getBrowserIcon).toBeDefined();
    });
});
