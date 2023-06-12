const f2 = function(c,d) {

}

const f1 = function(a,b) {
    f2(a,b)
}

/* Expected output

FunctionCalls:
    6 -> f1 (a,b) tainted
         f2 (a,b) tainted

Edge call f1(6) -> f2(6)
 */