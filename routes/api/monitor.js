"use strict";
var Promise = require("bluebird");
var express = require('express');
var router = express.Router();
var myDate = require('moment');
var db = require('../../common/db');
var ini = new Date();
var end = new Date();
const min =  60*1000;
const hour = 60*min;
var sampling;
var mbuffer = new Map();
const MAXDEV = new Map([["temperature", 5 / 60000],      // temperature => 5ºC per minute
                        ["humidity",    10 / 60000],     // humidity => 10% per minute
                        ["prueba_type", 10 / 60000]]);   // for testing purpose   



/*** Utility functions ***/

function transform(docs){

    return new Promise(function(resolve,reject){

        var result = [];
        docs.forEach(function(entry){
            if (!((entry.avg == null) || (entry.avg == NaN))){

                var datapoint = { x: entry._id.timestamp, y: Math.round(entry.avg*10)/10 };
                var exist_metric = result.find(function(a) {
                        return (a.key == entry._id.name);
                    });

                if (exist_metric){ // la metrica con nombre _id.name ya esta en result, solo hay que añadir el datapoint
                    exist_metric.values.push(datapoint);
                } else { // la metrica no esta en result, hay que añadirla con su primer datapoint
                    var metric = {key : entry._id.name, values: [datapoint] };
                    result.push(metric);
                }
            }
        });

        return resolve(result);
    });
};

function sendresult(res,result){
    res.contentType('application/json');
    res.status(200).json(result);
};

/*** Defaults parameters ***/

router.use(function (req, res, next) {

    ini = myDate().subtract(7,'days').startOf('day').toDate();      // default: since one week
    end = myDate().toDate();                                        // default: up to now
    sampling = 5*min;                                               // default: values are averaged on 5 mins intervals

    if (req.query.ini){
        ini = myDate(req.query.ini).toDate();
    } 
    if (req.query.end){
        end = myDate(req.query.end).toDate();
    }
    if (req.query.sampling){
        sampling = req.query.sampling*min;
    }

    next();
});


// get historical values for all metrics
router.get('/', function(req, res, next) {
    
    db.getMetrics(ini,end,sampling)
    .then(transform)
    .then(function(result){sendresult(res,result);})
    .catch(function(error){
        next(error);
    });
});

// get current values for all metrics
router.get('/current', function(req, res, next) {
    
    db.getCurrentValues()
    .then(function(result){sendresult(res,result);})
    .catch(function(error){
        next(error);
    });
});


// get historical values for all metrics of some type
router.get('/:type', function(req, res, next) {

    db.getMetricsByType(req.params.type,ini,end,sampling)
    .then(transform)
    .then(function(result){sendresult(res,result);})
    .catch(function(error){
        next(error);
    });  
});

// get current values of all metrics of some type
router.get('/:type/current', function(req, res, next) {

    db.getCurrentValueByType(req.params.type)
    .then(function(result){sendresult(res,result);})
    .catch(function(error){
        next(error);
    });
});

// get historical values for a type and a name
router.get('/:type/:name', function(req, res, next) {
    
    db.getMetricsByTypeAndName(req.params.type,req.params.name,ini,end,sampling)
    .then(transform)
    .then(function(result){sendresult(res,result);})
    .catch(function(error){
        next(error);
    });  
});

// get current value for a type and a name
router.get('/:type/:name/current', function(req, res, next) {

    db.getCurrentValueByTypeAndName(req.params.type,req.params.name)
    .then(function(result){
        sendresult(res,result);
    })
    .catch(function(error){
        next(error);
    });
});

// insert metric
router.post('/:type/:name', function(req,res,next){

    var metric = req.body;
    metric.value = Number(metric.value);
    metric.name = req.params.name;
    metric.type = req.params.type;

    var key = metric.type+"."+metric.name;
    
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
            // too much metric change for elapsed time... do not insert data.
            return next(new Error("Erroneous value, difference of "+valuediff.toFixed(1)+" units in "+(timediff/1000).toFixed(0)+"seconds."));           
        }
    }
    mbuffer.set(key,metric); // add or replace in Map.

    db.insertMetric(metric)
    .then(function(result){sendresult(res,result);})
    .catch(function(error){
        next(error);
    });
});

module.exports = router;
