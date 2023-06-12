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

const parseStringValue = (value) => {
    value = value.replace(/'/g, '"');
    if (isStringArray(value)) {
        return JSON.parse(value);
    } else {
        try {
            return JSON.parse(value);
        } catch (error) {
            return value;
        }
    }
};

const generateCartesianProduct = (data) => {
    if (Array.isArray(data)) {
        const cartesianProduct = data.map((value) => {
            return parseStringValue(value);
        });

        return cartesian(cartesianProduct);
    } else if (typeof data === 'object') {
        const cartesianProduct = {};

        for (const key in data) {
            const value = data[key];

            if (typeof value === 'string') {
                const convertedArray = value.split(" | ").map((value) => {
                    return parseStringValue(value);
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
    } else if (typeof data === 'string') {
        try {
            const parsedObject = JSON.parse(data);
            return parsedObject;
        } catch (error) {
            return parseStringValue(data);
        }
    } else {
        return [];
    }
};

module.exports = { generateCartesianProduct };
