import { IBucket } from './buckets';
import { StorageEventType } from './eventnames';
import { StorageException, StorageExceptionType } from './exceptions';
import { IFile } from './files';
import { objectNull, Registry, resolveMime, stringNullOrEmpty, DefaultMatcher, IMatcher, slug } from './lib';
import { IStorageProvider, ProviderConfigOptions, StorageProviderClassType } from './providers';
import { AddProviderOptions, FileStorageConfigOptions, LoggerType, ResolveUriReturn, StorageResponse } from './types';


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
            throw new StorageException(StorageExceptionType.NOT_FOUND, `The provider type "${name}" has not been registered yet!`, { type: name });
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
        if (objectNull(config)) {
            throw new StorageException(StorageExceptionType.INVALID_PARAMS, `Invalid configuration options!`, { options: config });
        }

        if (config.uri) {
            const parsedUrl = new URL(config.uri);
            config.type = config.type || parsedUrl.protocol.replace(':', '');
            config.autoInit = config.autoInit || parsedUrl.searchParams.get('autoInit') === '1' || parsedUrl.searchParams.get('autoInit') === 'true' || this.config.autoInitProviders;
        }

        if (stringNullOrEmpty(config.type) || stringNullOrEmpty(name)) {
            throw new StorageException(StorageExceptionType.INVALID_PARAMS, `Invalid configuration options!`, { options: config });
        }

        if (this.getProvider(name)) {
            if (!options?.replace) {
                throw new StorageException(StorageExceptionType.DUPLICATED_ELEMENT, `The provider "${name}" already exists!`, { name });
            }
            await this.disposeProvider(name);
        }

        const providerClass = FileStorage.getProviderType(config.type!);
        if (!providerClass) {
            throw new StorageException(StorageExceptionType.INVALID_PARAMS, `The provider type "${config.type}" has not been registered yet!`, { options: config });
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
            throw new StorageException(StorageExceptionType.UNKNOWN_ERORR, ex.message, ex);
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
     * Obtains the bucket name based on the configured strategy
     * @param name the bucket name
     * @param provider the provider session
     */
    public async resolveBucketAlias(name: string, provider: IStorageProvider): Promise<string> {
        if (this.config.bucketAliasStrategy === 'NAME') {
            return name;
        } else if (this.config.bucketAliasStrategy === 'PROVIDER:NAME') {
            return `${provider.name}:${name}`;
        }
        return await this.config.bucketAliasStrategy(name, provider);
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
            throw new StorageException(StorageExceptionType.INVALID_PARAMS, `You must provide the bucket name or add the default bucket name in the config options!`);
        }
        return this.buckets.get(name);
    }

    /**
     * Generate a uri for a file or directory
     * @param provider the provider
     * @param bucket the bucket
     * @param fileName the filename
     */
    public makeFileUri(provider: IStorageProvider | string, bucket: IBucket | string, fileName?: string | IFile) {
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
            if (typeof (fileName) === 'string') {
                url += fileName;
            } else {
                url += fileName.getAbsolutePath();
            }
        }
        return url;
    }


    /**
     * Returns a file  from it's uri
     * @param uri the file or directory uri
     */
    public async getFile<T extends IFile = IFile>(uri: string): Promise<StorageResponse<IFile>> {
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
    public resolveFileUri(uri: string): ResolveUriReturn | false {
        try {
            const parsedUrl = new URL(uri);
            if (parsedUrl) {
                const providerName = parsedUrl.protocol.replace(':', '');
                const provider = this.getProvider(providerName);
                if (objectNull(provider)) {
                    return false;
                }
                const bucketName = parsedUrl.host;
                const bucket = this.getBucket(bucketName);
                if (objectNull(bucket)) {
                    return false;
                }
                const path = parsedUrl.pathname;
                return {
                    provider,
                    bucket,
                    path,
                };
            }
            return false;
        } catch (ex) {
            return false;
        }
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


    public async getPublicUrl(fileUri: string | IFile, options?: any): Promise<string> {
        if (typeof (this.config.urlGenerator) === 'function') {
            if (typeof (fileUri) !== 'string') {
                fileUri = this.makeFileUri(fileUri.bucket.provider, fileUri.bucket, fileUri.getAbsolutePath());
            }
            return this.config.urlGenerator(fileUri, options);
        }
        return undefined;
    }

    public async getSignedUrl(fileUri: string | IFile, options?: any): Promise<string> {
        if (typeof (this.config.signedUrlGenerator) === 'function') {
            if (typeof (fileUri) !== 'string') {
                fileUri = this.makeFileUri(fileUri.bucket.provider, fileUri.bucket, fileUri.getAbsolutePath());
            }
            return this.config.signedUrlGenerator(fileUri, options);
        }
        return undefined;
    }

    protected createProviderInstance(ctor: StorageProviderClassType<IStorageProvider>, name: string, config: any): IStorageProvider {
        return new ctor(this, name, config);
    }

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


}
