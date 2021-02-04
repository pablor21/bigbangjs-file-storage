export enum StorageExceptionType {
    UNKNOWN_ERORR = 'E_UNKNOWN',
    NATIVE_ERROR = 'E_NATIVE',
    DUPLICATED_ELEMENT = 'E_DUPLICATED_ELEMENT',
    NOT_FOUND = 'E_NOT_FOUND',
    INVALID_PARAMS = 'E_INVALID_PARAMS',
}

export class StorageException extends Error implements Error {

    name: string;
    stack?: string;
    code?: string | number;
    type: StorageExceptionType = StorageExceptionType.UNKNOWN_ERORR;
    data: any = {};

    constructor(type: StorageExceptionType = StorageExceptionType.UNKNOWN_ERORR, message?: string, data?: any) {
        super(message);
        this.name = StorageException.prototype.name;
        this.type = type;
        this.code = data.code;
        Object.assign(this.data, data || {});
        Object.setPrototypeOf(this, StorageException.prototype);
    }

}
