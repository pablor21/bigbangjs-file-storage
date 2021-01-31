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
