// export enum ValLattice {
//     Object,
//     NoObject,
// };

export interface StorageObject {
    location: string
    // value: ValLattice.Object,
}

// interface StorageNoObject {
//     value: ValLattice.NoObject,
// };

export type StorageValue = StorageObject | {};

export class StorageFactory {
    static StoObject(location: string): StorageObject {
        return {
            location
            // value: ValLattice.Object
        };
    }

    // static StoNoObject(): StorageNoObject {
    //     return { value: ValLattice.NoObject };
    // }
    static isStorageObject(sto: StorageValue): boolean {
        return Object.keys(sto).includes("location");
    }

    static includes(s: StorageObject, mergedLocs: StorageValue[]): boolean {
        const sameLoc = mergedLocs
            .filter(ms => StorageFactory.isStorageObject(ms))
            .map(ms => ms as StorageObject)
            .filter(ms => ms.location === s.location);
        return sameLoc && sameLoc.length > 0;
    }
}
