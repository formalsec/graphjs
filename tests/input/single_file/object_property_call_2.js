let v = {
    f: {
        a: function (x){
            eval(x);
        }
    }
};

function g(x){
    return v.f.a(x);
}

module.exports = {g};
