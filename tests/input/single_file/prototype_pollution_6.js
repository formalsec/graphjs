function main(o,next,p,v){
    while(o[next] != null) {
        o[p] = v; 
        o = o[next]; 
    }
}
module.exports = main;