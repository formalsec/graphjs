let v = {
    f: function (x){
        eval(x);
    }
};

function g(x){
    return v.f(x);
}

module.exports = {g};
