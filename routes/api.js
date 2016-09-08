var express = require('express');
var router = express.Router();
var db = require('../db/db');
var ini = new Date();
var end = new Date();
var min =  60*1000;
var hour = 60*min;
var sampling; 

router.use(function (req, res, next) {

    ini = Date.now()-7*24*hour;     // default: since one week
    end = Date.now();               // default: up to now
    sampling = 5*min;               // default: values are averaged on 5 mins intervals

    if (req.query.ini){
        ini = new Date(req.query.ini);
    } 
    if (req.query.end){
        end = new Date(req.query.end);
    }
    if (req.query.sampling){
        sampling = req.query.sampling*min;
    }

    next();
});


router.get('/', function(req, res, next) {
    db.Metric.aggregate(
        [
         { $match : {
                    timestamp: {$gte: new Date(ini), $lte: new Date(end)} 
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
    ],
    function (err, docs) {
        
        res.json(docs);
    });
});

// get current values
router.get('/current', function(req, res, next) {
    
    db.Metric.aggregate(
        [
        { $group: {_id: {name:"$name", type:"$type"}, timestamp: {$last: "$timestamp" }, value: { $last: '$value'}}},
        { $sort: {_id: 1}}
        ], 
        function (err, docs) {
            res.json(docs);
    });
});

router.get('/:type', function(req, res, next) {
    db.Metric.aggregate(
        [
         { $match : {
                    type: req.params.type,
                    timestamp: {$gte: new Date(ini), $lte: new Date(end)} 
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
        }
    ],
    function (err, docs) {

    var result = [];
        docs.forEach(function(entry){

            var datapoint = { x: entry._id.timestamp, y: entry.avg };
            var exist_metric = result.find(function(a) {
                    return (a.key == entry._id.name);
                });

            if (exist_metric){ // la metrica con nombre _id.name ya esta en result, solo hay que añadir el datapoint
                exist_metric.values.push(datapoint);
            } else { // la metrica no esta en result, hay que añadirla con su primer datapoint
                var metric = {key : entry._id.name, values: [datapoint] };
                result.push(metric);
            }
        });

        res.json(result);
    });  

});

// get current values of some type
router.get('/:type/current', function(req, res, next) {
    
    db.Metric.aggregate(
        [
        { $match: {type: req.params.type}},
        { $group: {_id: "$name", timestamp: {$last: "$timestamp" }, value: { $last: '$value'}}},
        { $sort: {_id: 1}}
        ], 
        function (err, docs) {
            res.json(docs);
    });
});



router.get('/:type/:name', function(req, res, next) {
    db.Metric.aggregate(
        [
         { $match : {
                    name: req.params.name,
                    type: req.params.type,
                    timestamp: {$gte: new Date(ini), $lte: new Date(end)} 
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
    ],
    function (err, docs) {
        res.json(docs);
    });
});

// get most up-to-date value for a type and a name
router.get('/:type/:name/current', function(req, res, next) {

  db.Metric.aggregate(
        [
        { $match : { name: req.params.name, type: req.params.type } },
        { $group: {_id: "", timestamp: {$last: "$timestamp" }, value: { $last: '$value'}}},
        { $sort: {_id: 1}}
        ], 
        function (err, docs) {
            res.json(docs);
    });
});

// insert metric
router.post('/:type/:name', function(req,res,next){
  req.body.name = req.params.name;
  req.body.type = req.params.type;

  db.insertMetric(req.body,function(){
      res.render('index', { title: req.params.name });
  });
});


module.exports = router;
