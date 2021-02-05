import { StorageResponse, MoveDirectoryOptions, CopyDirectoryOptions, Streams, GetFileOptions } from '../types';
import { AbstractFile } from './abstract.file';
import { IFile, IFileEntry } from './file.interface';


export class File extends AbstractFile implements IFile {

    protected contents: string | Buffer | Streams.Readable;

    public async save(): Promise<StorageResponse<File>> {
        return this.bucket.putFile(this, this.contents, { returning: true });
    }

    public async move(dest: string | IFile, options?: MoveDirectoryOptions): Promise<StorageResponse<File>> {
        options = options || {};
        options.returning = true;
        return this.bucket.moveFile(this, dest, options);
    }

    public async copy(dest: string | IFile, options?: CopyDirectoryOptions): Promise<StorageResponse<File>> {
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
