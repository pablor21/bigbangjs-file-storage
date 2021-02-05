/* eslint-disable no-undef */
import { IBucket } from '../buckets';
import { CopyDirectoryOptions, CopyFileOptions, MoveDirectoryOptions, StorageResponse } from '../types';
import { FileEntryMeta, IFile, IFileEntry } from './file.interface';
import p from 'path';

export abstract class AbstractFile<MetaType extends FileEntryMeta = FileEntryMeta> implements IFileEntry {

    public name: string;
    public path: string;
    public uri: string;

    constructor(public readonly bucket: IBucket, public readonly meta?: MetaType) {
        this.name = meta?.name;
        this.path = meta?.path;
    }

    public getType(): 'DIRECTORY' | 'FILE' {
        return this.meta.type;
    }

    public getAbsolutePath() {
        return p.join(this.path, this.name);
    }

    public async delete(): Promise<StorageResponse<boolean>> {
        let result;
        if (this.getType() === 'DIRECTORY') {
            result = await this.bucket.delete(this.getAbsolutePath());
        }
        this.meta.exists = false;
        return result;
    }

    public getStorageUri(): string {
        return this.bucket.getStorageUri(this);
    }

    public async getPublicUrl(options?: any): Promise<string> {
        return this.bucket.getPublicUrl(this, options);
    }

    public async getSignedUrl(options?: any): Promise<string> {
        return this.bucket.getSignedUrl(this, options);
    }

    // abstract methods
    public abstract save(): Promise<StorageResponse<IFileEntry>>;
    public abstract copy(dest: string | IFile, options?: CopyDirectoryOptions | CopyFileOptions): Promise<StorageResponse<IFileEntry>>;
    public abstract move(dest: string | IFile, options?: CopyFileOptions | MoveDirectoryOptions): Promise<StorageResponse<IFileEntry>>;

}
