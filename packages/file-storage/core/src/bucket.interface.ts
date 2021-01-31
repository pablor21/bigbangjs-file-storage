import { IStorageProvider } from './provider.interface';
import { IStorageMethods } from './storagemethods.interface';

export type BucketClassType<T extends IBucket> = new (provider: IStorageProvider, name: string, config?: any) => T;

export interface IBucket extends IStorageMethods {
    name: string;
    config: any;
    provider: IStorageProvider;

    canRead(): boolean;
    canWrite(): boolean;

    /**
     * This method is called on bucket instantiation and should contain the code needed for
     * the bucket initialization (ex: create the root dir)
     */
    // init(): Promise<void>;
    /**
     * Destroys the bucket and deletes from the adaper (ex: delete the root dir)
     */
    // destroy(): Promise<void>;
}
