import { Bucket, Directory, ListResult } from '@bigbangjs/file-storage';
import fs from 'fs-extra';
import { generateBuckets, rootPath } from '../functions';


export const directories002 = (autoRemove=true) => describe('Siute 002', () => {

    if (autoRemove) {
        beforeAll(async () => {
            fs.removeSync(rootPath)
        });
        afterAll(async () => {
            fs.removeSync(rootPath)
        });
    }


    test('Manipulate directories', async () => {
        const storage = (await generateBuckets('test02'));
        const bucket01 = storage.getBucket('bucket01');
        expect(bucket01).toBeInstanceOf(Bucket);

        // create a directory
        const dir = (await bucket01.makeDirectory<Directory>('test_01', { returning: true })).result;
        const exists = (await bucket01.directoryExists('test_01')).result;
        expect(exists).toBe(true);
        expect(dir).toBeInstanceOf(Directory);
        expect(dir.meta.path).toBe('/');
        expect(dir.meta.name).toBe('test_01');
        expect(dir.meta.exists).toBe(true);
        //delete the directory
        await dir.delete();
        expect(dir.meta.exists).toBe(false);

        //create directory object
        const directoryObject = new Directory(bucket01);
        directoryObject.name = 'test_directory';
        directoryObject.path = "/test_02";
        expect((await bucket01.directoryExists(directoryObject)).result).toBe(false);
        await directoryObject.save();
        expect((await bucket01.directoryExists(directoryObject)).result).toBe(true);

        // // copy directory
        const copyOfDirectoryObject = (await directoryObject.copy('/test_02_copy')).result;
        expect((await bucket01.directoryExists(directoryObject)).result).toBe(true);
        expect((await bucket01.directoryExists(copyOfDirectoryObject)).result).toBe(true);
        expect((copyOfDirectoryObject.name)).toBe('test_02_copy');

        let directories = (await bucket01.listDirectories<ListResult<Directory[]>>('', { recursive: true })).result;
        expect(directories.entries).toHaveLength(3);

        directories = (await bucket01.listDirectories<ListResult<Directory[]>>('', { recursive: false })).result;
        expect(directories.entries).toHaveLength(2);


        // move directory
        await directoryObject.move('/test_02_moved');
        expect((await bucket01.directoryExists(directoryObject)).result).toBe(true);
        expect((directoryObject.name)).toBe('test_02_moved');
        expect((await bucket01.directoryExists('/test_02')).result).toBe(true);

        //create subdirectory
        const subdirectory = (await dir.makeDirectory('/subdirectory_01')).result;
        expect((await bucket01.directoryExists(subdirectory)).result).toBe(true);

        //list directories
        directories = (await bucket01.listDirectories<ListResult<Directory[]>>('', {
            recursive: true,
            filter: (src, parent, type) => {
                return true;
            }
        })).result;
        expect(directories.entries).toHaveLength(5);

        // delete directory
        await directoryObject.delete();
        expect((await bucket01.directoryExists(directoryObject)).result).toBe(false);

        // list directories
        directories = (await bucket01.listDirectories<ListResult<Directory[]>>('/', {
            pattern: '/*',
            recursive: true,
            filter: (src, parent, type) => {
                return true;
            }
        })).result;
        expect(directories.entries).toHaveLength(3);

        (await dir.makeDirectory('/subdirectory_02/subdirectory_02_01'));
        // delete directories by pattern
        expect((await bucket01.delete('/test_01', {
            pattern: '/*/subdirectory_*_01'
        })).result).toBe(true);

        // list directories
        directories = (await bucket01.listDirectories<ListResult<Directory[]>>('/', { recursive: true })).result;
        expect(directories.entries).toHaveLength(5);

    })
});