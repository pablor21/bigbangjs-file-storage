import path from 'path';
import { Streams } from '../types';
import { IncomingMessage } from 'http';

/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * Converts an octal number to string notation (0o777)="0777"
 * @param octal the number in octal
 */
export function octalToString(octal: number): string {
    return octal.toString(8);
}

/**
 * Converts an string formatted octal to octal number "0777"=0o77
 * @param str the string to convert
 */
export function stringToOctal(str: string): number {
    return parseInt(str, 8);
}


/**
 * Check if the required permission is true
 * @param requiredPermissions the required permission (1 EXECUTE, 4 READ, 2 WRITE)
 * @param sourcePermissions the source (file) permissions in octal or string notation
 */
export function checkPermission(requiredPermissions: number, sourcePermissions: string | number): boolean {
    if (typeof (sourcePermissions) === 'string') {
        sourcePermissions = parseInt(sourcePermissions, 8);
    }
    /* tslint:disable */
    return !!(requiredPermissions & parseInt((sourcePermissions & parseInt('777', 8)).toString(8)[0]));
}

/**
 * Check if has execution permissions
 * @param sourcePermissions the source (file) permissions in octal or string notation
 */
export function canExecute(sourcePermissions: string | number) {
    return checkPermission(1, sourcePermissions);
}

/**
 * Check if has read permissions
 * @param sourcePermissions the source (file) permissions in octal or string notation
 */
export function canRead(sourcePermissions: string | number) {
    return checkPermission(4, sourcePermissions);
}

/**
 * Check if has write permissions
 * @param sourcePermissions the source (file) permissions in octal or string notation
 */
export function canWrite(sourcePermissions: string | number) {
    return checkPermission(2, sourcePermissions);
}

/**
 * Check if an object or var is null or undefined
 * @param obj the object
 */
export function objectNull(obj?: any): boolean {
    return obj === undefined || obj === null;
}

/**
 * Check if a string is empty or null or undefined
 * @param string the target string
 */
export function stringNullOrEmpty(string?: string): boolean {
    return objectNull(string) || string?.trim() === '';
}

export function resolveMime(fileName: string): string {
    try {
        const mime = require('mime');
        return mime.getType(fileName);
    } catch (e) {
        // pass
    }
    return 'unknown';
}

export function slug(input: string, replacement = '-'): string {
    // try {
    //     const slugify = require('slugify');
    //     return slugify(input, replacement);
    // } catch (e) {
    //     // pass
    // }
    // return input;

    if (stringNullOrEmpty(input)) {
        return input;
    }

    // ref: https://gist.github.com/codeguy/6684588#gistcomment-3426313

    return input.toString()
        .normalize('NFD')                   // split an accented letter in the base letter and the acent
        .replace(/[\u0300-\u036f]/g, '')   // remove all previously split accents
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9._ ]/g, '-')   // remove all chars not letters, numbers and spaces (to be replaced)
        .replace(/\s+/g, replacement)
        .replace(new RegExp(replacement + replacement, 'g'), replacement);
}


export function castValue<T extends number | string | boolean | Record<string, unknown> | (new (...args: any) => T)>(value: any, type: 'number' | 'boolean' | 'object' | 'string' | 'object' | (new (...args: any) => T), defaultValue: T = undefined): T {
    if (objectNull(value)) {
        return defaultValue;
    }
    if (typeof (value) === type) {
        return value;
    }

    switch (type) {
        case 'string':
            return value.toString();
        case 'number':
            return Number(value.toString()) as unknown as T;
        case 'boolean':
            return ((value.toString()) === 'true' || (value.toString()) === '1') as T;
        case 'object':
            return value;
        default:
            return new type(value);
    }
}

export async function streamToBuffer(src: Streams.Readable): Promise<Buffer> {
    const parts: any = [];
    src.on('data', data => parts.push(data));
    return new Promise((resolve, reject) => {
        src.on('end', () => resolve(Buffer.concat(parts)));
        src.on('error', err => reject(err));
    });
}

export function convertToReadStream(src: Buffer | string | Streams.Readable | IncomingMessage): Streams.Readable {
    if (typeof (src) === 'string' || src instanceof Buffer) {
        const readStream = new Streams.Readable();
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        readStream._read = (): void => { };
        readStream.push(src);
        readStream.push(null);
        return readStream;
    }
    return src;
}

export async function writeToStream(src: Streams.Readable, dest: Streams.Writable): Promise<void> {
    return new Promise((resolve, reject) => {
        src
            .pipe(dest)
            .on('error', (err: any) => reject(err))
            .on('finish', resolve);
        dest.on('error', reject);
    });
}

/**
 * Join paths
 * @param paths the paths to join
 */
export function joinPath(...paths: string[]): string {
    return path.join(...paths).replace(/\\/g, '/');
}

/**
 * Join paths to url
 * @param url the url
 * @param parts the parts to join
 */
export function joinUrl(url: string, ...parts: string[]): string {
    return url + '/' + joinPath(...parts);
}
