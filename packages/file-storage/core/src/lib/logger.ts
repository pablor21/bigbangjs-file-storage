/* eslint-disable no-console */

import c from 'ansi-colors';
import { LoggerType } from '../types';

export const ConsoleLogger: LoggerType = {
    warn: (message: string, ...args): void => {
        console.log(c.yellow(message), ...args);
    },
    error: (message: string, ...args): void => {
        console.log(c.red(message), ...args);
    },
    info: (message: string, ...args): void => {
        console.log(c.cyan(message), ...args);
    },
    debug: (message: string, ...args): void => {
        console.log(c.gray(message), ...args);
    },
};
