import { StorageException, StorageExceptionType } from './exceptions';

/**
 * Element registry for fast access with mirroring capacities
 */
export class Registry<K = string, T = string> {

    protected elements: Map<K, T> = new Map();
    protected elementsArray: T[] = [];
    protected mirrors: Registry<any, any>[] = [];


    public addMirror(mirror: Registry) {
        this.mirrors.push(mirror);
    }

    public removeMirror(mirror: Registry) {
        const index = this.mirrors.findIndex(o => o === mirror);
        if (index > -1) {
            delete this.mirrors[index];
        }
    }


    protected getValidMirrors(): Registry<any, any>[] {
        return this.mirrors.filter(o => o);
    }

    /**
     * Adds an element to the registry
     * @param key the element key
     * @param element the element object
     * @param replace should replace existing?
     */
    public add(key: K, element: T, replace = false): Registry<K, T> {
        if (this.has(key) && !replace) {
            throw new StorageException(StorageExceptionType.DUPLICATED_ELEMENT,
                `The element ${key} already exists!`,
                {
                    key,
                });
        }
        this.elements.set(key, element);
        this.elementsArray.push(element);

        this.getValidMirrors().map(m => {
            m.elements.set(key, element);
            m.elementsArray.push(element);
        });

        return this;
    }

    /**
     * Removes an element
     * @param key the element key
     */
    public remove(key: K): Registry<K, T> {
        const element = this.get(key);
        if (element !== undefined && element !== null) {
            const index = this.elementsArray.findIndex(o => o === element);
            if (index > -1) {
                delete this.elementsArray[index];
            }
            this.elements.delete(key);

            this.getValidMirrors().map(m => {
                const index = m.elementsArray.findIndex(o => o === element);
                if (index > -1) {
                    delete m.elements[index];
                }
                m.elements.delete(key);
            });
        }


        return this;
    }

    /**
     * Determines if the registry contains an element with key
     * @param key the element key
     */
    public has(key: K): boolean {
        return this.elements.has(key);
    }

    /**
     * Gets an element from the registry
     * @param key the element key
     */
    public get(key: K): T | undefined {
        return this.elements.get(key);
    }

    /**
     * List all elements
     */
    public list(): T[] {
        return this.elementsArray;
    }

    /**
     * Clears the registry
     */
    public clear() {
        this.elements = new Map();
        this.elementsArray = [];
    }

}
