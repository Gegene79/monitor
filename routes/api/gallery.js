"use strict";
var db = require('../../common/db');
var express = require('express');
var img = require('../../common/fsdbsync');
var db  = require('../../common/db');
var router = express.Router();
var limit = 50;
var skip = 0;

/*** Defaults parameters ***/

router.use(function (req, res, next) {

    if (req.query.limit){
        limit = parseInt(req.query.limit);
    }
    if (req.query.skip){
        skip = parseInt(req.query.skip);
    }

    next();
});

function sendresult(res,result){
    res.contentType('application/json');
    res.status(200).json(result);
};


/* GET  */
router.get('/scan', function(req, res, next) {
    img.scan();
    res.json("{result: 'ok'}");
});

router.get('/browseimages', function(req, res, next) {
    
    let query = {};
    
    db.browseImages(query, skip, limit)
    .then(function(result){

        sendresult(res,result);
    })
    .catch(function(error){
        next(error);
    });
});

router.get('/searchimages', function(req, res, next) {
    
    let query = req.query.q;

    db.searchImages(query, skip, limit)
    .then(function(result){
        sendresult(res,result);
    })
    .catch(function(error){
        next(error);
    });
});

module.exports = router;