import { Bucket, ConsoleLogger, FileStorage, LoggerType } from '../packages/core/src';
import { FilesystemProvider, FileSystemProviderConfig } from '../packages/filesystem/src';
import { S3Provider, S3ProviderConfig } from '../packages/s3/src';
import path from 'path';
import fs from 'fs';

FileStorage.registerProviderType('s3', S3Provider);
FileStorage.registerProviderType('fs', FilesystemProvider);


const rootPath = path.resolve(__dirname, '../private/tests/');
const s3CredentialsFile = path.join(__dirname, '../packages/s3/tests/credentials.json');
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
            bucketAliasStrategy: "PROVIDER:NAME"
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
        expect(await (async () => await storage.addProvider({
            name: '#invalid'
        }))).rejects.toThrow(Error);

        // add a provider of type fs using url
        const provider01 = (await storage.addProvider(`fs://${rootPath}/provider_01?name=provider01`)).result;
        expect(provider01).toBeInstanceOf(FilesystemProvider);
        expect(provider01.name).toBe('provider01');

        // add provider of type fs using config object
        const provider02 = (await storage.addProvider({
            name: 'provider02',
            type: 'fs',
            root: `${rootPath}/provider_02`,
            mode: '0777',
            autoCleanup: true,
        })).result;
        expect(provider02).toBeInstanceOf(FilesystemProvider);
        expect(provider01.name).toBe('provider01');

        // CROSS PROVIDERS TEST
        // provider config
        const bucket01 = (await provider01.addBucket({
            root: 'bucket01',
            name: 'bucket01'
        })).result;
        expect(bucket01).toBeInstanceOf(Bucket);

        const bucket02 = (await provider01.addBucket('provider01://bucket02?name=bucket02')).result;
        expect(bucket02).toBeInstanceOf(Bucket);

        const urlProviderConfig02: S3ProviderConfig = {
            uri: `s3://${s3CredentialsFile}`,
            name: 'provider03',
        };
        const provider03 = (await storage.addProvider(urlProviderConfig02)).result;
        const bucket03 = provider03.getBucket("bucket03");
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
