function f(x,y){
    if(x==0){
        return y;
    }
    return f(x-1, y);
}

function g(x){
     eval(f(10, x));
}

module.exports = {g};