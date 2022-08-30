// taint object property 

module.exports = function f(path, value) {
    obj = {};
    for (var i = 0; i < path.length; i++) {
        const key = path[i];

        if (i === path.length - 1) {
            obj[key] = value;
        }

        obj = obj[key];
    }
};