import { IBucket } from './buckets';
import { VALID_PROVIDER_NAMES_REGEX } from './constants';
import { StorageEventType } from './eventnames';
import { constructError, StorageExceptionType, throwError } from './exceptions';
import { IStorageFile } from './files';
import { objectNull, Registry, resolveMime, stringNullOrEmpty, DefaultMatcher, IMatcher, slug, castValue } from './lib';
import { IStorageProvider, ProviderConfigOptions, StorageProviderClassType } from './providers';
import { AddProviderOptions, CopyFileOptions, CopyManyFilesOptions, FileStorageConfigOptions, LoggerType, MoveFileOptions, MoveManyFilesOptions, Pattern, ResolveUriReturn, SignedUrlOptions, StorageResponse } from './types';
import path from 'path';

const defaultConfigOptions: FileStorageConfigOptions = {
    defaultBucketMode: '0777',
    bucketAliasStrategy: 'NAME',
    autoInitProviders: true,
    autoCleanup: true,
    defaultBucketName: null,
    returningByDefault: false,
    mimeFn: resolveMime,
    slugFn: slug,
    matcherType: DefaultMatcher,
    defaultSignedUrlExpiration: 3600,
    logger: console,
};

export class FileStorage {

    public readonly config: FileStorageConfigOptions;
    public static providerTypes: Map<string, StorageProviderClassType<IStorageProvider>> = new Map();
    public providers: Registry<string, IStorageProvider> = new Registry();
    public buckets: Registry<string, IBucket> = new Registry();
    public matcher: IMatcher;

    constructor(config?: Partial<FileStorageConfigOptions>) {
        this.config = Object.assign({}, defaultConfigOptions, config || {});
        if (this.config.matcherType) {
            this.matcher = new this.config.matcherType();
        }
        this.log('info', `FileStorage initialized!`);
    }

    public getLoger(): LoggerType {
        if (typeof (this.config.logger) === 'boolean') {
            return this.config.logger === true ? defaultConfigOptions.logger as LoggerType : undefined;
        }
        return this.config.logger as LoggerType;
    }

    public log(level: 'info' | 'debug' | 'warn' | 'error', ...args: any) {
        if (this.getLoger() && this.getLoger()[level]) {
            this.getLoger()[level](...args);
        }
    }

    /**
     * Registers an provider type
     * @param name the name of the provider
     * @param provider the provider type
     */
    public static registerProviderType(name: string, provider: StorageProviderClassType<IStorageProvider>) {
        if (!provider || !name.match(VALID_PROVIDER_NAMES_REGEX)) {
            throwError(`Invalid provider type`, StorageExceptionType.INVALID_PARAMS, { name, provider });
        }
        FileStorage.providerTypes.set(name, provider);
    }

    /**
     * Removes an provider type
     * @param name the name of the provider type
     */
    public static unregisterProviderType(name: string) {
        FileStorage.providerTypes.delete(name);
    }

    /**
     * Gets an provider type class
     * @param name the name of the provider
     */
    public static getProviderType(name: string): StorageProviderClassType<IStorageProvider> {
        if (!FileStorage.providerTypes.has(name)) {
            throw constructError(`The provider type "${name}" has not been registered yet!`, StorageExceptionType.NOT_FOUND, { type: name });
        }
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return FileStorage.providerTypes.get(name)!;
    }

    // provider methods

    /**
     * Add an provider instance to the storage session (config object based)
     * @param name the name of the provider (it will be used on the protocol for the url based buckets)
     * @param config the config options
     * @param options the creation options
     */
    public async addProvider(name: string, config: ProviderConfigOptions, options: AddProviderOptions = { replace: false }): Promise<StorageResponse<IStorageProvider>> {
        if (objectNull(config) || !name.match(VALID_PROVIDER_NAMES_REGEX)) {
            throw constructError(`Invalid configuration options!`, StorageExceptionType.INVALID_PARAMS, { options: config });
        }

        if (config.uri) {
            const parsedUrl = new URL(config.uri);
            config.type = config.type || parsedUrl.protocol.replace(':', '');
            config.autoInit = config.autoInit || castValue<boolean>(parsedUrl.searchParams.get('autoInit'), 'boolean', this.config.autoInitProviders);
        }

        if (stringNullOrEmpty(config.type) || stringNullOrEmpty(name)) {
            throwError(`Invalid configuration options!`, StorageExceptionType.INVALID_PARAMS, { options: config });
        }

        if (this.getProvider(name)) {
            if (!options?.replace) {
                throwError(`The provider "${name}" already exists!`, StorageExceptionType.DUPLICATED_ELEMENT, { name });
            }
            await this.disposeProvider(name);
        }

        const providerClass = FileStorage.getProviderType(config.type!);
        if (!providerClass) {
            throwError(`The provider type "${config.type}" has not been registered yet!`, StorageExceptionType.INVALID_PARAMS, { options: config });
        }
        const provider = this.createProviderInstance(providerClass, name, config);

        if (config.autoInit === false && this.config.autoInitProviders === false) {
            this.addListenersToProvider(provider);
            this.providers.add(name!, provider);
            return { result: provider, nativeResponse: {} };
        }
        try {
            const response = await provider.init();
            this.addListenersToProvider(provider);
            this.providers.add(name!, provider);
            return { result: provider, nativeResponse: response };
        } catch (ex) {
            throwError(ex.message, StorageExceptionType.UNKNOWN_ERROR, ex);
        }
    }


    /**
     * Obtains an provider
     * @param name the name of the provider
     */
    public getProvider(name: string): IStorageProvider | undefined {
        return this.providers.get(name);
    }

    /**
     * Removes the provider from the registry and calls the dispose method on the provider
     * @param name the name
     */
    public async disposeProvider(name: string): Promise<StorageResponse<boolean>> {
        const adaper = this.getProvider(name);
        if (adaper) {
            const buckets = (await adaper.listBuckets()).result;
            buckets.map(b => this.buckets.remove(b.name));
            const respone = await adaper.dispose();
            this.providers.remove(name);
            return { result: true, nativeResponse: respone };
        }
        return { result: true, nativeResponse: {} };
    }

    /**
     * Copy a file between buckets
     * @param src the file entry or full uri path
     * @param dest the destination file entry or full uri path
     * @param options the copy options
     * @returns The file object if returning is true, the file uri otherwhise
     */
    public async copyFile<RType extends IStorageFile | string = IStorageFile, NativeResponseType = any>(src: string | IStorageFile, dest: string | IStorageFile, options?: CopyFileOptions): Promise<StorageResponse<RType, NativeResponseType>> {
        try {
            const srcAbsPath = this.resolveFileUri(src);
            const destAbsPath = this.resolveFileUri(dest);
            if (!srcAbsPath || !destAbsPath) {
                throw constructError(`Invalid source or target path`, StorageExceptionType.INVALID_PARAMS);
            }
            const sourceStream = (await srcAbsPath.bucket.getFileStream(src)).result;
            const result = (await destAbsPath.bucket.putFile(dest, sourceStream, options));
            return result as StorageResponse<RType, NativeResponseType>;
        } catch (ex) {
            this.parseException(ex);
        }
    }

    /**
     * Copy many files by pattern
     * @param src the full uri base path
     * @param dest the destination path
     * @param pattern the pattern (glob or regex)
     * @param options the copy options
     * @returns The file object if returning is true, the file uri otherwhise
     */
    public async copyFiles<RType extends IStorageFile[] | string[] = IStorageFile[], NativeResponseType = any>(src: string, dest: string, pattern: Pattern, options?: CopyManyFilesOptions): Promise<StorageResponse<RType, NativeResponseType>> {
        try {
            const srcAbsPath = this.resolveFileUri(this.getFilenameFromFile(src));
            const destAbsPath = this.resolveFileUri(this.getFilenameFromFile(dest));

            if (!srcAbsPath || !destAbsPath) {
                throw constructError(`Invalid source or target path`, StorageExceptionType.INVALID_PARAMS);
            }
            const toCopy = await srcAbsPath.bucket.listFiles(srcAbsPath.path, { pattern, returning: false, recursive: true, filter: options?.filter });
            const promises: any[] = [];
            const destPath = destAbsPath.path;
            const srcPath = srcAbsPath.path;

            toCopy.result.entries.map(c => {
                promises.push(async () => {
                    const f = (this.resolveFileUri(this.getFilenameFromFile(c)) as ResolveUriReturn).path;
                    const sourceStream = (await srcAbsPath.bucket.getFileStream(f)).result;
                    const result = (await destAbsPath.bucket.putFile(this.normalizePath(path.join(destPath, f.replace(srcPath, ''))), sourceStream, options)).result;
                    return result;
                });
            });
            const result = await Promise.all(promises.map(async f => await f()));
            return result as unknown as StorageResponse<RType, NativeResponseType>;
        } catch (ex) {
            this.parseException(ex);
        }
    }

    public getNativePath(path: string | IStorageFile): string {
        const parts = this.resolveFileUri(path);
        if (!parts) {
            return;
        }
        return parts.provider.getNativePath(parts.bucket, parts.path);
    }

    /**
     * Move a file
     * @param src the file entry or full uri path
     * @param dest the destination file entry or full uri path
     * @param options the move options
     * @returns The file object if returning is true, the file uri otherwhise
     */
    public async moveFile<RType extends IStorageFile | string = IStorageFile, NativeResponseType = any>(src: string | IStorageFile, dest: string | IStorageFile, options?: MoveFileOptions): Promise<StorageResponse<RType, NativeResponseType>> {
        try {
            const srcAbsPath = this.resolveFileUri(this.getFilenameFromFile(src));
            const destAbsPath = this.resolveFileUri(this.getFilenameFromFile(dest));
            if (!srcAbsPath || !destAbsPath) {
                throw constructError(`Invalid source or target path`, StorageExceptionType.INVALID_PARAMS);
            }
            const sourceStream = (await srcAbsPath.bucket.getFileStream(src)).result;
            const result = (await destAbsPath.bucket.putFile(dest, sourceStream, options));
            if (result.result) {
                await (srcAbsPath.bucket.deleteFile(src, options));
            }
            return result as StorageResponse<RType, NativeResponseType>;
        } catch (ex) {
            this.parseException(ex);
        }
    }

    /**
     * Normalize a path
     * @param dir 
     */
    public normalizePath(dir?: string): string {
        if (!dir) {
            return '';
        }
        dir.replace(/\\/g, '/').replace(/ +/g, ' ');
        let result = '';
        const parts = dir.split('/');
        if (parts.length > 0) {
            parts.map(d => {
                if (d !== '/' && !stringNullOrEmpty(d)) {
                    result += '/' + this.slug(d);
                }
            });
        } else {
            result += '/' + this.slug(dir);
        }
        // if (stringNullOrEmpty(result)) {
        //     result = '/';
        // }
        result = path.normalize(result).replace(/\\/g, '/').toLowerCase();
        if (result === '.') {
            result = '';
        }
        return result;
    }


    /**
     * Move many files by pattern
     * @param src the full uri base path
     * @param dest the full uri destination path
     * @param pattern the pattern (glob or regex)
     * @param options the copy options
     * @returns The file object if returning is true, the file uri otherwhise
     */
    public async moveFiles<RType extends IStorageFile[] | string[] = IStorageFile[], NativeResponseType = any>(src: string, dest: string, pattern: Pattern, options?: MoveManyFilesOptions): Promise<StorageResponse<RType, NativeResponseType>> {
        throw new Error('Not implemented');
    }

    /**
     * Obtains the bucket name based on the configured strategy
     * @param name the bucket name
     * @param provider the provider session
     */
    public makeBucketAlias(name: string, provider: IStorageProvider): string {
        if (this.config.bucketAliasStrategy === 'NAME') {
            return name;
        } else if (this.config.bucketAliasStrategy === 'PROVIDER:NAME') {
            return `${provider.name}:${name}`;
        }
        return this.config.bucketAliasStrategy(name, provider);
    }


    /**
     * Gets a registered bucket
     * @param name the bucket name (or default if the name is not provider)
     */
    public getBucket(name?: string): IBucket {
        if (!name) {
            name = this.config.defaultBucketName;
        }
        if (stringNullOrEmpty(name)) {
            throwError(`You must provide the bucket name or add the default bucket name in the config options!`, StorageExceptionType.INVALID_PARAMS);
        }
        return this.buckets.get(name);
    }

    /**
     * Generate a uri for a file or directory
     * @param provider the provider
     * @param bucket the bucket
     * @param fileName the filename
     */
    public makeFileUri(provider: IStorageProvider | string, bucket: IBucket | string, fileName?: string | IStorageFile) {
        let url = '';
        if (typeof (provider) === 'string') {
            provider = this.getProvider(provider);
        }
        url += provider.name + '://';

        if (typeof (bucket) === 'string') {
            bucket = provider.getBucket(bucket);
        }
        url += bucket.name;

        if (fileName) {
            let fName = '';
            if (typeof (fileName) === 'string') {
                fName = fileName;
            } else {
                fName = fileName.getAbsolutePath();
            }
            if (fName.indexOf('/') !== 0) {
                fName = '/' + fName;
            }

            fName.split('/').map(d => {
                if (d !== '/' && !stringNullOrEmpty(d)) {
                    url += '/' + this.slug(d);
                }
            });
        }
        return url;
    }


    /**
     * Returns a file  from it's uri
     * @param uri the file or directory uri
     */
    public async getFile<T extends IStorageFile = IStorageFile>(uri: string): Promise<StorageResponse<IStorageFile>> {
        const parameters = this.resolveFileUri(uri);
        if (parameters) {
            return parameters.bucket.getFile<T>(uri);
        }
        return undefined;
    }


    /**
     * Given a file/directory uri, gets the provider, bucket and path
     * @param uri the uri
     */
    public resolveFileUri(uri: string | IStorageFile): ResolveUriReturn | false {

        uri = this.getFilenameFromFile(uri);

        const partsRegexp = /(?<protocol>[a-zA-Z0-9]+):\/\/(?<bucket>[a-zA-Z0-9\:]+)\/?(?<folder>.+)/;
        const parts = uri.match(partsRegexp);
        if (parts && parts.length > 0) {
            const providerName = parts.groups.protocol.replace(':', '');
            const provider = this.getProvider(providerName);
            if (objectNull(provider)) {
                throw constructError(`Provider ${providerName} not found`, StorageExceptionType.NOT_FOUND);
            }
            const bucketName = parts.groups.bucket;
            const bucket = provider.getBucket(bucketName);
            if (objectNull(bucket)) {
                throw constructError(`Bucket not found in the provider ${providerName}`, StorageExceptionType.NOT_FOUND);
            }
            const path = decodeURI(parts.groups.folder);
            return {
                provider,
                bucket,
                path: this.normalizePath(path),
            };
        }
        return false;
    }

    /**
     * Make a slug from a filename
     * @param input the filename
     * @param replacement replacement character
     */
    public slug(input: string, replacement = '-') {
        if (typeof (this.config.slugFn) === 'function') {
            return this.config.slugFn(input, replacement);
        }
        return input;
    }

    /**
     * Get the mime of a file
     * @param fileName the filename
     */
    public async getMime(fileName: string): Promise<string> {
        if (typeof (this.config.mimeFn) === 'function') {
            return this.config.mimeFn(fileName);
        }
        return 'unknown';
    }

    /**
     * Check if a path matches a pattern
     * @param path the path
     * @param pattern the pattern string (Glob) or regexp
     */
    public matches(path: string | string[], pattern: string | RegExp): boolean | string[] {
        if (pattern instanceof RegExp) {
            if (Array.isArray(path)) {
                return path.filter(n => n.match(pattern));
            }
            return path.match(pattern);
        }
        if (this.matcher?.available) {
            const ret = this.matcher.match(path, (pattern as string));
            return ret;
        }
        return true;
    }


    /**
     * Creates a public url for a file
     * @param fileUri the file uri
     * @param options options passed to the function
     */
    public async getPublicUrl(fileUri: string | IStorageFile, options?: any): Promise<string> {
        if (typeof (this.config.urlGenerator) === 'function') {
            if (typeof (fileUri) !== 'string') {
                fileUri = this.makeFileUri(fileUri.bucket.provider, fileUri.bucket, fileUri.getAbsolutePath());
            }
            return this.config.urlGenerator(fileUri, options);
        }
        return undefined;
    }

    /**
     * Creates a signed url for a file
     * @param fileUri the file uri
     * @param options options passed to the function
     */
    public async getSignedUrl(fileUri: string | IStorageFile, options?: SignedUrlOptions): Promise<string> {
        if (typeof (this.config.signedUrlGenerator) === 'function') {
            if (typeof (fileUri) !== 'string') {
                fileUri = this.makeFileUri(fileUri.bucket.provider, fileUri.bucket, fileUri.getAbsolutePath());
            }
            return this.config.signedUrlGenerator(fileUri, options);
        }
        return undefined;
    }

    /**
     * Creates an instance of the provider
     * @param ctor the provider constructor
     * @param name the name of the provider
     * @param config the confi options
     */
    protected createProviderInstance(ctor: StorageProviderClassType<IStorageProvider>, name: string, config: any): IStorageProvider {
        return new ctor(this, name, config);
    }

    /**
     * Add listeners to the provider (remove, add, destroy)
     * @param provider the provider
     */
    protected addListenersToProvider(provider: IStorageProvider) {
        provider.on(StorageEventType.BUCKET_ADDED, (bucket: IBucket) => {
            this.buckets.add(bucket.absoluteName, bucket);
        });
        provider.on(StorageEventType.BUCKET_REMOVED, (bucket: IBucket) => {
            this.buckets.remove(bucket.absoluteName);
        });
        provider.on(StorageEventType.BUCKET_DESTROYED, (bucket: IBucket) => {
            this.buckets.remove(bucket.absoluteName);
        });
    }

    /**
     * Convert an exception to storage exeption
     * @param ex the exeption source
     * @param type the type of the exception
     */
    public parseException(ex: Error, type: StorageExceptionType = StorageExceptionType.NATIVE_ERROR) {
        throw constructError(ex.message, type, ex);
    }

    public getFilenameFromFile(file: string | IStorageFile = '') {
        if (typeof (file) !== 'string') {
            return file.getAbsolutePath();
        }
        return file;
    }

}
