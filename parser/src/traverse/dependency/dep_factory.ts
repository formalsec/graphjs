enum DependencyType {
    DEmpty,
    DConst,
    DVar,
    DObject,
    DCallee,
};

export interface Dependency {
    type: string,
    name?: string,
    value?: string,
    source?: number,
    destination?: number,
    sourceObjName?: string
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

    static isDVar(dep: Dependency) {
        return dep.type === DependencyType[DependencyType.DVar];
    }

    static DObject(propName: string, destination: number, sourceObjId: number, sourceObjName?: string): Dependency {
        return {
            type: DependencyType[DependencyType.DObject],
            name: propName,
            source: sourceObjId,
            destination,
            sourceObjName,
        };
    }

    static changeToCalleeDep(dep: Dependency) {
        return {
            type: DependencyType[DependencyType.DCallee],
            name: dep.name,
            source: dep.source,
            destination: dep.destination,
        };
    }

    static translate(depType: string) {
        switch(depType) {
            case DependencyType[DependencyType.DVar]:
                return "VAR";
            case DependencyType[DependencyType.DCallee]:
                return "CALLEE";
            default:
                return "UNKNOWN";
        }
    }
}