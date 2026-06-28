import { beforeEach, describe, expect, it, vi } from 'vitest';

const fsMocks = vi.hoisted(() => ({
  existsSync: vi.fn(),
  copyFileSync: vi.fn(),
}));

const execSyncMock = vi.hoisted(() => vi.fn());

vi.mock('fs', () => ({
  default: fsMocks,
  ...fsMocks,
}));

vi.mock('child_process', () => ({
  execSync: execSyncMock,
}));

const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

beforeEach(() => {
  vi.clearAllMocks();
  fsMocks.existsSync.mockReturnValue(true);
  fsMocks.copyFileSync.mockImplementation(() => {});
  execSyncMock.mockImplementation(() => {});
});

describe('setup script helpers', () => {
  it('createEnvFile returns early when env exists', async () => {
    const { createEnvFile } = await import('../scripts/setup.js');
    fsMocks.existsSync.mockReturnValue(true);

    createEnvFile();
    expect(fsMocks.copyFileSync).not.toHaveBeenCalled();
  });

  it('createEnvFile returns early when example is missing', async () => {
    const { createEnvFile } = await import('../scripts/setup.js');
    fsMocks.existsSync.mockImplementation((path) => path === '.env');

    createEnvFile();
    expect(fsMocks.copyFileSync).not.toHaveBeenCalled();
  });

  it('createEnvFile copies when example exists', async () => {
    const { createEnvFile } = await import('../scripts/setup.js');
    fsMocks.existsSync.mockImplementation((path) => path === '.env.example');

    createEnvFile();
    expect(fsMocks.copyFileSync).toHaveBeenCalledWith('.env.example', '.env');
  });

  it('createEnvFile logs on copy error', async () => {
    const { createEnvFile } = await import('../scripts/setup.js');
    fsMocks.existsSync.mockImplementation((path) => path === '.env.example');
    fsMocks.copyFileSync.mockImplementation(() => {
      throw new Error('no perms');
    });

    createEnvFile();
    expect(errorSpy).toHaveBeenCalled();
  });

  it('downloadZkFiles runs the download script', async () => {
    const { downloadZkFiles } = await import('../scripts/setup.js');
    downloadZkFiles();

    expect(execSyncMock).toHaveBeenCalledWith('npm run download-zk-files', {
      stdio: 'inherit',
    });
  });

  it('downloadZkFiles logs on error', async () => {
    const { downloadZkFiles } = await import('../scripts/setup.js');
    execSyncMock.mockImplementation(() => {
      throw new Error('fail');
    });

    downloadZkFiles();
    expect(errorSpy).toHaveBeenCalled();
  });

  it('checkDependencies returns true on success', async () => {
    const { checkDependencies } = await import('../scripts/setup.js');
    expect(checkDependencies()).toBe(true);
  });

  it('checkDependencies returns false on error', async () => {
    const { checkDependencies } = await import('../scripts/setup.js');
    execSyncMock.mockImplementation(() => {
      throw new Error('fail');
    });

    expect(checkDependencies()).toBe(false);
  });

  it('installDependencies executes npm install', async () => {
    const { installDependencies } = await import('../scripts/setup.js');
    installDependencies();
    expect(execSyncMock).toHaveBeenCalledWith('npm install', {
      stdio: 'inherit',
    });
  });

  it('installDependencies logs on error', async () => {
    const { installDependencies } = await import('../scripts/setup.js');
    execSyncMock.mockImplementation(() => {
      throw new Error('fail');
    });

    installDependencies();
    expect(errorSpy).toHaveBeenCalled();
  });

  it('validateSetup returns true when all checks pass', async () => {
    const { validateSetup } = await import('../scripts/setup.js');
    fsMocks.existsSync.mockReturnValue(true);
    expect(validateSetup()).toBe(true);
  });

  it('validateSetup returns false when checks fail', async () => {
    const { validateSetup } = await import('../scripts/setup.js');
    fsMocks.existsSync.mockImplementation((path) => path !== 'tests');
    expect(validateSetup()).toBe(false);
  });

  it('setup runs the full flow', async () => {
    const { setup } = await import('../scripts/setup.js');
    fsMocks.existsSync.mockReturnValue(true);
    execSyncMock.mockImplementation(() => {});

    await setup();
    expect(logSpy).toHaveBeenCalled();
  });
});

