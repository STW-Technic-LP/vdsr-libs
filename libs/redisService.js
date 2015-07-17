'use strict';

var Bluebird = require('bluebird');
var redis = require('promise-redis')(function(resolver){
   return new Bluebird(resolver);
});
var client = redis.createClient();
client.on("error", function(err){
   console.error("RedisService::createClient => Error in client creation: ", err);
});

//var allowedDeviceKeys = ['serial','sid'];

module.exports = {
   addConnected: addConnected,
   getConnected: getConnected,
   isConnected: isConnected,
   removeConnected: removeConnected,
   setObject: setObject,
   getObject: getObject
};

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

function setObject(key, obj){
   var chain = Object.keys(obj).reduce(function(ch, field){
      var val = JSON.stringify(obj[field]);
      return ch.hset(key, field, val);
   }, client.multi());
   return chain.exec();
}

function getObject(key){
   return client.hgetall(key)
   .then(function(o){
      if(!o){
         return {};
      }
      Object.keys(o).forEach(function(field){
         var val;
         try {
            val = JSON.parse(o[field]);
         }
         catch (e){
            val = '';
         }
         o[field] = val;
      });
      return o;
   });
}
