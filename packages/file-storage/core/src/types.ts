import { IFile } from './files';
import { IStorageProvider } from './providers';
import { IMatcher } from './lib';
import { IBucket } from './buckets';
export type ClassType<T> = new (...args: any[]) => T;

export type Pattern = string | RegExp;

export type ListFilesOptions = {
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
    filter?: (name: string, path: string) => boolean | Promise<boolean>;
    /**
     * Options passed to the native driver (for example, in aws this should be the continuation token)
     */
    nativeOptions?: any;
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

export type ListResult<EntriesType extends IFile[] | string[]> = {
    entries: EntriesType;
};


export type CreateFileOptions = {
    /**
     * Should return a FileInfo?
     */
    returning?: boolean;
    /**
     * Overwrite if exist or throw an error?
     */
    overwrite?: boolean;
};


export type CopyFileOptions = {
    /**
     * Should return a FileInfo?
     */
    returning?: boolean;
    /**
     * Overwrite if exist or throw an error?
     */
    overwrite?: boolean;
};

export type MoveFileOptions = CopyFileOptions & {
    /**
     * Remove empty directories in the source?
     */
    cleanup?: boolean;
};

export type CopyManyFilesOptions = CopyFileOptions & {
    filter?: ((src: string, dest: string) => boolean) | ((src: string, dest: string) => Promise<boolean>);
};

export type MoveManyFilesOptions = CopyManyFilesOptions & MoveFileOptions;


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
    bucketAliasStrategy: 'NAME' | 'PROVIDER:NAME' | ((name: string, provider: IStorageProvider) => string);
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
     * Slug function
     */
    slugFn?: (input: string, replacement?: string) => string;

    /**
     * File url generator
     */
    urlGenerator?: (uri: string, options?: any) => Promise<string>;

    /**
     * Signed url generator
     */
    signedUrlGenerator?: (uri: string, options?: any) => Promise<string>;

    /**
     * Function to obtain a regex based on glob pattern
     */
    matcherType?: new () => IMatcher;

    /**
     * Logger class
     */
    logger?: LoggerType | boolean;
    /**
     * Auto remove empty directories
     */
    autoCleanup?: boolean;
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

export type DeleteFileOptions = {
    cleanup?: boolean;
};

export type DeleteManyFilesOptions = DeleteFileOptions & {
    /**
     * Pattern to match subdirs
     */
    pattern?: Pattern;
    /**
     * Function to apply on every src entry must return true if should be delete or false otherwise
     */
    filter?: (name: string, path: string) => boolean | Promise<boolean>;
};


export type ResolveUriReturn = {
    provider: IStorageProvider;
    bucket: IBucket;
    path: string;
};

// Stream implementation
import * as stream from 'stream';
export { stream as Streams };
