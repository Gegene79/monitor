"use strict";
var Promise = require("bluebird");
var glob = Promise.promisifyAll(require("glob"));
var path = Promise.promisifyAll(require("path"));
var fs = Promise.promisifyAll(require("fs"));
var gm = Promise.promisifyAll(require("gm"));
var imageMagick = gm.subClass({ imageMagick: true });
var db = require("./db");
var ExifImage = require('exif').ExifImage;
const IMAGES_DIR = process.env.IMAGES_DIR;
const THUMBS_DIR = process.env.THUMBS_DIR;


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
                //console.log(new Date().toISOString()+ ' - '+image+' size=' + size.width+'x'+size.height);

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
};

function deletefile(thumb){

    if (thumb.startsWith(THUMBS_DIR)){
        return fs.unlinkAsync(thumb)
        .then(function(result){
            console.log(new Date().toISOString()+" - deleted "+thumb);
            return Promise.resolve(result);
        })
        .catch(function(error){
            return Promise.reject(new Error(new Date().toISOString()+" - error intentando borrar fichero "+thumb));
        });
    } else {
        return Promise.reject(new Error(new Date().toISOString()+" - solo se admite borrar en thumbs. aqui: "+thumb));
    }
}


function getexif(path){

    return new Promise(function(resolve, reject) {
        try {
            new ExifImage({ image : path }, function (error, exifData) {
                if (error){
                    console.log(new Date().toISOString()+ ' - Error in getexif: ' + error.message);
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
            created_at : new Date(exifdata.exif.CreateDate),
            info : exifdata.image,
            gps : exifdata.gps,
            exif : exifdata.exif
    };

    return Promise.resolve(image);
}

function insertimage(path){
    return Promise.all([Promise.resolve(path),fs.statAsync(path),getexif(path)])
    .then(function(results){
        return enrichimage(results);
    })
    .then(function(image){
        return db.insertImage(image);
    })
    .catch(function (error){
        console.log('error en tratar imagen: '+error);
        return Promise.reject(error);
    });
}

function scan() {
    var started_at = new Date();
    var imagespattern = IMAGES_DIR+"/**/*.jpg";
    var thumbspattern = THUMBS_DIR+"/**/*.jpg";

    console.log(new Date().toISOString()+ " - *** Starting scan. ***");

    Promise.all([glob.globAsync(imagespattern,{nocase:true}),
                 db.listAllImages(), 
                 glob.globAsync(thumbspattern,{nocase:true})])
    .then(function(results) {
        let fsimages = results[0];
        let dbimages = results[1];
        let fsthumbs = results[2];

        // check images found on fs versus in DB
        let imagestoinsert = [];
        let thumbstocreate = []; 
        fsimages.forEach(function(item){
            
            let im = dbimages.findIndex(function(element,index,array){return element.path==item});

            if (im < 0){
                console.log(new Date().toISOString()+ " - file "+ path.basename(item) +" not found in db");
                //insertimage(item);
                imagestoinsert.push(item);
            }

            let thb = fsthumbs.findIndex(function(element,index,array){
                return ((IMAGES_DIR+element.substring(THUMBS_DIR.length)) == item);
            });

            if (thb < 0){
                console.log(new Date().toISOString()+ " - file "+ path.basename(item) +" not found in thumbs");
                //createthumb(item);
                thumbstocreate.push(item);
            }
        });
        
        // check images found in DB versus on fs and delete the obsolete ones
        let imagestodelete = [];
        dbimages.forEach(function (item){
            
            let im = fsimages.findIndex(function(element,index,array){return element==item.path});

            if (im < 0){ // esta en BBDD pero no en el fs, remove from db
                imagestodelete.push(item._id);
            }
        });
        
        let thumbstodelete = [];
        fsthumbs.forEach(function(item){

            let thb = fsimages.findIndex(function(element,index,array){
                return ((THUMBS_DIR+element.substring(IMAGES_DIR.length)) == item);
            });

            if (thb < 0){ // esta en los thumbnails pero no en las imagenes
                thumbstodelete.push(item);
            }
        });

        Promise.map(imagestoinsert,function(image){
            return insertimage(image);
        }, {concurrency:4})
        .then(function(){
            console.log(new Date().toISOString()+ " - *** Inserted all images, now creating thumbs. ***");
            return Promise.map(thumbstocreate, function(image){
                return createthumb(image);
            },{concurrency:6});
        })
        .then(function(){
            console.log(new Date().toISOString()+ " - *** Created all thumbs, now deleting missing thumbnails. ***");
            return Promise.map(thumbstodelete, function(thumb){
                return deletefile(thumb);
            },{concurrency:4})
        })
        .then(function(){
            console.log(new Date().toISOString()+ " - *** Deleted all thumbs, now removing missing images from DB. ***");
            if (imagestodelete.length > 0) {
                return db.deleteImages({_id:{$in: imagestodelete}});
            };
        })
        .then(function(){
            let ts = Math.abs(new Date().getTime() - started_at.getTime())/1000;
            console.log(new Date().toISOString()+ " - *** Finished scan: "+Math.floor(ts/(60))+"m "+Math.round(ts%60)+"s. ***");
        })
        .catch(function(error){
            console.log(new Date().toISOString+" - Error: "+error);
        });

    });
}

exports.scan = scan;