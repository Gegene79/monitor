"use strict";
var MongoClient = require('mongodb').MongoClient;
const DB_URL = process.env.DB_URL;
var database;
var metrics;
var images;


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


/**** Gallery Section ****/


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


/**** Metric Section ****/

exports.insertMetric = function(metric) {
	
    return metrics.insertOne(metric);
};

// get values for all metrics
exports.getMetrics = function(datemin,datemax,sampling){
    
    return metrics.aggregate(
        [
         { $match : {
                    timestamp: {$gte: new Date(datemin), $lte: new Date(datemax)} 
                }
        },   
        { "$group": {
                "_id": {
                    timestamp: {
                        "$add": [
                            { "$subtract": [
                                { "$subtract": [ "$timestamp", new Date(0) ] },
                                { "$mod": [ 
                                    { "$subtract": [ "$timestamp", new Date(0) ] }, sampling]}
                                ]},
                            new Date(0)
                            ]
                        },
                        name:"$name", type:"$type"
                },
                //"count": { "$sum": 1 },
                //"first": { "$first": "$value"},
                //"last": { "$last": "$value"},
                "avg": { "$avg": "$value"}//,
                //"min": { "$min": "$value"},
                //"max": { "$max": "$value"},
                //"stdev": { "$stdDevPop": "$value"}
            }
        }
    ]).toArray();
};


exports.getMetricsByType = function(type,datemin,datemax,sampling){
    
    return metrics.aggregate(
        [
         { $match : {
                    type: type,
                    timestamp: {$gte: new Date(datemin), $lte: new Date(datemax)} 
                }
        },   
        { "$group": {
                "_id": {
                    timestamp: {
                        "$add": [
                            { "$subtract": [
                                { "$subtract": [ "$timestamp", new Date(0) ] },
                                { "$mod": [ 
                                    { "$subtract": [ "$timestamp", new Date(0) ] }, sampling ]}
                                ]},
                            new Date(0)
                            ]
                        },
                        name:"$name"
                },
                //"count": { "$sum": 1 },
                //"first": { "$first": "$value"},
                //"last": { "$last": "$value"},
                "avg": { "$avg": "$value"}//,
                //"min": { "$min": "$value"},
                //"max": { "$max": "$value"},
                //"stdev": { "$stdDevPop": "$value"}
            }
        },
        {
        "$sort": { '_id.type': 1, '_id.name': 1, '_id.timestamp': 1 } 
        }
    ]).toArray();
};


exports.getMetricsByTypeAndName = function(type,name,datemin,datemax,sampling){

    return metrics.aggregate(
        [
         { $match : {
                    name: name,
                    type: type,
                    timestamp: {$gte: new Date(datemin), $lte: new Date(datemax)} 
                }
        },   
        { "$group": {
                "_id": {
                    timestamp: {
                        "$add": [
                            { "$subtract": [
                                { "$subtract": [ "$timestamp", new Date(0) ] },
                                { "$mod": [ 
                                    { "$subtract": [ "$timestamp", new Date(0) ] }, sampling ]}
                                ]},
                            new Date(0)
                            ]
                        }
                },
                //"count": { "$sum": 1 },
                //"first": { "$first": "$value"},
                //"last": { "$last": "$value"},
                "avg": { "$avg": "$value"}//,
                //"min": { "$min": "$value"},
                //"max": { "$max": "$value"},
                //"stdev": { "$stdDevPop": "$value"}
            }
        }
    ]).toArray();
};

exports.getCurrentValueByTypeAndName = function(type,name){

    return metrics.aggregate(
        [
        { $match : { name: name, type: type } },
        { $group: {_id: "", timestamp: {$last: "$timestamp" }, value: { $last: '$value'}}},
        { $sort: {_id: 1}}
        ]).toArray();
};

exports.getCurrentValueByType = function(type){

    return metrics.aggregate(
        [
        { $match: {type: type}},
        { $group: {_id: "$name", timestamp: {$last: "$timestamp" }, value: { $last: '$value'}}},
        { $sort: {_id: 1}}
        ]).toArray();
};

exports.getCurrentValues = function(){

    return metrics.aggregate(
        [
        { $group: {_id: {name:"$name", type:"$type"}, timestamp: {$last: "$timestamp" }, value: { $last: '$value'}}},
        { $sort: {_id: 1}}
        ]).toArray();
};
