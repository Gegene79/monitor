"use strict";
var express = require('express');
var router = express.Router();

router.all('*', function (req, res, next) {
   
    next('/api/monitor'+req.url); // pass control to the next handler
});

module.exports = router;