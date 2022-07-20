export enum ValLattice {
    Object,
    NoObject,
    MaybeObject,
    Unknown,
};

export interface StorageObject {
    location: string,
    value: ValLattice.Object,
};

export interface StorageMaybeObject {
    value: ValLattice.MaybeObject,
    susObj: string,
    susProp: string,
};

interface StorageUnknown {
    value: ValLattice.Unknown,
};

interface StorageNoObject {
    value: ValLattice.NoObject,
};

export type StorageValue = StorageObject | StorageNoObject | StorageMaybeObject | StorageUnknown;

export class StorageFactory {
    static StoObject(location: string): StorageObject {
        return { location, value: ValLattice.Object };
    }

    static StoNoObject(): StorageNoObject {
        return { value: ValLattice.NoObject };
    }

    static StoMaybeObject(susObj: string, susProp: string): StorageMaybeObject {
        return {
            value: ValLattice.MaybeObject,
            susObj,
            susProp,
        };
    }

    static StoUnknown(): StorageUnknown {
        return { value: ValLattice.Unknown };
    }

    static isStorageObject(sto: StorageValue): boolean {
        return sto.value === ValLattice.Object;
    }

    static isMaybeObject(sto: StorageValue): boolean {
        return sto.value === ValLattice.MaybeObject;
    }
}