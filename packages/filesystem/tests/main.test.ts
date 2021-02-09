
import { FilesystemProvider, FileSystemProviderConfig } from '../src';
import path from 'path';
import { Bucket, StorageFile, FileStorage } from '@bigbangjs/file-storage';
import https from 'https';
import fs from 'fs';

describe('Filesystem tests', () => {
    const rootPath = path.resolve(__dirname, '../private/tests/');

    beforeAll(() => {
        if (fs.existsSync(rootPath)) {
            fs.rmSync(rootPath, { recursive: true });
        }
    })
    afterAll(() => {
        if (fs.existsSync(rootPath)) {
            //fs.rmSync(rootPath, { recursive: true });
        }
    })

    FileStorage.registerProviderType('fs', FilesystemProvider);

    test('Storage operations', async () => {
        const storage = new FileStorage({
            //logger: false,
        });

        // provider config
        const objProviderConfig01: FileSystemProviderConfig = {
            root: path.join(rootPath, 'provider01'),
            name: 'provider01',
            type: 'fs',
            buckets: [
                {
                    name: 'bucket04',
                    root: 'bucket04',
                },
                {
                    uri: 'provider01://bucket05?name=bucket05'
                },
                'provider01://bucket06?name=bucket06'
            ],
        };
        const urlProviderConfig01 = `fs://${rootPath}/provider02?name=provider02&mode=0777`;

        await storage.addProvider(objProviderConfig01);
        await storage.addProvider(urlProviderConfig01);
        const provider01 = storage.getProvider('provider01');
        expect(provider01).toBeInstanceOf(FilesystemProvider);

        const bucket01 = (await provider01.addBucket({
            name: 'bucket01',
            root: 'bucket01',
        })).result;
        expect(bucket01).toBeInstanceOf(Bucket);

        const bucket02 = (await provider01.addBucket({
            name: 'bucket02',
            root: 'bucket02',
        })).result;
        expect(bucket02).toBeInstanceOf(Bucket);


        const bucket03 = (await storage.addBucket('provider01://bucket03?name=bucket03')).result;
        expect(bucket03).toBeInstanceOf(Bucket);

        expect((await bucket03.removeEmptyDirectories()).result).toBeTruthy();

        // check can read/ can write
        expect(bucket01.canRead()).toBeTruthy();
        expect(bucket01.canWrite()).toBeTruthy();


        // put files
        const file01 = (await bucket01.putFile('file   01.txt', 'Test 01')).result;
        expect(file01).toBe('provider01://bucket01/file-01.txt');
        expect((await bucket01.getFile('file-01.txt')).result.getStorageUri()).toBe(file01);
        expect((await bucket01.getFile('file-01.txt')).result.getPublicUrl()).toBeTruthy();
        expect((await bucket01.getFile('file-01.txt')).result.getSignedUrl()).toBeTruthy();

        // check native path
        expect(bucket01.getNativePath(file01)).toBe(path.join(bucket01.provider.config.root, bucket01.config.root, 'file-01.txt'));


        expect((await bucket01.fileExists(file01, true)).result).toBeInstanceOf(StorageFile);
        const file02 = (await bucket02.putFile('file02.txt', 'Test 02', { returning: true })).result;
        expect(file02).toBeInstanceOf(StorageFile);
        expect((await bucket02.fileExists(file02)).result).toBe(true);

        const p = new Promise(resolve => {
            https.get('https://kitsu.io/api/edge/anime', async response => {
                const fileFromStream = (await bucket01.putFile('file 03.json', response, { returning: true })).result;
                resolve(fileFromStream);
            });
        });

        expect(await p).toBeInstanceOf(StorageFile);

        // copy between buckets
        const file03 = (await bucket01.copyFile('file-01.txt', 'provider01://bucket02/copy of bucket 01/', { returning: true })).result;
        expect(file03).toBeInstanceOf(StorageFile);

        const file04 = (await bucket01.copyFile('file-01.txt', 'provider01://bucket02/file-01-copy-from-bucket01.txt', { returning: true })).result;
        expect(file04).toBeInstanceOf(StorageFile);
        expect(file04.getNativePath()).toBe(path.join(file04.bucket.provider.config.root, file04.bucket.config.root, file04.getAbsolutePath()));

        // move between buckets
        const file05 = (await bucket02.moveFile(file02, 'provider01://bucket01/subdir 01/file moved.txt', { returning: true })).result;
        expect(file05).toBeInstanceOf(StorageFile);
        expect((await bucket02.fileExists(file02)).result).toBeFalsy();

        // list files
        let bucket01Filelist = (await bucket01.listFiles()).result;
        expect(bucket01Filelist.entries).toHaveLength(2);


        bucket01Filelist = (await bucket01.listFiles('', { recursive: true })).result;
        expect(bucket01Filelist.entries).toHaveLength(3);

        bucket01Filelist = (await bucket01.listFiles('subdir-01', { recursive: true })).result;
        expect(bucket01Filelist.entries).toHaveLength(1);

        bucket01Filelist = (await bucket01.listFiles('/', { recursive: true, pattern: 'subdir*/**/*.txt', returning: true })).result;
        expect(bucket01Filelist.entries).toHaveLength(1);

        bucket01Filelist = (await bucket01.listFiles('  ', { recursive: true, pattern: 'subdir*/**/*.txt', returning: true })).result;
        expect(bucket01Filelist.entries).toHaveLength(1);
        expect((await bucket01Filelist.entries[0].getContents()).result.toString()).toBe('Test 02');
        expect((await bucket01Filelist.entries[0].getStream()).result).toBeTruthy();

        const bucket02Filelist = (await bucket02.listFiles()).result;
        expect(bucket02Filelist.entries).toHaveLength(1);

        // copy multiple files
        const multipleCopy = (await bucket01.copyFiles('/', 'provider01://bucket02/multiplecopy/', '**')).result;
        expect(multipleCopy).toHaveLength(3);
        await Promise.all(multipleCopy.map(async f => {
            expect((await bucket02.fileExists(f)).result).toBe(true);
        }));
        expect((await bucket02.listFiles('/', { recursive: true })).result.entries).toHaveLength(5);
        expect((await bucket01.listFiles('/', { recursive: true })).result.entries).toHaveLength(3);

        // move multiple files
        const multipelMove = (await bucket02.moveFiles('/multiplecopy/', 'provider01://bucket02/moved/', '**')).result;
        expect(multipelMove).toHaveLength(3);
        await Promise.all(multipelMove.map(async f => {
            expect((await bucket02.fileExists(f)).result).toBe(true);
        }));

        expect((await bucket02.deleteFile('file-01.txt')).result).toBe(true);
        expect((await bucket02.listFiles('/', { recursive: true })).result.entries).toHaveLength(5);

        expect((await bucket02.deleteFiles('/', '**/subdir-01/*.txt')).result).toBe(true);
        expect((await bucket02.listFiles('/', { recursive: true })).result.entries).toHaveLength(4);

        // destory a bucket
        expect((await bucket03.destroy()).result).toBeTruthy();
        expect((await bucket02.remove()).result).toBeTruthy();


    });
});
