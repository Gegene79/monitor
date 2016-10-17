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
     return images.find({},{'path':1,'ctime':1, 'mtime':1});
};


exports.insertImage = function(image){
    image.loaded_at = new Date();
    return images.insertOne(image);
};

exports.deleteImage = function(id){
    return images.deleteOne({_id: id});
};

exports.deleteImages = function(filter){
    return images.deleteMany(filter);
};

exports.insertMetric = function(metric) {
	
    if ((metric.type) && (metric.key)){
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
        
    return metrics.imsertOne(metric);
}