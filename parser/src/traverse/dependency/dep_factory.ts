enum DependencyType {
    DVar,
    DObject,
    DCallee,
}

export interface Dependency {
    type: string
    source: number
    name: string
    destination?: number
    arg?: number
    isProp?: boolean
}

export function DVar(name: string, source: number, arg?: number, isProp?: boolean): Dependency {
    return {
        type: DependencyType[DependencyType.DVar],
        name,
        source,
        arg,
        isProp
    };
}

export function DObject(propName: string, destination: number, sourceObjId: number): Dependency {
    return {
        type: DependencyType[DependencyType.DObject],
        name: propName,
        source: sourceObjId,
        destination
    };
}

export function isDVar(dep: Dependency): boolean {
    return dep.type === DependencyType[DependencyType.DVar];
}

export function isDCallee(dep: Dependency): boolean {
    return dep.type === DependencyType[DependencyType.DCallee];
}

export function isDObject(dep: Dependency): boolean {
    return dep.type === DependencyType[DependencyType.DObject];
}

export function changeToCalleeDep(dep: Dependency): Dependency {
    return {
        type: DependencyType[DependencyType.DCallee],
        name: dep.name,
        source: dep.source,
        destination: dep.destination
    };
}

export function translate(depType: string): string {
    switch (depType) {
        case DependencyType[DependencyType.DVar]:
            return "DEP";
        case DependencyType[DependencyType.DCallee]:
            return "ARG";
        default:
            return "UNKNOWN";
    }
}

export function includes(deps: Dependency[], item: Dependency): boolean {
    return deps.findIndex((dep) => {
        return dep.type === item.type &&
            dep.name === item.name &&
            dep.source === item.source
    }) >= 0;
}
