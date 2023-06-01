const cartesian = require('cartesian');

const isStringArray = (value) => {
    if (typeof value === 'string') {
        try {
            const parsedArray = JSON.parse(value);
            return Array.isArray(parsedArray);
        } catch (error) {
            return false;
        }
    }
    return false;
};

const generateCartesianProduct = (data) => {
    if (Array.isArray(data)) {
        const cartesianProduct = data.map((value) => {
            if (typeof value === 'string') {
                const convertedArray = value.split(" | ").map((value) => {
                    if (isStringArray(value)) {
                        return JSON.parse(value);
                    }
                    return value;
                });
                return convertedArray;
            } else if (typeof value === 'object') {
                return generateCartesianProduct(value);
            }
            return value;
        });

        return cartesian(cartesianProduct);
    } else if (typeof data === 'object') {
        const cartesianProduct = {};

        for (const key in data) {
            const value = data[key];

            if (typeof value === 'string') {
                const convertedArray = value.split(" | ").map((value) => {
                    if (isStringArray(value)) {
                        return JSON.parse(value);
                    }
                    return value;
                });
                cartesianProduct[key] = convertedArray;
            } else if (typeof value === 'object') {
                cartesianProduct[key] = generateCartesianProduct(value);
            } else {
                cartesianProduct[key] = value;
            }
        }

        const product = cartesian(Object.values(cartesianProduct));

        return product.map((p) => {
            return Object.fromEntries(Object.keys(cartesianProduct).map((key, index) => {
                return [key, p[index]];
            }));
        });
    } else {
        return [];
    }
};

module.exports = { generateCartesianProduct };
