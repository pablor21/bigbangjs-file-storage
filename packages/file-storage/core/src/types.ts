
export type ClassType<T> = new (...args: any[]) => T;

export type ListOptions = {
    type: 'DIRECTORY' | 'FILE' | 'BOTH';
    recursive?: boolean;
};

export type CreateFileOptions = {
    /**
     * Should return a FileInfo?
     */
    returning?: boolean;
    /**
     * Permissions
     */
    permissions?: string | number;
    /**
     * Overwrite if exist or throw an error?
     */
    overwrite?: boolean;
};

export type CreateDirectoryOptions = {
    /**
     * Should return a FileInfo?
     */
    returning?: boolean;
    /**
     * Permissions
     */
    permissions?: string | number;
};

export type MoveDirectoryOptions = {
    /**
     * Should return a FileInfo?
     */
    returning?: boolean;
    /**
     * Overwrite if exist or throw an error?
     */
    overwrite?: boolean;
};

export type CopyDirectoryOptions = {
    /**
     * Should return a FileInfo?
     */
    returning?: boolean;
    /**
     * Permissions
     */
    permissions?: string | number;
    /**
     * Overwrite if exist or throw an error?
     */
    overwrite?: boolean;
    /**
     * Function to apply on every src entry should return true if should be copied or false otherwise
     */
    filter?: (src: string, dest: string) => boolean | Promise<boolean>;
};

export type CreateBucketOptions = {
    mode?: string;
};

export type GetFileOptions = {
    start?: number;
    end?: number;
};
