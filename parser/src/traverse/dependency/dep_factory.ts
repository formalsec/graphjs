enum DependencyType {
    // DEmpty,
    // DConst,
    DVar,
    DObject,
    DCallee,
}

export interface Dependency {
    type: string
    source: number
    name: string
    value?: string
    destination?: number
    arg?: number
}

export class DependencyFactory {
    // static DConst(c: string, stmtId: number): Dependency {
    //     return {
    //         type: DependencyType[DependencyType.DConst],
    //         value: c,
    //         source: stmtId,
    //         destination: stmtId,
    //     };
    // }

    // static DEmpty(): Dependency {
    //     return {
    //         type: DependencyType[DependencyType.DEmpty]
    //     };
    // }

    static DVar(name: string, source: number, arg?: number): Dependency {
        return {
            type: DependencyType[DependencyType.DVar],
            name,
            source,
            arg
        };
    }

    static isDVar(dep: Dependency): boolean {
        return dep.type === DependencyType[DependencyType.DVar];
    }

    static isDCallee(dep: Dependency): boolean {
        return dep.type === DependencyType[DependencyType.DCallee];
    }

    static isDObject(dep: Dependency): boolean {
        return dep.type === DependencyType[DependencyType.DObject];
    }

    static DObject(propName: string, destination: number, sourceObjId: number): Dependency {
        return {
            type: DependencyType[DependencyType.DObject],
            name: propName,
            source: sourceObjId,
            destination
        };
    }

    static changeToCalleeDep(dep: Dependency): Dependency {
        return {
            type: DependencyType[DependencyType.DCallee],
            name: dep.name,
            source: dep.source,
            destination: dep.destination
        };
    }

    static translate(depType: string): string {
        switch (depType) {
            case DependencyType[DependencyType.DVar]:
                return "DEP";
            case DependencyType[DependencyType.DCallee]:
                return "CALLEE";
            default:
                return "UNKNOWN";
        }
    }

    static includes(deps: Dependency[], item: Dependency): boolean {
        return deps.findIndex((dep) => {
            return dep.type === item.type &&
                dep.name === item.name &&
                dep.source === item.source
        }) >= 0;
    }
}
