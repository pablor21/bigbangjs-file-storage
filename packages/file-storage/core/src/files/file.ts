import { StorageResponse, MoveDirectoryOptions, CopyDirectoryOptions } from '../types';
import { AbstractFile } from './abstract.file';
import { IFile, IFileEntry } from './file.interface';


export class File extends AbstractFile implements IFile {

    save(): Promise<StorageResponse<IFile>> {
        throw new Error('Method not implemented.');
    }

    move(dest: string | IFile, options?: MoveDirectoryOptions): Promise<StorageResponse<IFile>> {
        throw new Error('Method not implemented.');
    }

    copy<RType extends boolean | IFile = IFile>(dest: string | IFile, options?: CopyDirectoryOptions): Promise<StorageResponse<RType>> {
        throw new Error('Method not implemented.');
    }


}
