const f1 = function(a,b) {
    const f2 = function(c,d) {
    }
    f2(a,b)
}

/* Expected output

FunctionCalls:
    6 -> f1 (a,b) tainted
    8 -> f2 (a,b) NOT tainted

Edge call f1(6) -> f2(8)
 */