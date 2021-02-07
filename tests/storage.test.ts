import { FileStorage, LoggerType } from '../packages/file-storage/core/src';
import { FilesystemProvider } from '../packages/file-storage/filesystem/src';
import { S3Provider } from '../packages/file-storage/s3/src';
import path from 'path';

FileStorage.registerProviderType('s3', S3Provider);
FileStorage.registerProviderType('fs', FilesystemProvider);

describe('Storage tests', () => {

    test('Core tests', async () => {
        const storage = new FileStorage({
            logger: true,
        });

        expect(storage).toBeInstanceOf(FileStorage);
        expect(FileStorage.getProviderType('s3')).toBe(S3Provider);
        expect(FileStorage.getProviderType('fs')).toBe(FilesystemProvider);

        expect(storage.slug('test 1')).toBe('test-1');
        expect(storage.normalizePath('test/1/3A')).toBe('/test/1/3a');
        expect(await storage.getMime('x.txt')).toBe('text/plain');

        // unregister provider
        FileStorage.unregisterProviderType('fs');
        expect(() => FileStorage.getProviderType('fs')).toThrowError('The provider type "fs" has not been registered yet!');

        // register the provider
        FileStorage.registerProviderType('fs', FilesystemProvider);

        // logger
        storage.log('info', 'Test info log');
        expect(storage.getLoger()).toBe(console);
        storage.config.logger = console;
        expect(storage.getLoger()).toBe(console);
        storage.config.logger = false;
        expect(storage.getLoger()).toBe(undefined);

        // add invalid provider name
        expect(await (async () => await storage.addProvider('#invalid', {}))).rejects.toThrow(Error);
    });
});
