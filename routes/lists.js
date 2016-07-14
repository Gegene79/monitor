var express = require('express');
var router = express.Router();
var db = require('../db/db');

/* GET metrics listing. */
router.get('/', function(req, res, next) {
  db.Metric.aggregate([   
        { $group: {
            _id: {'type':'$type', 'name': '$name'},
            count: { $sum: 1 }
        }}
    ], function (err, result) {
        if (err) {
            console.log(err);
            return;
        }
        res.json(result);
    });
});

router.get('/types', function(req, res, next) {
  db.Metric.aggregate([   
        { $group: {
            _id: '$type',
            count: { $sum: 1 }
        }}
    ], function (err, result) {
        if (err) {
            console.log(err);
            return;
        }
        res.json(result);
    });
});

router.get('/names', function(req, res, next) {
  db.Metric.aggregate([   
        { $group: {
            _id: '$name',
            count: { $sum: 1 }
        }}
    ], function (err, result) {
        if (err) {
            console.log(err);
            return;
        }
        res.json(result);
    });
});

module.exports = router;
