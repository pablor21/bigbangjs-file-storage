/* eslint-disable no-undef */
import { IBucket } from '../buckets';
import { CopyDirectoryOptions, MoveDirectoryOptions, StorageResponse } from '../types';
import { FileEntryMeta, IFileEntry } from './file.interface';
import p from 'path';

export abstract class AbstractFile<MetaType extends FileEntryMeta = FileEntryMeta> implements IFileEntry {

    public name: string;
    public path: string;

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
            result = await this.bucket.deleteDirectory(this.getAbsolutePath());
        }
        this.meta.exists = false;
        return result;
    }

    // abstract methods

}
