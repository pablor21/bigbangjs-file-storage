import { IBucket } from '../buckets';
import { StorageResponse, Streams, GetFileOptions, MoveFileOptions, CopyFileOptions } from '../types';
import { IFile, IFileMeta } from './file.interface';
import p from 'path';


export class File implements IFile {

    protected contents: string | Buffer | Streams.Readable;
    public name: string;
    public path: string;
    public uri: string;

    constructor(public readonly bucket: IBucket, public readonly meta?: IFileMeta) {
        this.name = meta?.name;
        this.path = meta?.path;
    }

    public getAbsolutePath() {
        return p.join(this.path, this.name);
    }

    public async delete(): Promise<StorageResponse<boolean>> {
        const result = this.bucket.deleteFile(this);
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

    public async save(): Promise<StorageResponse<File>> {
        return this.bucket.putFile(this, this.contents, { returning: true });
    }

    public async move(dest: string | IFile, options?: MoveFileOptions): Promise<StorageResponse<File>> {
        options = options || {};
        options.returning = true;
        return this.bucket.moveFile(this, dest, options);
    }

    public async copy(dest: string | IFile, options?: CopyFileOptions): Promise<StorageResponse<File>> {
        options = options || {};
        options.returning = true;
        return this.bucket.copyFile(this, dest, options);
    }

    public setContents(contents: string | Buffer | Streams.Readable): void {
        this.contents = contents;
    }

    public async getContents(options?: GetFileOptions): Promise<Buffer> {
        return (await this.bucket.getFileContents(this, options)).result;
    }

    public async getStream(options?: GetFileOptions): Promise<Streams.Readable> {
        return (await this.bucket.getFileStream(this, options)).result;
    }

}
