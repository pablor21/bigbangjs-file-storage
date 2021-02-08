import { BucketConfigOptions, ProviderConfigOptions } from "@bigbangjs/file-storage";

export type FileSystemNativeResponse = {

}


export type FileSystemBucketConfig = {
    root: string;
} & BucketConfigOptions;


export type FileSystemProviderConfig = {
    root?: string;
} & ProviderConfigOptions;
