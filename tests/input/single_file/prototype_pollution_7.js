function f(obj,prop,next,value) {
  let next_prop = next.shift();
  if (obj[next_prop]){
    f(obj[next_prop], prop,next,value);
  }
  else{
    obj[prop] = value;   
  }
    
    return; 
}
module.exports = f;