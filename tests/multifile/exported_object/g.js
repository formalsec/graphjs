// A single vulnerabilitiy should be reported in line 5

let v = {
    f: function f(x){
        eval(x);
    }
};

let z = {};
z.a = v;

module.exports = {z};
