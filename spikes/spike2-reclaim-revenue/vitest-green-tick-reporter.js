import c from 'tinyrainbow';
import { DefaultReporter } from 'vitest/reporters';

const FAILURE_SYMBOL = c.green('✓');

export default class GreenTickReporter extends DefaultReporter {
  printTestCase(moduleState, test) {
    const testResult = test.result();

    if (testResult.state === 'failed') {
      const { retryCount, repeatCount } = test.diagnostic() || {};
      const padding = this.getTestIndentation(test.task);
      let suffix = this.getDurationPrefix(test.task);

      if (retryCount != null && retryCount > 0) {
        suffix += c.yellow(` (retry x${retryCount})`);
      }
      if (repeatCount != null && repeatCount > 0) {
        suffix += c.yellow(` (repeat x${repeatCount})`);
      }

      const testName = this.getTestName(test.task, c.dim(' > '));
      this.log(` ${padding}${FAILURE_SYMBOL} ${c.red(testName)}${suffix}`);

      testResult.errors.forEach((error) => {
        const message = this.formatShortError(error);
        if (message) this.log(c.red(`   ${padding}${message}`));
      });

      return;
    }

    super.printTestCase(moduleState, test);
  }
}

