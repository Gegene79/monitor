"use strict";
var MongoClient = require('mongodb').MongoClient;
const DB_URL = process.env.DB_URL;
var database;
var metrics;
var images;
var mbuffer = new Map();
const MAXDEV = new Map([["temperature", 5 / 6000],["humidity",10 / 6000]]); // temperature => 5ºC per minute, humidity => 10% per minute 



exports.connect = function(callback){
    
    MongoClient.connect(DB_URL,{}, function(err, db) {
    
    if (err) {
      console.error('Failed to connect to mongo - retrying in 5 sec', err);
      setTimeout(exports.connect, 5000);
    } else {
        console.log("Connected to database.");
        database = db;
        images = db.collection('images');
        metrics = db.collection('metrics');

        exports.Images = images;
        exports.Metrics = metrics;

        db.on('error', function(err) {
                console.log("DB connection Error: "+err);
                db.close();
                setTimeout(exports.connect, 5000);
        });
            
        db.on('close', function(str) {
                console.log("DB disconnected: "+str);
        });

        db.once('open', function() {
            console.log("connectado!");
        });
    }

    callback();
  });  
};

exports.listAllImages = function(){
    // empty filter {}, returns path, ctime and mtime
     return images.find({},{'path':1,'ctime':1, 'mtime':1}).toArray();
};


exports.insertImage = function(image){
    image.loaded_at = new Date();
    return images.insertOne(image)
    .then(function(result){
        console.log(new Date().toISOString()+ " - inserted "+result.ops[0].filename);
        return Promise.resolve(result);
    })
    .catch(function(error){
        console.log(new Date().toISOString()+ " - error in inserting image in db : "+error);
        return Promise.reject(error);
    });
};

exports.deleteImage = function(id){
    return images.deleteOne({_id: id})
    .then(function(res){
        console.log(new Date().toISOString()+ " - removed image from db: "+id);
        return Promise.resolve(res);
    })
    .catch(function(error){
        console.log(new Date().toISOString()+ " - error in removing image from db : "+error);
        return Promise.reject(error);
    });
};

exports.deleteImages = function(filter){
    return images.deleteMany(filter)
    .then(function(res){
        console.log(new Date().toISOString()+ " - removed "+res.deletedCount+" images from db.");
        return Promise.resolve(res);
    })
    .catch(function(error){
        console.log(new Date().toISOString()+ " - error in removing images from db : "+error);
        return Promise.reject(error);
    });
};

exports.insertMetric = function(metric) {
	
    if ((metric.type) && (metric.name)){
        var key = metric.type+"."+metric.name;
    } else {
        return Promise.reject(new Error("Metric uncomplete "+metric));
    }

    if (!(metric.period)) {
        metric.period = 'm';
    }
    if (!(metric.timestamp)){
        metric.timestamp = new Date();
    }
    
    if (mbuffer.has(key)) {
        let valuediff = Math.abs(metric.value - mbuffer.get(key).value);
        let timediff = Math.abs(metric.timestamp.getTime() - mbuffer.get(key).timestamp.getTime());
        let limit = MAXDEV.get(metric.type);

        if ( (valuediff / timediff) > MAXDEV.get(metric.type) ){ 
            // too much metric change for elapsed time...
            // replace erroneous value with last know value.
            metric.value = mbuffer.get(key).value;            
        }
    }
    mbuffer.set(key,metric); // add or replace in Map.
        
    return metrics.insertOne(metric);
}