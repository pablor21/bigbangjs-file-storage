import { IFileEntry } from './files';
import { IStorageProvider } from './providers';
import { IMatcher } from './lib';

export type ClassType<T> = new (...args: any[]) => T;

export type Pattern = string | RegExp;

type ListOptions = {
    /**
     * Recursive? list subdirectories
     */
    recursive?: boolean;

    /**
     * Return a IFileEntry or just the names?
     */
    returning?: boolean;

    /**
     * Max results to return
     */
    maxResults?: number;
    /**
     * Skip first x results
     */
    skip?: number;
    /**
      * Pattern (regex or glob format) that the files and subdirectories must match to be returning
      */
    pattern?: Pattern;
    /**
     * Function to apply on every src entry should return true if should be returning or false otherwise
     */
    filter?: (name: string, path: string, type: 'DIRECTORY' | 'FILE') => boolean | Promise<boolean>;

    /**
     * Options passed to the native driver (for example, in aws this should be the continuation token)
     */
    nativeOptions?: any;
};

export type DirectoryListOptions = ListOptions & {
};

export type FileListOptions = ListOptions & {
};

export type FileEntryListOptions = ListOptions & {
    /**
     * Type of entries to be returning
     */
    type: 'DIRECTORY' | 'FILE' | 'BOTH';
};


/**
 * This type encapsulates the operations to the storage methods
 */
export type StorageResponse<ResponseType = any, NativeResponseType = any> = {
    /**
    * The result
    */
    result: ResponseType;
    /**
     * The native response obtained from the provider (ie: aws)
     */
    nativeResponse: NativeResponseType;
};

export type ListResult<EntriesType extends IFileEntry[] | string[]> = {
    entries: EntriesType[];
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
    filter?: ((src: string, dest: string) => boolean) | ((src: string, dest: string) => Promise<boolean>);
};

export type GetFileOptions = {
    start?: number;
    end?: number;
};


export type FileStorageConfigOptions = {
    /**
     * The default permissions mode for the buckets
     */
    defaultBucketMode: string;
    /**
     * Naming strategy for the buckets in the global registry
     */
    bucketAliasStrategy: 'NAME' | 'PROVIDER:NAME' | ((name: string, provider: IStorageProvider) => string | Promise<string>);
    /**
     * Auto init providers? This will make to call init() on the provider when it's added to the storage
     */
    autoInitProviders: boolean;
    /**
     * Default bucket name
     */
    defaultBucketName?: string;
    /**
     * Return instances of file/directory by default? (can be overriden by the get/list/create methods config)
     */
    returningByDefault?: boolean;

    /**
     * Function to obtain a mime type based on the fileName
     */
    mimeFn?: (fileName: string) => string | Promise<string>;

    /**
     * Function to obtain a regex based on glob pattern
     */
    matcherType?: new () => IMatcher;

    /**
     * Logger class
     */
    logger?: LoggerType | boolean;
};

export type LoggerType = {
    warn: (...args: any) => void;
    error: (...args: any) => void;
    info: (...args: any) => void;
    debug: (...args: any) => void;
};

export type AddProviderOptions = {
    replace?: boolean;
};

export type DeleteDirectoryOptions = {
    /**
     * Pattern to match subdirs
     */
    pattern?: Pattern;
    /**
     * Function to apply on every src entry must return true if should be delete or false otherwise
     */
    filter?: (name: string, path: string, type: 'DIRECTORY' | 'FILE') => boolean | Promise<boolean>;
};

export type DeleteFileOptions = {
    /**
     * Pattern to match subdirs
     */
    pattern?: Pattern;
    /**
     * Function to apply on every src entry must return true if should be delete or false otherwise
     */
    filter?: (name: string, path: string, type: 'DIRECTORY' | 'FILE') => boolean | Promise<boolean>;
};

// Stream implementation
import stream = require('readable-stream');
export { stream as Streams };
