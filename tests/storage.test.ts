import { Bucket, ConsoleLogger, FileStorage, LoggerType } from '../packages/file-storage/core/src';
import { FilesystemProvider, FileSystemProviderConfig } from '../packages/file-storage/filesystem/src';
import { S3Provider, S3ProviderConfig } from '../packages/file-storage/s3/src';
import path from 'path';
import fs from 'fs';

FileStorage.registerProviderType('s3', S3Provider);
FileStorage.registerProviderType('fs', FilesystemProvider);


const rootPath = path.resolve(__dirname, '../private/tests/');
const s3CredentialsFile = path.join(__dirname, '../packages/file-storage/s3/tests/credentials.json');
const s3RootConfig = JSON.parse(fs.readFileSync(s3CredentialsFile).toString());

describe('Storage tests', () => {


    beforeAll(() => {
        if (fs.existsSync(rootPath)) {
            fs.rmSync(rootPath, { recursive: true });
        }
    })
    afterAll(() => {
        // if (fs.existsSync(rootPath)) {
        //     fs.rmSync(rootPath, { recursive: true });
        // }
    })


    test('Core tests', async () => {
        const storage = new FileStorage({
            logger: true,
        
        });

        expect(storage).toBeInstanceOf(FileStorage);
        expect(FileStorage.getProviderType('s3')).toBe(S3Provider);
        expect(FileStorage.getProviderType('fs')).toBe(FilesystemProvider);

        expect(storage.slug('test 1')).toBe('test-1');
        expect(storage.normalizePath('test/1/3A')).toBe('test/1/3a');
        expect(await storage.getMime('x.txt')).toBe('text/plain');

        // unregister provider
        FileStorage.unregisterProviderType('fs');
        expect(() => FileStorage.getProviderType('fs')).toThrowError('The provider type "fs" has not been registered yet!');

        // register the provider
        FileStorage.registerProviderType('fs', FilesystemProvider);

        // logger
        storage.log('info', 'Test info log');
        storage.log('warn', 'Test warn log');
        storage.log('debug', 'Test debug log');
        storage.log('error', 'Test error log');
        expect(storage.getLoger()).toBe(ConsoleLogger);
        storage.config.logger = console;
        expect(storage.getLoger()).toBe(console);
        storage.config.logger = false;
        expect(storage.getLoger()).toBe(undefined);

        // add invalid provider name
        expect(await (async () => await storage.addProvider('#invalid', {}))).rejects.toThrow(Error);


        // CROSS PROVIDERS TEST
        // provider config
        const objProviderConfig01: FileSystemProviderConfig = {
            root: path.join(rootPath, 'provider01'),
            type: 'fs',
        };
        const urlProviderConfig01 = `fs://${rootPath}/provider02?mode=0777`;

        await storage.addProvider('provider01', objProviderConfig01);
        await storage.addProvider('provider02', {
            uri: urlProviderConfig01,
        });
        const provider01 = storage.getProvider('provider01');
        expect(provider01).toBeInstanceOf(FilesystemProvider);

        const bucket01 = (await provider01.addBucket('bucket01', {
            root: 'bucket01',
        })).result;
        expect(bucket01).toBeInstanceOf(Bucket);

        const bucket02 = (await provider01.addBucket('bucket02', {
            root: 'bucket02',
        })).result;
        expect(bucket02).toBeInstanceOf(Bucket);

        const urlProviderConfig02: S3ProviderConfig = {
            uri: `s3://us-east-2/?keyFile=${s3CredentialsFile}`
        };
        const provider02 = (await storage.addProvider('provider03', urlProviderConfig02)).result;
        expect((await provider02.addBucket("bucket03",s3RootConfig.buckets[2])).result).toBeInstanceOf(Bucket)
        const bucket03 = provider02.getBucket("bucket03");
        expect(bucket03).toBeInstanceOf(Bucket);

        const file01 = (await bucket01.putFile('test01.txt', 'Hello world from Earth!')).result;
        expect(file01).toBeTruthy();
        const file02 = (await bucket01.putFile('test02.txt', 'Hello world from Mars!')).result;
        expect(file02).toBeTruthy();

        const copy = await storage.copyFile(file01, bucket03.getStorageUri('cross-copy.txt'));
        expect(copy).toBeTruthy();

        const copy2 = await storage.copyFiles(bucket01.getStorageUri('/'), bucket03.getStorageUri('multiple copy/'), '**');
        expect(copy2).toBeTruthy();

        const moved = await storage.moveFile(file01, bucket03.getStorageUri('cross-move.txt'));
        expect(moved).toBeTruthy();

        const moved2 = await storage.moveFiles(bucket01.getStorageUri('/'), bucket03.getStorageUri('cross-move/'), '**');
        expect(moved2).toBeTruthy();

    });
});
