"use strict";
var glob = require("glob");
var path = require("path");
var fs = require("fs");
var gm = require('gm');
var imageMagick = gm.subClass({ imageMagick: true });
var db = require("./db");
var ExifImage = require('exif').ExifImage;
const IMAGES_DIR = process.env.IMAGES_DIR;
const THUMBS_DIR = process.env.THUMBS_DIR;
var dbimages = [];
var fsimages = [];


function createthumb(image)  {

    return new Promise(function(resolve, reject){

        // 
        var thumb = THUMBS_DIR+image.substring(IMAGES_DIR.length);

        // obtain the size of an image
        imageMagick(image).size(function (err, size) {
            if (err) {
                console.log(err);
                return reject(err);
            } else {
                console.log(new Date().toISOString()+ ' - '+image+' size=' + size.width+'x'+size.height);


                if (size.height > 1080)  {
                    
                    if (!fs.existsSync(path.dirname(thumb))){
                        fs.mkdirSync(path.dirname(thumb));
                        console.log(new Date().toISOString()+ ' - created dir ' + path.dirname(thumb));
                    }

                    imageMagick(image)
                    .resize(Math.round(size.width*1080/size.height), 1080)
                    .autoOrient()
                    .write(thumb, function (err) {
                        if (err) {
                            console.log(err);
                            return reject(err);
                        } else {
                            console.log(new Date().toISOString()+ ' - Created thumb '+thumb);
                            return resolve(thumb);
                        }
                    });
                }
            }
        });
    });
} 


function getimagesonfs() {
    return new Promise(function(resolve, reject) {
        glob(IMAGES_DIR+"/**/*.jpg", {nocase:true}, function (glob_err, files) {
            if (glob_err) {
                reject(glob_err);
            }
            else {
                fsimages = files;
                resolve(files);
            }
        });
    });
}


function getimagesindb() {
    return new Promise(function(resolve, reject) {
        db.Images.find(
            {},
            { path: 1,ctime:1, mtime: 1}
            ).toArray(function(err, docs){
                if (err) {
                    reject(err);
                }
                else {
                    dbimages = docs;
                    resolve(docs);
                }
        });
    });
};

function getexif(path){

    return new Promise(function(resolve, reject) {
        try {
            new ExifImage({ image : path }, function (error, exifData) {
                if (error){
                    console.log('Error: ' + error.message);
                    reject(error);
                } else {
                    resolve(exifData);
                }
            });
        } catch (error) {
            console.log(new Date().toISOString()+ ' - getexif error: ' + error.message);
            reject(error);
        }
    });
};

function getstats(path){

    return new Promise(function(resolve, reject) {
        fs.stat(path, function(error, stats){
            if (error){
                console.log(new Date().toISOString()+ ' - getstats error: ' + error.message);
                reject(error);
            } else {
                resolve(stats);
            }
        });
    });
};

function enrichimage(imgdetails){

    if (!(imgdetails) || imgdetails.length==0) {return Promise.resolve(null);}

    let imgpath = imgdetails[0];
    let stats = imgdetails[1];
    let exifdata = imgdetails[2];
    

    if (!(stats.isFile())){ 
        console.log(imgpath + " is not a file");
        return Promise.resolve(null);
    }
        
    var image = {
            path : imgpath,
            filename : path.basename(imgpath),
            dir : path.dirname(imgpath),
            extension : path.extname(imgpath),
            mtime : stats.mtime,
            ctime : stats.ctime,
            birthtime : stats.birthtime,
            info : exifdata.image,
            gps : exifdata.gps,
            exif : exifdata.exif
    };

    return Promise.resolve(image);
}

function insertimage(path){
    Promise.all([Promise.resolve(path),getstats(path),getexif(path)])
    .then(enrichimage)
    .then(function(image){
        return Promise.all([Promise.resolve(image), createthumb(image.path)])
    })
    .then(function(results){
        let image = results[0];
        image.thumb = results[1];
        return db.insertImage(image);
    })
    .then(function(result){
        console.log(new Date().toISOString()+ " - inserted "+result.ops[0].filename);
    })
    .catch(function (error){console.log('error en tratar imagen: '+error);});
}

function scan() {

    Promise.all([getimagesonfs(), getimagesindb()])
    .then(function(results) {

        // check images found on fs versus in DB
        results[0].forEach(function(item){
            
            let im = results[1].findIndex(function(element,index,array){return element.path==item});

            if (im < 0){
                console.log(new Date().toISOString()+ " - file "+ path.basename(item) +" not found in db");
                insertimage(item);
            }
        });
        
        // check images found in DB versus on fs and delete the obsolete ones
        let imagestodelete = [];
        results[1].forEach(function (item){
            
            let im = results[0].findIndex(function(element,index,array){return element==item.path});

            if (im < 0){ // esta en BBDD pero no en el fs
                imagestodelete.push(item._id);
            }
        });
        
        let nbimgtodel = imagestodelete.length;
        if (nbimgtodel > 0) {
            db.deleteImages({_id:{$in: imagestodelete}})
            .then(function(res){
                if (res.deletedCount == nbimgtodel){
                    console.log(new Date().toISOString()+ " - removed "+res.deletedCount+" images from db.");
                } else {
                    console.log(new Date().toISOString()+ " - error, removed " +res.deletedCount+" images on "+nbimgtodel);
                }
            })
            .catch(function(error){
                console.log(new Date().toISOString()+ " - error in removing images from db : "+error);
            });
        }
    });
}

exports.scan = scan;