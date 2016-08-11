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
    db.Metric.find({
        timestamp: {
        $gte: ini,
        $lte: end
        }
    },'-_id type name timestamp value')
    .sort('type')
    .sort('name')
    .sort('timestamp')
    .exec(function (err, docs) {
        res.json(docs);
    });
});

/* TODO : terminar esa query
router.get('/current', function(req, res, next) {
    
    db.Metric.aggregate(
        [
        { $sort: {type: 1, name: 1, timestamp:1} },
        { $group: {_id: {"$name","$type"}, timestamp: {$last: "$timestamp" }}}
        ], 
        function (err, docs) {
            res.json(docs);
    });
});
*/

router.get('/:type', function(req, res, next) {
  db.Metric.find({
        type: req.params.type,
        timestamp: {
        $gte: ini,
        $lte: end
        }
    },'-_id name timestamp value')
    .sort('name')
    .sort('timestamp')
    .exec(function (err, docs) {
        res.json(docs);
    });});

router.get('/:type/:name', function(req, res, next) {

  if(req.params.type && req.params.name){
    db.Metric.find({ 
      name: req.params.name,
      type: req.params.type,
      timestamp: {
        $gte: ini,
        $lte: end
        }
   },'-_id timestamp value')
   .sort('timestamp')
   .exec(function (err, docs) {
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

// insert metric
router.post('/:type/:name', function(req,res,next){
  req.body.name = req.params.name;
  req.body.type = req.params.type;

  db.insertMetric(req.body,function(){
      res.render('index', { title: req.params.name });
  });
});


module.exports = router;
