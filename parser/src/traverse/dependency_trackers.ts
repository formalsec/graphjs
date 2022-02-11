import { Identifier, Property } from "estree";
import { Graph } from "./graph/graph";

export enum ValLattice {
    NoObject,
    Unknown,
};

export interface HeapObjectValue {
    [key: string]: ValLattice | Object,
};

interface GraphOperation {
    op: string,
    name: string,
    source?: number,
    destination?: number,
    previousObjectName?: string,
    propertyName?: string,
};

type Heap = Map<string, HeapObjectValue>;
type Store = Map<string, Array<string>>;
type Phi = Map<string, number>;
type GChanges = Array<GraphOperation>;
type GNodes = Map<string, number>;

export class DependencyTracker {
    private heap: Heap;
    private store: Store;
    private phi: Phi;
    private gChanges: GChanges;
    private gNodes: GNodes;

    constructor() {
        this.heap = new Map();
        this.store = new Map();
        this.phi = new Map();
        this.gChanges = new Array();
        this.gNodes = new Map();
    }

    addToHeap(name: string, properties: Property[]) {
        let obj: HeapObjectValue = {};

        if (this.heap.has(name)) {
            obj = this.heap.get(name) as HeapObjectValue;
        }

        properties.forEach(p => {
            const propKey = p.key as Identifier;
            if (p.value && p.value.type === "Literal") {
                obj[propKey.name] = ValLattice.NoObject;
            } else {
                obj[propKey.name] = ValLattice.Unknown;
            }
        });

        this.heap.set(name, obj);
    }

    addToStore(name: string, location: string) {
        let storeArray = this.store.get(name);
        if (!storeArray) {
            storeArray = [];
        }

        storeArray.push(location);
        this.store.set(name, storeArray);
    }

    addToPhi(name: string, id: number) {
        this.phi.set(name, id);
    }

    graphCreateNewObject(sourceId: number, objName: string) {
        this.gChanges.push({
            op: "CREATE_NEW_OBJECT",
            source: sourceId,
            name: objName,
        });
    }

    updateGraph(graph: Graph) {
        let change;
        while (change = this.gChanges.pop()) {
            switch (change.op) {
                case "CREATE_NEW_OBJECT": {
                    // create node
                    const nodeObj = graph.addNode("PDG_OBJECT", { type: "PDG" });
                    this.gNodes.set(change.name, nodeObj.id);
                    nodeObj.identifier = change.name;

                    // add create edge
                    const source = change.source;
                    if (source) graph.addEdge(source, nodeObj.id, { type: "PDG", label: "CREATE", objName: change.name });
                    break;
                }

                // case "CREATE_NEW_VERSION": {
                //     // create new version node
                //     const nodeObj = graph.addNode("PDG_OBJECT", { type: "PDG" });
                //     trackers.gNodes.set(change.name, nodeObj.id);
                //     nodeObj.identifier = change.name;

                //     // add write edge
                //     const source = change.source;
                //     if (source) graph.addEdge(source, nodeObj.id, { type: "PDG", label: "WRITE", objName: change.propertyName });

                //     // add new version edge
                //     if (change.previousObjectName) {
                //         const previousVersionId = trackers.gNodes.get(change.previousObjectName);
                //         if (previousVersionId) {
                //             graph.addEdge(previousVersionId, nodeObj.id, { type: "PDG", label: "NEW_VERSION", objName: change.propertyName });
                //         }
                //     }
                //     break;
                // }

                // case "LOOKUP": {
                //     if (change.previousObjectName) {
                //         // get object node for the lookup of property
                //         const previousObjectId = trackers.gNodes.get(change.previousObjectName);
                //         // get stmt id as destination
                //         const destination = change.destination;
                //         // add lookup edge
                //         if (previousObjectId && destination) {
                //             graph.addEdge(previousObjectId, destination, { type: "PDG", label: "LOOKUP", objName: change.propertyName });
                //         }
                //     }
                //     break;
                // }

                // case "VAR": {
                //     if (change.source && change.destination) {
                //         graph.addEdge(change.source, change.destination, { type: "PDG", label: "VAR", objName: change.name });
                //     }
                //     break;
                // }
            }
        }
    }

    private setHeap(newHeap: Heap) {
        this.heap = new Map(newHeap);
    }

    private setStore(newStore: Store) {
        this.store = new Map(newStore);
    }

    private setPhi(newPhi: Phi) {
        this.phi = new Map(newPhi);
    }

    private setGChanges(newGChanges: GChanges) {
        const newArray = new Array();
        newGChanges.forEach(gop => newArray.push(gop));
        this.gChanges = newArray;
    }

    private setGNodes(newGNodes: GNodes) {
        this.gNodes = new Map(newGNodes);
    }

    clone() {
        const clone = new DependencyTracker();
        clone.setHeap(this.heap);
        clone.setStore(this.store);
        clone.setPhi(this.phi);
        clone.setGChanges(this.gChanges);
        clone.setGNodes(this.gNodes);
        return clone;
    }

    print() {
        console.log("Heap:", this.heap);
        console.log("Store:", this.store);
        console.log("Phi:", this.phi);
        console.log("Graph Nodes:", this.gNodes);
    }
};