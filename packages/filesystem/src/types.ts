import { BucketConfigOptions, ProviderConfigOptions } from "@bigbangjs/file-storage";

export type FileSystemNativeResponse = {

}


export type FileSystemBucketConfig = {
    root: string;
} & BucketConfigOptions;


export type FileSystemProviderConfig = {
    root?: string;
    buckets?: (Partial<FileSystemBucketConfig> | string)[];
} & ProviderConfigOptions;
