'use strict';

var Bluebird = require('bluebird');
var redis = require('promise-redis')(function(resolver){
   return new Bluebird(resolver);
});
var client = redis.createClient();
client.on("error", function(err){
   console.error("RedisService::createClient => Error in client creation: ", err);
});
var _ = require('lodash');

var baseRedis = require('redis');

var cfg;

//var allowedDeviceKeys = ['serial','sid'];

module.exports = {
   setClient: setClient,
   setDb: setDb,
   addConnected: addConnected,
   getConnected: getConnected,
   isConnected: isConnected,
   removeConnected: removeConnected,
   setObject: setObject,
   getObject: getObject
};


function setDb(db, cb){
   client.select(db, cb);
}

function setClient(cfg){
   client.quit();
   client = redis.createClient(cfg.port, cfg.host);
   client.on("error", function(err){
      console.error("RedisService:;setClient => Error in client creation: ", err);
   });
}

function addConnected(serial){
   return client.sadd('connectedDevices', serial);
}

function getConnected(){
   return client.smembers('connectedDevices');
}

function isConnected(serial){
   return client.sismember('connectedDevices', serial);
}

function removeConnected(serial){
   return client.srem('connectedDevices', serial);
}

function getObject(key){
   return client.hgetall(key)
   .then(function(o){
      if(!o){
         return {};
      }
      return parseObject(o);
   });
}

function setObject(key, obj){
   return new Bluebird(function(resolve, reject){
      function setAtomic(key, obj, count){
         var counts = count;
         var atomicClient = cfg ? baseRedis.createClient(cfg.port, cfg.host) : baseRedis.createClient();
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

         var atomicClient = cfg ? baseRedis.createClient(cfg.port, cfg.host) : baseRedis.createClient();

         // lock the key
         atomicClient.watch(key);

         // get the object
         atomicClient.hgetall(key, function(o){
            if(!o){
               return {};
            }
            // parse the objects values
            o = parseObject(o);

            // TODO: make the function async?
            var newO = transmute(o);

            // set each key using the new object (after transmutation)
            var chain = Object.keys(newO).reduce(function(ch, field){
               var val = typeof newO[field] === 'string' ? newO[field] : JSON.stringify(newO[field]);
               return ch.hset(key, field, val);
            }, atomicClient.multi());

            // Determine deleted keys
            var k1 = Object.keys(o);
            var k2 = Object.keys(newO);
            var keysToRemove = _.difference(k1, k2);

            // Delete them
            var nextChain = keysToRemove.reduce(function(ch, field){
               return ch.hdel(key, field);
            }, chain);

            // finish the transaction
            chain.exec(function(err, results){
               atomicClient.quit();
               // transaction failed, try again
               if(results === null && counts < 10){
                  setAtomic(key, counts++);
               }
               // too many failures
               if(counts >= 10){
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

function parseObject(o){
   return Object.keys(o).reduce(function(result, field){
      var val;
      try {
         val = JSON.parse(o[field]);
      }
      catch (e){
         val = '';
      }
      result[field] = val;
   },{});
}
