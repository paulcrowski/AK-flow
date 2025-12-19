import { SYSTEM_CONFIG } from '../config/systemConfig';

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

type Logger = {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  isEnabled: (level: Exclude<LogLevel, 'silent'>) => boolean;
};

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100
};

function getMinLevel(): LogLevel {
  return SYSTEM_CONFIG.mainFeatures.DEBUG_MODE ? 'debug' : 'info';
}

export function createLogger(channel: string): Logger {
  const prefix = `[${channel}]`;

  const isEnabled = (level: Exclude<LogLevel, 'silent'>): boolean => {
    return LEVEL_RANK[level] >= LEVEL_RANK[getMinLevel()];
  };

  const debug = (...args: unknown[]) => {
    if (!isEnabled('debug')) return;
    console.debug(prefix, ...args);
  };

  const info = (...args: unknown[]) => {
    if (!isEnabled('info')) return;
    console.log(prefix, ...args);
  };

  const warn = (...args: unknown[]) => {
    if (!isEnabled('warn')) return;
    console.warn(prefix, ...args);
  };

  const error = (...args: unknown[]) => {
    if (!isEnabled('error')) return;
    console.error(prefix, ...args);
  };

  return { debug, info, warn, error, isEnabled };
}

export function shouldLogDopamineTick(): boolean {
  return Boolean(SYSTEM_CONFIG.telemetry?.logDopamineTick);
}
