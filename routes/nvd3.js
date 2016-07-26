var express = require('express');
var router = express.Router();
var db = require('../db/db');
var ini = new Date();
var end = new Date();

router.use(function (req, res, next) { 
    var hour = 60*60*1000;
    ini = Date.now()-7*24*hour;
    end = Date.now();

    if (req.query.ini){
        ini = new Date(req.query.ini);
    } 
    if (req.query.end){
        end = new Date(req.query.end);
    }

    next();
});


router.get('/', function(req, res, next) {
    db.Metric.aggregate(
        [
        { $match : {
                        timestamp: {$gte: new Date(ini), $lte: new Date(end)} 
                    }}, 
        {$project: {_id : 0,
                type : 1,
                name : 1, 
                minute: {$minute: '$timestamp'},
                timestamp: { $dateToString: { format: "%Y-%m-%dT%H:%M:00.000Z", date: "$timestamp" } },
                value : 1
        }},
        {$match: {minute: {$in:[0,5,10,15,20,25,30,35,40,45,50,55]}}},
        {$sort : {type : 1, name : 1, timestamp : 1} }
        ], function (err, docs) {
            if (err) console.log(err);
            res.json(docs);
    });
});

router.get('/:type', function(req, res, next) {
  
  if(req.params.type){
    db.Metric.aggregate(
        [
        { $match : {
                        type: req.params.type,
                        timestamp: {$gte: new Date(ini), $lte: new Date(end)} 
                    }}, 
        {$project: {_id : 0,
                name : 1, 
                minute: {$minute: '$timestamp'},
                timestamp: { $dateToString: { format: "%Y-%m-%dT%H:%M:00.000Z", date: "$timestamp" } },
                value : 1
        }},
        {$match: {minute: {$in:[0,5,10,15,20,25,30,35,40,45,50,55]}}},
        {$sort : {name : 1,timestamp : 1} }
        ], function (err, docs) {
            if (err) console.log(err);
            res.json(docs);
    });
  } else {
      res.render('index', { title: req.params.name });
  }
});

router.get('/:type/:name', function(req, res, next) {

  if(req.params.type && req.params.name){
    
    db.Metric.aggregate(
    [
    { $match : {    name: req.params.name,
                    type: req.params.type,
                    timestamp: {$gte: new Date(ini), $lte: new Date(end)} 
                }}, 
    {$project: {_id : 0, 
                minute: {$minute: '$timestamp'},
                timestamp: { $dateToString: { format: "%Y-%m-%dT%H:%M:00.000Z", date: "$timestamp" } },
                value : 1
    }},
    {$match: {minute: {$in:[0,5,10,15,20,25,30,35,40,45,50,55]}}},
    {$sort : {timestamp : 1} }
    ], function (err, docs) {
        if (err) console.log(err);
        res.json(docs);
    });

  } else {
      res.render('index', { title: req.params.name });
  }
});

// get most up-to-date values
router.get('/:type/:name/current', function(req, res, next) {

  if(req.params.type && req.params.name){
    db.Metric.findOne({ 
      name: req.params.name,
      type: req.params.type,
   },'-_id timestamp value')
   .sort('-timestamp')
   .exec(function (err, docs) {
            res.json(docs);
    });
  } else {
      res.render('index', { title: req.params.name });
  }
});

module.exports = router;
