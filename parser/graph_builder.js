class GraphBuilder {
    
    constructor() {
        this.node_id = 0;
    }
    
    build_if(obj) {
        const { test, consequent, alternate}  = obj;
        
        const nodes = {};
        const edges = [];
        
        const entryNodeId   = this.node_id++;
        const exitNodeId    = this.node_id++;

        const testNodeId        = this.node_id++;
        const consequentNodeId  = this.node_id++;
        const alternateNodeId   = this.node_id++;
        
        nodes[entryNodeId]      = { type: "_root", loc: null };
        nodes[testNodeId]       = { type: test.type, loc: `${test.loc.start.line}-${test.loc.end.line}` };
        nodes[consequentNodeId] = { type: consequent.type, loc: `${consequent.loc.start.line}-${consequent.loc.end.line}` };
        nodes[alternateNodeId]  = { type: alternate.type, loc: `${alternate.loc.start.line}-${alternate.loc.end.line}` };
        nodes[exitNodeId]       = { type: "_end", loc: null };
        
        edges.push({ edge: [entryNodeId, testNodeId], label: "if"});
        edges.push({ edge: [testNodeId, consequentNodeId], label: "true" });
        edges.push({ edge: [testNodeId, alternateNodeId], label: "false" });
        edges.push({ edge: [consequentNodeId, exitNodeId] });
        edges.push({ edge: [alternateNodeId, exitNodeId] });
        
        return { entryNodeId, exitNodeId, nodes, edges };
    }
    
    build_while(obj) {
        const { test, body}  = obj;
        
        const nodes = {};
        const edges = [];

        const entryNodeId   = this.node_id++;
        const exitNodeId    = this.node_id++;

        const testNodeId    = this.node_id++;
        const bodyNodeId    = this.node_id++;
        
        nodes[entryNodeId]  = { type: "_root", loc: null };
        nodes[testNodeId]   = { type: test.type, loc: `${test.loc.start.line}-${test.loc.end.line}` };
        nodes[bodyNodeId]   = { type: body.type, loc: `${body.loc.start.line}-${body.loc.end.line}` };
        nodes[exitNodeId]   = { type: "_end", loc: null };
        
        edges.push({ edge: [entryNodeId, testNodeId], label: "while"});
        edges.push({ edge: [testNodeId, bodyNodeId], label: "true" });
        edges.push({ edge: [bodyNodeId, testNodeId] });
        edges.push({ edge: [testNodeId, exitNodeId] });
        
        return { entryNodeId, exitNodeId, nodes, edges };
    }
    
    build_switch(obj) {
        const { discriminant, cases }  = obj;
        
        const nodes = {};
        const edges = [];

        const entryNodeId   = this.node_id++;
        const exitNodeId    = this.node_id++;
        
        const discriminantNodeId = this.node_id++;

        nodes[entryNodeId]          = { type: "_root", loc: null };
        nodes[discriminantNodeId]   = { type: discriminant.type, loc: `${discriminant.loc.start.line}-${discriminant.loc.end.line}` };
        nodes[exitNodeId]           = { type: "_end", loc: null };
        
        edges.push({ edge: [entryNodeId, discriminantNodeId], label: "switch"});
        
        
        let switchCasesVisited = 0;
        const numberSwitchCases = cases.length;
        
        cases.forEach((switchCase) => {
            const { test, consequent } = switchCase;
            const switchCaseId = this.node_id++;
            
            if (test) {
                nodes[switchCaseId] = { type: test.type, loc: `${test.loc.start.line}-${test.loc.end.line}` };
                edges.push({ edge: [discriminantNodeId, switchCaseId], label: test.value.toString() });
            } else {
                nodes[switchCaseId] = { type: "Default", loc: `${switchCase.loc.start.line}-${switchCase.loc.end.line}` };
                edges.push({ edge: [discriminantNodeId, switchCaseId] });
            }
            
            consequent.forEach((statement) => {
                const statementId = this.node_id++; 
                nodes[statementId] = { type: statement.type, loc: `${statement.loc.start.line}-${statement.loc.end.line}` };
                edges.push({ edge: [this.node_id-2, statementId] });
            });
            
            const lastStatement = this.node_id-1;
            if (nodes[lastStatement].type == "BreakStatement") {
                edges.push({ edge: [lastStatement, exitNodeId] });
            } else if (switchCasesVisited + 1 == numberSwitchCases) {
                edges.push({ edge: [lastStatement, exitNodeId] });
            } else {
                edges.push({ edge: [lastStatement, this.node_id] });
            }
            
            switchCasesVisited++;
        });
        
        return { entryNodeId, exitNodeId, nodes, edges };
    }
    
    build_return(obj) {
        const { argument }  = obj;
        
        const nodes = {};
        const edges = [];

        const entryNodeId       = this.node_id++;
        const exitNodeId        = this.node_id++;
        const argumentNodeId    = this.node_id++;
        
        nodes[entryNodeId]      = { type: "_root", loc: null };
        nodes[argumentNodeId]   = { type: argument.type, loc: `${argument.loc.start.line}-${argument.loc.end.line}` };
        nodes[exitNodeId]       = { type: "_end", loc: null };
        
        edges.push({ edge: [entryNodeId, argumentNodeId], label: "return"});
        edges.push({ edge: [argumentNodeId, exitNodeId] });
        
        return { entryNodeId, exitNodeId, nodes, edges };
    }

    // build_call(obj) {
    //     const { callee } = obj;

    //     const nodes = {};
    //     const edges = [];

    //     const entryNodeId   = this.node_id++;
    //     const exitNodeId    = this.node_id++;
    //     const calleeId      = this.node_id++;

    //     nodes[entryNodeId] = { type: "_root", loc: null };
    //     nodes[calleeId] = { type: `${obj.type} ${callee.name}`, loc: `${callee.loc.start.line}-${callee.loc.end.line}` };
    //     nodes[exitNodeId] = { type: "_end", loc: null };
        
    //     edges.push({ edge: [entryNodeId, calleeId], label: "call"});
    //     edges.push({ edge: [calleeId, exitNodeId] });
        
    //     return { entryNodeId, exitNodeId, nodes, edges };
    // }
}

module.exports = GraphBuilder;