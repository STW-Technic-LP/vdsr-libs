var edsParser = require('../libs/edsParser.js');
var fs = require('fs');

fs.readFile('./wachendorffBad.eds', {encoding: 'utf8'}, function(err, f){
   var parsed = edsParser(f);

   console.log(JSON.stringify(parsed));
   return;
});
