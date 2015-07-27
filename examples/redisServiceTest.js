(function(){
   'use strict';

   var Bluebird = require('bluebird');
   var redis = require('redis');
   var client = redis.createClient();
   var _ = require('lodash');
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

   function setObjectProperties(key, obj){
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

   function getSet(key, transmute){
      return new Bluebird(function(resolve, reject){
         function setAtomic(key, count){
            var counts = count;

            // create a UNIQUE CLIENT CONNECTION for this process
            var atomicClient = redis.createClient();
            atomicClient.watch(key);

            // get the object
            atomicClient.hgetall(key, function(err,o){
               var newO = {};
               if(err){
                  return reject(err);
               }

               // get parsed object
               var generated = Object.keys(o).reduce(function(generated, field){
                  var val;
                  try {
                     val = JSON.parse(o[field]);
                  }
                  catch (e){
                     val = '';
                  }
                  generated[field] = val;
                  return generated;
               },{});

               // run the transmute function
               newO = transmute(generated);

               // update all keys
               var chain = Object.keys(newO).reduce(function(ch, field){
                  var val = typeof newO[field] === 'string' ? newO[field] : JSON.stringify(newO[field]);
                  return ch.hset(key, field, val);
               }, atomicClient.multi());

               var k1 = Object.keys(o);
               var k2 = Object.keys(newO);

               var keysToRemove = _.difference(k1, k2);

               var nextChain = keysToRemove.reduce(function(ch, field){
                  return ch.hdel(key, field);
               }, chain);

               nextChain.hgetall(key).exec(function(err, results){
                  atomicClient.quit();
                  if(results === null && counts < 10){
                     setAtomic(key, counts++);
                  }
                  if(results === null && counts >= 10){
                     return reject(new Error("Could not complete transaction"));
                  }
                  if(err){
                     return reject(err);
                  }
                  return resolve(results);
               });
            });
         }
         setAtomic(key, 0);
      });
   }

   getSet('foo', function(o){
      console.log('got o: ', o);
      //Object.keys(o).forEach(function(key){
      //   o[key]++;
      //});
      o.bar++;
      o.baz = 5;
      delete o.bar;
      console.log('changed o: ', o);
      return o;
   })
   .then(function(results){
      console.log('results: ', results);
      process.exit();
   })
   .catch(function(err){
      cosnole.log('err: ', err);
      process.exit();
   });

})();
