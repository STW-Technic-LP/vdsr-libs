(function(){
   'use strict';

   var Bluebird = require('bluebird');
   var redis = require('redis');
   var client = redis.createClient();
   client.on("error", function(err){
      console.error("RedisService::createClient => Error in client creation: ", err);
   });


   function wait(){
      return new Bluebird(function(resolve, reject){
         setTimeout(function(){
            console.log('timeout complete');
            resolve();
         },3000);
      });
   }


   function setObject(key, obj){
      return new Bluebird(function(resolve, reject){
         function setAtomic(key, obj, count){
            var counts = count;
            var atomicClient = redis.createClient();
            atomicClient.watch(key);

            var chain = Object.keys(obj).reduce(function(ch, field){
               var val = typeof obj[field] === 'string' ? obj[field] : JSON.stringify(obj[field]);
               return ch.hset(key, field, val);
            }, atomicClient.multi());

            chain.hgetall(key).exec(function(err, results){
               atomicClient.quit();
               if(results === null && counts < 10){
                  setAtomic(key, obj, counts++);
               }
               if(counts >= 10){
                  return reject(new Error("Could not complete transaction"));
               }
               if(err){
                  return reject(err);
               }
               return resolve(results);
            });
         }
         setAtomic(key, obj, 0);
      });
   }

   setObject('foo', {bar: 10, baz: 12})
   .then(function(results){
      console.log('results: ', results);
      process.exit();
   })
   .catch(function(err){
      cosnole.log('err: ', err);
      process.exit();
   });

})();
