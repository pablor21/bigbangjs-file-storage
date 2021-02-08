import { Bucket, IBucket } from "@bigbangjs/file-storage";
import { FilesystemProvider } from "./filesystem.provider";
import { FileSystemBucketConfig, FileSystemNativeResponse } from "./types";

export class FilesystemBucket extends Bucket<FileSystemBucketConfig, FileSystemNativeResponse> implements IBucket<FileSystemBucketConfig, FileSystemNativeResponse> {
    public readonly root: string;
    constructor(provider: FilesystemProvider, name: string, absoluteName: string, config: FileSystemBucketConfig) {
        super(provider, name, absoluteName, config);
        this.root = this.config.root;
    }
}