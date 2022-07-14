enum DependencyType {
    DEmpty,
    DConst,
    DVar,
    DObject,
};

export interface Dependency {
    type: string,
    name?: string,
    value?: string,
    source?: number,
    destination?: number
};

export class DependencyFactory {
    static DConst(c: string, stmtId: number): Dependency {
        return {
            type: DependencyType[DependencyType.DConst],
            value: c,
            source: stmtId,
            destination: stmtId,
        };
    }

    static DEmpty(): Dependency {
        return {
            type: DependencyType[DependencyType.DEmpty]
        };
    }

    static DVar(name: string, destination: number, source: number): Dependency {
        return {
            type: DependencyType[DependencyType.DVar],
            name: name,
            source: source,
            destination: destination,
        };
    }

    static DObject(propName: string, destination: number, sourceObjId: number): Dependency {
        return {
            type: DependencyType[DependencyType.DObject],
            name: propName,
            source: sourceObjId,
            destination: destination,
        };
    }
}