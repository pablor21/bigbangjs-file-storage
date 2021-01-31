import { IStorageProvider } from './provider.interface';
import { IBucket } from './bucket.interface';
import { IFileInfo } from './fileinfo.interface';
import { CreateDirectoryOptions, MoveDirectoryOptions, CopyDirectoryOptions } from './types';
import { canRead, canWrite } from './utils';

export class Bucket implements IBucket {

    public readonly name: string;
    public readonly config: any;
    public readonly provider: IStorageProvider;

    constructor(provider: IStorageProvider, name: string, config?: any) {
        this.config = config;
        this.name = name;
        this.provider = provider;
    }

    public canRead(): boolean {
        return canRead(this.config.mode);
    }

    public canWrite(): boolean {
        return canWrite(this.config.mode);
    }

    public async makeDirectory(dir: string, options?: CreateDirectoryOptions): Promise<boolean | IFileInfo> {
        return this.provider.makeDirectory(this, dir, options);
    }

    public async deleteDirectory(dir: string): Promise<boolean> {
        return this.provider.deleteDirectory(this, dir);
    }

    public async emptyDirectory(dir: string): Promise<boolean> {
        return this.provider.emptyDirectory(this, dir);
    }

    public async moveDirectory(src: string, dest: string, options?: MoveDirectoryOptions): Promise<boolean | IFileInfo> {
        return this.provider.moveDirectory(this, src, dest, options);
    }

    public async copyDirectory(src: string, dest: string, options?: CopyDirectoryOptions): Promise<boolean | IFileInfo> {
        return this.provider.copyDirectory(this, src, dest, options);
    }

}
