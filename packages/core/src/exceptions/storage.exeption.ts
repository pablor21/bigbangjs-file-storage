export enum StorageExceptionType {
    UNKNOWN_ERROR = 'E_UNKNOWN',
    NATIVE_ERROR = 'E_NATIVE',
    DUPLICATED_ELEMENT = 'E_DUPLICATED_ELEMENT',
    NOT_FOUND = 'E_NOT_FOUND',
    INVALID_PARAMS = 'E_INVALID_PARAMS',
    PERMISSION_ERROR = 'E_PERMISSION'
}


export function constructError(message: string, name: StorageExceptionType = StorageExceptionType.UNKNOWN_ERROR, data?: any): Error {
    const err = new Error(message);
    // eslint-disable-next-line dot-notation
    err['details'] = data || {};
    // eslint-disable-next-line dot-notation
    err.name = name;
    // eslint-disable-next-line dot-notation
    err['code'] = err['details'].code || name;
    return err;
}

export function throwError(message: string, name: StorageExceptionType = StorageExceptionType.UNKNOWN_ERROR, data?: any): Error {
    throw constructError(message, name, data);
}

// export class StorageException extends Error implements Error {

//     name: string;
//     stack?: string;
//     code?: string | number;
//     type: StorageExceptionType = StorageExceptionType.UNKNOWN_ERROR;
//     data: any = {};

//     constructor(type: StorageExceptionType = StorageExceptionType.UNKNOWN_ERROR, message?: string, data?: any) {
//         super(message);
//         this.name = StorageException.prototype.name;
//         this.type = type;
//         this.code = data?.code || type;
//         Object.assign(this.data, data || {});
//         // Object.setPrototypeOf(this, StorageException.prototype);

//         // restore prototype chain
//         const prototype = new.target.prototype;

//         if (Object.setPrototypeOf) {
//             Object.setPrototypeOf(this, prototype);
//         } else {
//             // eslint-disable-next-line dot-notation
//             this['__proto__'] = prototype;
//         }
//     }

// }
