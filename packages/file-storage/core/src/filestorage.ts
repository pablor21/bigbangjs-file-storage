import { StorageProviderClassType, IStorageProvider } from './provider.interface';
import { IBucket } from './bucket.interface';
import { Registry } from './registry';
import { StorageException, StorageExceptionType } from './exceptions';
import { BUCKET_ADDED, BUCKET_DESTROYED, BUCKET_REMOVED } from './eventnames';


export class FileStorage {

    public static providerTypes: Map<string, StorageProviderClassType<IStorageProvider>> = new Map();
    public providers: Registry<string, IStorageProvider> = new Registry();
    public buckets: Registry<string, IBucket> = new Registry();

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
     * @param type the type of the provider (provider)
     * @param name the name of the provider (it will be used on the protocol for the url based buckets)
     * @param config the config options
     * @param replace replace existing or trhow an error if already exists?
     */
    public async addProviderSession(type: string, name: string, config: any, replace = false): Promise<IStorageProvider> {

        if (this.getProvider(name)) {
            if (!replace) {
                throw new StorageException(StorageExceptionType.DUPLICATED_ELEMENT, `The provider "${name}" already exists!`, { name });
            }
            await this.removeProviderSession(name);
        }

        const providerClass = FileStorage.getProviderType(type);
        if (!providerClass) {
            throw new StorageException(StorageExceptionType.NOT_FOUND, `The provider type "${type}" has not been registered yet!`, { type });
        }
        config = config || {};
        if (typeof (config) !== 'string') {
            config.name = name;
        }
        const provider = this.createProviderInstance(providerClass, config);
        try {
            await provider.init();
        } catch (ex) {
            throw new StorageException(StorageExceptionType.UNKNOWN_ERORR, ex.message, ex);
        }
        this.addListenersToProvider(provider);
        this.providers.add(name, provider);
        return provider;
    }

    /**
     * Add an provider instance to the storage session (uri config based)
     * @param uri the uri
     * @param replace replace existing or trhow an error if already exists?
     */
    public async addProviderSessionFromUri(uri: string, replace = false): Promise<IStorageProvider> {
        const parsedUrl = new URL(uri);
        let name = 'default';
        if (parsedUrl.searchParams.has('name')) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            name = parsedUrl.searchParams.get('name')!;
        }
        const providerType = parsedUrl.protocol.replace(':', '');
        return await this.addProviderSession(providerType, name, uri, replace);
    }

    /**
     * Obtains an provider
     * @param name the name of the provider
     */
    public getProvider(name: string): IStorageProvider | undefined {
        return this.providers.get(name);
    }

    /**
     * Removes the provider from the registry
     * @param name the name
     */
    public async removeProviderSession(name: string): Promise<void> {
        const adaper = this.getProvider(name);
        if (adaper) {
            const buckets = await adaper.listBuckets();
            buckets.map(b => this.buckets.remove(b.name));
            await adaper.dispose();
            this.providers.remove(name);
        }
    }

    protected createProviderInstance(ctor: StorageProviderClassType<IStorageProvider>, config: any): IStorageProvider {
        return new ctor(this, config);
    }

    protected addListenersToProvider(provider: IStorageProvider) {
        provider.on(BUCKET_ADDED, (bucket: IBucket) => {
            this.buckets.add(bucket.name, bucket);
        });
        provider.on(BUCKET_REMOVED, (bucket: IBucket) => {
            this.buckets.remove(bucket.name);
        });
        provider.on(BUCKET_DESTROYED, (bucket: IBucket) => {
            this.buckets.remove(bucket.name);
        });
    }

}
