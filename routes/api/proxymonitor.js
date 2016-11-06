"use strict";
var express = require('express');
var router = express.Router();

router.all('*', function (req, res, next) {
    if (!(req.url.startsWith("/gallery")) && !(req.url.startsWith("/monitor"))){
        req.url = '/monitor' + req.url;
    }
  next(); // pass control to the next handler
});

module.exports = router;