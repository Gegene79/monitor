"use strict";
var os = require('os');
const IMAGES_DIR = process.env.IMAGES_DIR;
const THUMBS_DIR = process.env.THUMBS_DIR;
const CPUNB = os.cpus().length;
const DB_URL = process.env.DB_URL;
const COLL_IMAGES = process.env.COLL_IMAGES;
const COLL_METRICS = process.env.COLL_METRICS;
const CPU_SCAN_FACTOR = process.env.CPU_SCAN_FACTOR

module.exports = {
    IMAGES_DIR: IMAGES_DIR,
    THUMBS_DIR: THUMBS_DIR,
    CPUNB: CPUNB,
    DB_URL: DB_URL,
    COLL_IMAGES: COLL_IMAGES,
    COLL_METRICS: COLL_METRICS,
    CPU_SCAN_FACTOR: parseInt(CPU_SCAN_FACTOR,10)
};