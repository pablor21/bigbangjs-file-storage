import path from 'path';
import { Bucket, StorageFile, FileStorage } from '@bigbangjs/file-storage';
import https from 'https';
import fs from 'fs';
import { S3Provider, S3ProviderConfig } from '../src';

describe('S3 tests', () => {
    const credentialsFile = path.join(__dirname, 'credentials.json');
    const rootConfig = JSON.parse(fs.readFileSync(credentialsFile).toString());
    const clearBuckets = true;
    test('Storage operations', async () => {
        FileStorage.registerProviderType('s3', S3Provider);
        expect(rootConfig).toBeTruthy();
        const storage = new FileStorage({
            logger: false,
        });

        const urlProviderConfig02: S3ProviderConfig = {
            uri: `s3://us-east-2/?keyFile=${credentialsFile}`
        };
        const provider01 = (await storage.addProvider('provider01', urlProviderConfig02)).result;
        expect(provider01).toBeInstanceOf(S3Provider);
        expect(storage.getProvider('provider01')).toBe(provider01);

        // add the buckets
        await Promise.all(rootConfig.buckets.map(async (b: any) => {
            expect((await provider01.addBucket(b.name, b)).result).toBeInstanceOf(Bucket);
        }));

        const bucket01 = provider01.getBucket('bucket01');
        const bucket02 = provider01.getBucket('bucket02');
        const bucket03 = provider01.getBucket('bucket03');

        // delete the buckets
        if (clearBuckets) {
            await bucket01.empty();
            await bucket02.empty();
            await bucket03.empty();

        }

        // BEGIN COMMON TESTS

        expect((await bucket03.removeEmptyDirectories()).result).toBeTruthy();

        // check can read/ can write
        expect(bucket01.canRead()).toBeTruthy();
        expect(bucket01.canWrite()).toBeTruthy();


        // put files
        const file01 = (await bucket01.putFile('file   01.txt', 'Test 01')).result;
        expect(file01).toBe('provider01://bucket01/file-01.txt');
        let res: any = (await bucket01.getFile('file-01.txt'));
        expect(res.result.getStorageUri()).toBe(file01);
        res = (await bucket01.getFile('file-01.txt'));
        expect(res.result.getPublicUrl()).toBeTruthy();
        res = (await bucket01.getFile('file-01.txt'));
        expect(res.result.getSignedUrl()).toBeTruthy();

        // check native path
        expect(bucket01.getNativePath(file01)).toBe('file-01.txt');

        const f = (await bucket01.fileExists(file01, true)).result;
        expect(f).toBeInstanceOf(StorageFile);
        const file02 = (await bucket02.putFile('file02.txt', 'Test 02', { returning: true })).result;
        expect(file02).toBeInstanceOf(StorageFile);
        res = (await bucket02.fileExists(file02));
        expect(res.result).toBe(true);

        const p = new Promise(resolve => {
            https.get('https://kitsu.io/api/edge/anime', async response => {
                const fileFromStream = (await bucket01.putFile('file 03.json', response, { returning: true })).result;
                resolve(fileFromStream);
            });
        });
        res = await p;
        expect(res).toBeInstanceOf(StorageFile);

        // copy between buckets
        const file03 = (await bucket01.copyFile('file-01.txt', 'provider01://bucket02/copy of bucket 01/', { returning: true })).result;
        expect(file03).toBeInstanceOf(StorageFile);

        const file04 = (await bucket01.copyFile('file-01.txt', 'provider01://bucket02/file-01-copy-from-bucket01.txt', { returning: true })).result;
        expect(file04).toBeInstanceOf(StorageFile);
        expect(file04.getNativePath()).toBe(path.join(file04.getAbsolutePath()));

        // move between buckets
        const file05 = (await bucket02.moveFile(file02, 'provider01://bucket01/subdir 01/file moved.txt', { returning: true })).result;
        expect(file05).toBeInstanceOf(StorageFile);
        res = (await bucket02.fileExists(file02));
        expect(res.result).toBeFalsy();

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
        expect(bucket02Filelist.entries).toHaveLength(2);

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


    })

});