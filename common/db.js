"use strict";
var MongoClient = require('mongodb').MongoClient;
var Promise = require("bluebird");
var cst = require('./constants');
var database;
var metrics;
var images;


exports.connect = function(callback){
    
    MongoClient.connect(cst.DB_URL,{}, function(err, db) {
    
    if (err) {
      console.error('Failed to connect to mongo - retrying in 5 sec', err);
      setTimeout(exports.connect, 5000);
    } else {
        console.log("Connected to database.");
        database = db;
        images = db.collection(cst.COLL_IMAGES);
        metrics = db.collection(cst.COLL_METRICS);

        exports.Images = images;
        exports.Metrics = metrics;

        db.on('error', function(err) {
                console.log("DB connection Error: "+err);
                db.close();
                setTimeout(exports.connect, 5000);
        });
            
        db.on('close', function(str) {
                console.log("DB disconnected: "+str);
                setTimeout(exports.connect, 5000);
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

function executeQuery(query,fields,sort,skip,limit){

    var cursor = images.find(query,fields).sort(sort).limit(limit).skip(skip);
    var result ={};

    return cursor.count()
    .then(function(count){
        result.imgcount= count;
        return cursor.toArray();
    })
    .then(function(results){
        result.images = results;
        return Promise.resolve(result);
    })
    .catch(function(error){
        console.error(error);
        return Promise.reject(error);
    });
}


exports.browseImages = function(query,skip,limit){

    var query = {};

    var sort = {
        created_at: -1
    };

    var fields = {
        _id:1,
        path:1,
        largethumb: 1,
        smallthumb: 1,
        filename:1,
        dir:1,
        created_at:1,
        loaded_at:1
    };

    return executeQuery(query,fields,sort,skip,limit);
}

exports.searchImages = function(searchterm,skip,limit){

    var query = { 
        $text: { $search: searchterm, $language: "es" } 
    };

    var sort = {
        score: { $meta: "textScore" } ,
        created_at: -1
    };

    var fields = {
        _id:1,
        path:1,
        largethumb: 1,
        smallthumb: 1,
        filename:1,
        dir:1,
        created_at:1,
        loaded_at:1,
        score: { $meta: "textScore" }
    };

    return executeQuery(query,fields,sort,skip,limit);
}


exports.insertImage = function(image){
    if (image!=null){
        image.loaded_at = new Date();
        return images.insertOne(image)
        .then(function(result){
            console.log("inserted "+result.ops[0].filename);
            return Promise.resolve(result);
        })
        .catch(function(error){
            console.log("error in inserting image in db : "+error);
            return Promise.reject(error);
        });
    } else {
        return Promise.resolve(null);
    }
};

exports.deleteImage = function(id){
    return images.deleteOne({_id: id})
    .then(function(res){
        console.log("removed image from db: "+id);
        return Promise.resolve(res);
    })
    .catch(function(error){
        console.log("error in removing image from db : "+error);
        return Promise.reject(error);
    });
};

exports.deleteImages = function(filter){
    return images.deleteMany(filter)
    .then(function(res){
        console.log("removed "+res.deletedCount+" images from db.");
        return Promise.resolve(res);
    })
    .catch(function(error){
        console.log("error in removing images from db : "+error);
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
                    timestamp: {$gte: datemin, $lte: datemax} 
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
        },
        {
        "$sort": { '_id.type': 1, '_id.name': 1, '_id.timestamp': 1 } 
        }
    ]).toArray();
};


exports.getMetricsByType = function(type,datemin,datemax,sampling){
    
    return metrics.aggregate(
        [
         { $match : {
                    type: type,
                    timestamp: {$gte: datemin, $lte: datemax} 
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
        "$sort": { '_id.name': 1, '_id.timestamp': 1 } 
        }
    ]).toArray();
};


exports.getMetricsByTypeAndName = function(type,name,datemin,datemax,sampling){

    return metrics.aggregate(
        [
         { $match : {
                    name: name,
                    type: type,
                    timestamp: {$gte: datemin, $lte: datemax} 
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
        },
        {
        "$sort": { '_id.timestamp': 1 } 
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

exports.getMetricPattern = function(type, name, datemin, datemax, hourmin, hourmax){

    return metrics.aggregate([
        { $match : {   name: name,
                        type: type,
                        timestamp: {$gte: datemin, $lte: datemax},
                    }
        },
        { $project : {  name: "$name",
                        type:  "$type",
                        timestamp: "$timestamp",
                        value: "$value",
                        hour : {"$hour": "$timestamp"}, 
                        min :  {"$minute": "$timestamp"} 
                    }
        },
        { $match : {  
                        hour: {$gte: hourmin, $lte: hourmax},
                    }
        },
        { $group: {
                _id: {
                    timestamp: {
                        "$add": [
                            { "$subtract": [
                                { "$subtract": [ "$timestamp", new Date(0) ] },
                                { "$mod": [ 
                                    { "$subtract": [ "$timestamp", new Date(0) ] },
                                        1000 * 60 * 5
                                    ]}
                                ]},
                            new Date(0)
                            ]
                        },
                        name:"$name", type:"$type"
                },
                "count": { "$sum": 1 },
                "last": { "$last": "$value"},
                "avg": { "$avg": "$value"},
                "min": { "$min": "$value"},
                "max": { "$max": "$value"},
                "stdev": { "$stdDevPop": "$value"}
            }
        },
        { $group: {
                    _id: {      
                                hour: {"$hour":"$_id.timestamp"},
                                min:  {"$minute":"$_id.timestamp"},
                                name: "$_id.name", 
                                type: "$_id.type"
                            },
                    "total": { "$sum": "$count" },
                    "groups": { "$sum": 1},
                    "avg": { "$avg": "$avg"},
                    "min": { "$min": "$avg"},
                    "max": { "$max": "$avg"},
                    "stdev": { "$stdDevPop": "$avg"}
                    }
        },
        { 
            $sort: { '_id.type': 1, '_id.name': 1, '_id.hour': 1,  '_id.min': 1}
        }
        ]).toArray();
};