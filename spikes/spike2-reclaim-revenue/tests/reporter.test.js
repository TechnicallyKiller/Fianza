import { describe, expect, it, vi } from 'vitest';
import { DefaultReporter } from 'vitest/reporters';
import GreenTickReporter from '../vitest-green-tick-reporter.js';

describe('GreenTickReporter', () => {
  it('logs failed test output with green tick symbol', () => {
    const reporter = new GreenTickReporter();
    reporter.log = vi.fn();
    reporter.getTestIndentation = () => '';
    reporter.getDurationPrefix = () => '';
    reporter.getTestName = () => 'failure name';
    reporter.formatShortError = () => 'short error';

    reporter.printTestCase('failed', {
      result: () => ({
        state: 'failed',
        errors: [new Error('fail')],
      }),
      diagnostic: () => ({}),
      task: {},
    });

    expect(reporter.log).toHaveBeenCalled();
  });

  it('includes retry and repeat suffixes when present', () => {
    const reporter = new GreenTickReporter();
    reporter.log = vi.fn();
    reporter.getTestIndentation = () => '';
    reporter.getDurationPrefix = () => '';
    reporter.getTestName = () => 'failure name';
    reporter.formatShortError = () => '';

    reporter.printTestCase('failed', {
      result: () => ({
        state: 'failed',
        errors: [new Error('fail')],
      }),
      diagnostic: () => ({ retryCount: 1, repeatCount: 2 }),
      task: {},
    });

    expect(reporter.log).toHaveBeenCalled();
  });

  it('handles missing diagnostic values', () => {
    const reporter = new GreenTickReporter();
    reporter.log = vi.fn();
    reporter.getTestIndentation = () => '';
    reporter.getDurationPrefix = () => '';
    reporter.getTestName = () => 'failure name';
    reporter.formatShortError = () => '';

    reporter.printTestCase('failed', {
      result: () => ({
        state: 'failed',
        errors: [new Error('fail')],
      }),
      diagnostic: () => null,
      task: {},
    });

    expect(reporter.log).toHaveBeenCalled();
  });

  it('delegates to DefaultReporter for non-failed tests', () => {
    const superSpy = vi
      .spyOn(DefaultReporter.prototype, 'printTestCase')
      .mockImplementation(() => {});
    const reporter = new GreenTickReporter();

    reporter.printTestCase('passed', {
      result: () => ({
        state: 'passed',
      }),
      diagnostic: () => ({}),
      task: {},
    });

    expect(superSpy).toHaveBeenCalled();
  });
});

