var edsParser = require('../libs/edsParser.js');
var fs = require('fs');
var path = require('path');

var filename = '';
if(process.argv[2] && process.argv[2].length){
   filename = process.argv[2];
}

if(!filename.length){
   console.log('Must pass in a filename as an argument');
   process.exit(1);
}

fs.readFile(path.join('./', filename), {encoding: 'utf8'}, function(err, f){
   if(err){
      console.log(err);
      process.exit(1);
   }
   var parsed = edsParser(f);

   console.log(JSON.stringify(parsed));
   return;
});
