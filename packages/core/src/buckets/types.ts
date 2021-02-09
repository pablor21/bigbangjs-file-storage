export type BucketConfigOptions = {
    uri?: string;
    providerName?: string;
    mode?: string | number;
    name?: string;
    autoCleanup?: boolean;
    defaultSignedUrlExpiration?: number;
};
