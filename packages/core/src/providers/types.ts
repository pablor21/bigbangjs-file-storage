import { BucketConfigOptions } from '../buckets';

export type ProviderConfigOptions = {
    defaultBucket?: string;
    mode?: string | number;
    autoInit?: boolean;
    uri?: string;
    type?: string;
    name?: string;
    autoCleanup?: boolean;
    defaultSignedUrlExpiration?: number;
    buckets?: (BucketConfigOptions & any | string)[];
};
