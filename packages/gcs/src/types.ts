import { BucketConfigOptions, ProviderConfigOptions } from "@bigbangjs/file-storage";
import { StorageOptions as GCSStorageOptions } from '@google-cloud/storage';


export type GCSNativeResponse = {

}

export type GCSBucketConfig = {
    bucketName: string;
    tryCreate?: boolean;
    useNativeUrlGenerator?: boolean;
} & BucketConfigOptions;


export type GCSProviderConfig = {
    useNativeUrlGenerator?: boolean;
    tryCreateBuckets?: boolean;
} & ProviderConfigOptions & GCSStorageOptions;
