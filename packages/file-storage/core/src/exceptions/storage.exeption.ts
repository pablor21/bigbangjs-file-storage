export enum StorageExceptionType {
    UNKNOWN_ERORR = 'UNKNOWN_ERROR',
    DUPLICATED_ELEMENT = 'DUPLICATED_ELEMENT',
    NOT_FOUND = 'NOT_FOUND',
}

export class StorageException extends Error implements Error {

    name: string;
    stack?: string;
    type: StorageExceptionType = StorageExceptionType.UNKNOWN_ERORR;
    data: any = {};

    constructor(type: StorageExceptionType = StorageExceptionType.UNKNOWN_ERORR, message?: string, data?: any) {
        super(message);
        this.name = StorageException.prototype.name;
        this.type = type;
        Object.assign(this.data, data || {});
        Object.setPrototypeOf(this, StorageException.prototype);
    }

}
